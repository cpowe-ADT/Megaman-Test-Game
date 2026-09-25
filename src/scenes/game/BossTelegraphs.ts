import type Phaser from 'phaser'
import { resolveBossMuzzleY, type PendingBossTelegraph } from '../../boss/framework/BossProjectileController'
import { TELEGRAPHS_ATLAS, telegraphFrame } from '../../boss/telegraphArt'
import {
  describeTelegraph,
  planBossTelegraph,
  TELEGRAPH_GROUP_ORIGIN,
  telegraphFrameIndex,
  type TelegraphDebugState,
  type TelegraphMark,
  type TelegraphPlan
} from '../../boss/telegraphPlan'

/** Above the boss and the arena art, under the HUD. */
export const TELEGRAPH_DEPTH = 7
const FAN_LINE_COLOR = 0xff5a4a
const RECENT_LIMIT = 12

export interface BossTelegraphsHost {
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly textures: Phaser.Textures.TextureManager
  player?: Phaser.Physics.Arcade.Sprite
  bossTarget?: Phaser.Physics.Arcade.Sprite
  bossBody?: Phaser.Physics.Arcade.Sprite
  bossController?: { getGroundY(): number }
  bossProjectileController?: { getPendingTelegraphs(): readonly PendingBossTelegraph[] }
}

interface MarkView {
  mark: TelegraphMark
  sprite: Phaser.GameObjects.Sprite
  /** Offset from the boss origin for marks that ride the boss. */
  dx: number
  dy: number
}

interface TelegraphView {
  attackName: string
  startedAt: number
  plan: TelegraphPlan
  marks: MarkView[]
  graphics?: Phaser.GameObjects.Graphics
}

/**
 * Draws each boss attack's authored tell for its wind-up (prompt 07 phase 7.1 item 2; prompt 12 part
 * 12f, EVAL-P7-001). The wind-up is the projectile controller's pending attack, from the attack event to
 * its execution, so a stop (death, victory) clears the tell on the next frame. `planBossTelegraph` says
 * what to draw; this adapter only makes and moves the sprites.
 */
export class BossTelegraphs {
  /** The last telegraphs started, oldest first: smoke reads it to prove each attack drew its tell. */
  readonly recent: Array<{ attack: string; fx: string; group: string; startedAtMs: number }> = []
  private readonly views = new Map<PendingBossTelegraph, TelegraphView>()
  private live: TelegraphDebugState | null = null

  constructor(private readonly host: BossTelegraphsHost) {}

  update(now: number): void {
    const pending = this.host.bossProjectileController?.getPendingTelegraphs() ?? []
    for (const [entry, view] of this.views) {
      if (!pending.includes(entry)) {
        this.destroyView(view)
        this.views.delete(entry)
      }
    }
    let newest: TelegraphView | undefined
    for (const entry of pending) {
      const view = this.views.get(entry) ?? this.createView(entry)
      if (!view) {
        continue
      }
      this.views.set(entry, view)
      this.tickView(view, now)
      newest = view
    }
    const primary = newest?.marks[0]?.sprite
    this.live = newest
      ? describeTelegraph(newest.attackName, newest.plan, now - newest.startedAt, primary ? { x: primary.x, y: primary.y } : undefined)
      : null
  }

  getDebugState(): TelegraphDebugState | null {
    return this.live
  }

  /** Removes every drawn tell now (boss defeated). */
  clear(): void {
    this.views.forEach((view) => this.destroyView(view))
    this.views.clear()
    this.live = null
  }

  /** A new run of the scene: the old sprites went with the old display list. */
  reset(): void {
    this.views.clear()
    this.live = null
    this.recent.length = 0
  }

  private createView(entry: PendingBossTelegraph): TelegraphView | undefined {
    const host = this.host
    const origin = host.bossTarget ?? host.bossBody
    if (!origin || !origin.active || !host.textures.exists(TELEGRAPHS_ATLAS.key)) {
      return undefined
    }
    const body = origin.body as Phaser.Physics.Arcade.Body | undefined
    const facing = entry.direction
    const plan = planBossTelegraph(
      {
        state: entry.attack.state,
        telegraph: entry.attack.telegraph,
        kind: typeof entry.attackData?.type === 'string' ? entry.attackData.type : undefined
      },
      {
        boss: { x: body?.center.x ?? origin.x, top: body?.top ?? origin.y - 32, bottom: body?.bottom ?? origin.y },
        muzzle: { x: origin.x + 12 * facing, y: resolveBossMuzzleY(origin.y, body) },
        facing,
        hero: host.player?.active ? { x: host.player.x, y: host.player.y } : null,
        floorY: host.bossController?.getGroundY() ?? body?.bottom ?? origin.y
      }
    )
    const marks = plan.marks.map((mark) => {
      const pivot = TELEGRAPH_GROUP_ORIGIN[mark.group]
      const sprite = host.add
        .sprite(mark.x, mark.y, TELEGRAPHS_ATLAS.key, telegraphFrame(mark.group, 0))
        .setOrigin(pivot.x, pivot.y)
        .setDepth(TELEGRAPH_DEPTH)
      return { mark, sprite, dx: mark.x - origin.x, dy: mark.y - origin.y }
    })
    const graphics = plan.lines.length > 0 ? host.add.graphics().setDepth(TELEGRAPH_DEPTH) : undefined
    this.recent.push({ attack: entry.attack.name, fx: plan.fx, group: plan.marks[0]?.group ?? 'none', startedAtMs: entry.startedAt })
    if (this.recent.length > RECENT_LIMIT) {
      this.recent.shift()
    }
    return { attackName: entry.attack.name, startedAt: entry.startedAt, plan, marks, graphics }
  }

  private tickView(view: TelegraphView, now: number): void {
    const index = telegraphFrameIndex(now - view.startedAt, view.plan.durationMs)
    const player = this.host.player
    const origin = this.host.bossTarget ?? this.host.bossBody
    for (const { mark, sprite, dx, dy } of view.marks) {
      sprite.setFrame(telegraphFrame(mark.group, index))
      if (mark.follow === 'hero' && player?.active) {
        sprite.setPosition(player.x, player.y)
      } else if (mark.follow === 'boss' && origin?.active) {
        sprite.setPosition(origin.x + dx, origin.y + dy)
      }
    }
    if (view.graphics) {
      view.graphics.clear()
      view.graphics.lineStyle(1, FAN_LINE_COLOR, 0.35 + index * 0.15)
      view.plan.lines.forEach((line) => view.graphics?.lineBetween(line.x1, line.y1, line.x2, line.y2))
    }
  }

  private destroyView(view: TelegraphView): void {
    view.marks.forEach(({ sprite }) => sprite.destroy())
    view.graphics?.destroy()
  }
}
