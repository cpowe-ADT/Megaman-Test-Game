import type Phaser from 'phaser'
import { resolveBossMuzzleY } from '../../boss/framework/BossProjectileController'
import { HAZARDS_ATLAS } from '../../boss/hazardArt'
import {
  BOSS_HAZARD_ART,
  createBossHazard,
  hazardBodyRect,
  hazardSolidRect,
  type BossHazard,
  type BossHazardId,
  type HazardArt,
  type HazardEnv,
  type HazardFrame,
  type HazardSheet,
  type HazardSpec
} from '../../boss/hazards/hazardSpawners'
import { TELEGRAPHS_ATLAS, telegraphFrame } from '../../boss/telegraphArt'
import { TELEGRAPH_GROUP_ORIGIN } from '../../boss/telegraphPlan'
import type { BossRect } from '../../bosses/bossBodies'
import { MECHANICS_V2_ATLAS } from '../../mechanics/mechanicsVisuals'
import { MAGNET_FIELD_TINT } from '../../mechanics/mechanicsV2Visuals'
import { WEAPONS_ATLAS } from '../../projectiles/weaponArt'

/** Under the telegraphs (7), over the arena art and the boss. */
export const HAZARD_DEPTH = 6
const RECENT_LIMIT = 16
const SHEET_KEYS: Record<HazardSheet, string> = {
  hazards_v1: HAZARDS_ATLAS.key,
  mechanics_v2: MECHANICS_V2_ATLAS.key,
  weapons_v1: WEAPONS_ATLAS.key
}

/** `<sheet>/<group>/00N`: the frame naming of hazards_v1, mechanics_v2 and weapons_v1 alike. */
export function hazardArtFrame(art: HazardArt, index: number): string {
  const frame = Math.max(0, Math.min(art.frames - 1, Math.floor(index)))
  return `${art.sheet}/${art.group}/${String(frame).padStart(3, '0')}`
}

export interface BossHazardsHost {
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  player?: Phaser.Physics.Arcade.Sprite
  bossTarget?: Phaser.Physics.Arcade.Sprite
  bossBody?: Phaser.Physics.Arcade.Sprite
}

interface HazardView {
  serial: number
  hazard: BossHazard
  attack: string
  floorY: number
  startedAt: number
  sprites: Phaser.GameObjects.Sprite[]
  zones: Array<Phaser.GameObjects.Zone | undefined>
  solids: Array<Phaser.GameObjects.Zone | undefined>
  markers: Array<Phaser.GameObjects.Sprite | undefined>
  field?: Phaser.GameObjects.Graphics
  last: HazardFrame | null
}

/**
 * The boss hazard spawners in the Game scene (prompt 07 phase 7.1, EVAL-P7-001). The pure spawner
 * (`src/boss/hazards/hazardSpawners.ts`) says where each piece is; this adapter draws it from its atlas, moves one
 * zone per hurting body into `group` (HitWires overlaps it with the hero: a hazard hurts only through its body) and
 * one per blocking body into `solids` (a collider), and applies a magnet node's pull. Time is the boss update's own
 * delta, so pause and hit-stop hold every hazard where it is.
 */
export class BossHazards {
  /** The last hazards spawned, oldest first: smoke reads it to prove each spawner ran. */
  readonly recent: Array<{ id: BossHazardId; attack: string; serial: number; atMs: number }> = []
  group?: Phaser.Physics.Arcade.Group
  solids?: Phaser.Physics.Arcade.Group
  private views: HazardView[] = []
  private clockMs = 0
  private serial = 0

  constructor(private readonly host: BossHazardsHost) {}

  /** A new run of the scene: the old objects went with the old display list and physics world. */
  reset(): void {
    this.views = []
    this.recent.length = 0
    this.clockMs = 0
    this.group = this.host.physics.add.group({ allowGravity: false, immovable: true })
    this.solids = this.host.physics.add.group({ allowGravity: false, immovable: true })
  }

  spawn(spec: HazardSpec, attack: string): void {
    if (!this.group) this.reset()
    const hazard = createBossHazard(spec)
    const view: HazardView = { serial: (this.serial += 1), hazard, attack, floorY: spec.floorY, startedAt: this.clockMs, sprites: [], zones: [], solids: [], markers: [], last: null }
    this.views.push(view)
    this.recent.push({ id: hazard.id, attack, serial: view.serial, atMs: Math.round(this.clockMs) })
    if (this.recent.length > RECENT_LIMIT) this.recent.shift()
    this.tick(view, 0)
  }

  update(deltaMs: number): void {
    if (this.views.length === 0) return
    this.clockMs += Math.max(0, deltaMs)
    let pullX = 0
    this.views = this.views.filter((view) => {
      const frame = this.tick(view, this.clockMs - view.startedAt)
      pullX += frame.pullX
      if (frame.done) this.destroyView(view)
      return !frame.done
    })
    const player = this.host.player
    if (pullX !== 0 && player?.active) player.x += (pullX * Math.max(0, deltaMs)) / 1000
  }

  countActive(): number {
    return this.views.length
  }

  /** Removes every hazard now (boss defeated). */
  clear(): void {
    this.views.forEach((view) => this.destroyView(view))
    this.views = []
  }

  getDebugState(): { clockMs: number; active: Array<Record<string, unknown>>; recent: BossHazards['recent'] } {
    return {
      clockMs: Math.round(this.clockMs),
      active: this.views.map((view) => {
        const art = BOSS_HAZARD_ART[view.hazard.id]
        const pieces = (view.last?.pieces ?? []).filter((entry) => entry.visible)
        return {
          id: view.hazard.id,
          attack: view.attack,
          phase: view.last?.phase ?? null,
          damage: view.hazard.damage,
          texture: SHEET_KEYS[art.sheet],
          pieces: pieces.map((entry) => ({
            x: Math.round(entry.x),
            y: Math.round(entry.y),
            frame: hazardArtFrame(art, entry.frame),
            body: roundRect(hazardBodyRect(entry)),
            solid: roundRect(hazardSolidRect(entry))
          }))
        }
      }),
      recent: this.recent
    }
  }

  private env(): HazardEnv {
    const player = this.host.player
    const heroBody = player?.active ? (player.body as Phaser.Physics.Arcade.Body | undefined) : undefined
    const boss = this.host.bossTarget ?? this.host.bossBody
    const bossBody = boss?.body as Phaser.Physics.Arcade.Body | undefined
    return {
      hero: heroBody ? { x: heroBody.x, y: heroBody.y, width: heroBody.width, height: heroBody.height } : null,
      boss: { x: boss?.x ?? 0, y: boss ? resolveBossMuzzleY(boss.y, bossBody) : 0 }
    }
  }

  private tick(view: HazardView, elapsedMs: number): HazardFrame {
    const frame = view.hazard.sample(elapsedMs, this.env())
    view.last = frame
    const art = BOSS_HAZARD_ART[view.hazard.id]
    frame.pieces.forEach((entry, index) => {
      const sprite =
        view.sprites[index] ?? (view.sprites[index] = this.host.add.sprite(entry.x, entry.y, SHEET_KEYS[art.sheet], hazardArtFrame(art, 0)).setDepth(HAZARD_DEPTH))
      sprite
        .setOrigin(0.5, entry.anchor === 'bottom' ? 1 : 0.5)
        .setPosition(entry.x, entry.y)
        .setFrame(hazardArtFrame(art, entry.frame))
        .setAlpha(entry.alpha)
        .setScale(entry.scale)
        .setFlipX(entry.flipX)
        .setVisible(entry.visible)
      this.placeZone(view, view.zones, index, this.group, hazardBodyRect(entry), true)
      this.placeZone(view, view.solids, index, this.solids, hazardSolidRect(entry), false)
      this.placeMarker(view, index, entry.visible && entry.marker ? entry.x : null, elapsedMs)
    })
    if (frame.field) {
      view.field ??= this.host.add.graphics().setDepth(HAZARD_DEPTH - 1)
      view.field.clear().lineStyle(1, MAGNET_FIELD_TINT, 0.45).strokeCircle(frame.field.x, frame.field.y, frame.field.radius)
    } else {
      view.field?.clear()
    }
    return frame
  }

  private placeZone(
    view: HazardView,
    zones: Array<Phaser.GameObjects.Zone | undefined>,
    index: number,
    group: Phaser.Physics.Arcade.Group | undefined,
    rect: BossRect | null,
    hurts: boolean
  ): void {
    let zone = zones[index]
    if (!rect || !group) {
      const body = zone?.body as Phaser.Physics.Arcade.Body | undefined
      if (body) body.enable = false
      return
    }
    if (!zone) {
      zone = this.host.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
      group.add(zone)
      if (hurts) {
        zone.setData({ damageSourceType: 'boss_projectile', damageSourceId: view.hazard.id, damageAmount: view.hazard.damage, bossRoomHazard: true, hazardSerial: view.serial })
      }
      zones[index] = zone
    }
    const body = zone.body as Phaser.Physics.Arcade.Body
    if (body.width !== rect.width || body.height !== rect.height) {
      zone.setSize(rect.width, rect.height)
      body.setSize(rect.width, rect.height)
    }
    body.enable = true
    body.setAllowGravity(false)
    body.setImmovable(true)
    body.reset(rect.x + rect.width / 2, rect.y + rect.height / 2)
  }

  private placeMarker(view: HazardView, index: number, x: number | null, elapsedMs: number): void {
    const marker = view.markers[index]
    if (x === null) {
      marker?.setVisible(false)
      return
    }
    const pivot = TELEGRAPH_GROUP_ORIGIN.floor_marker
    const sprite =
      marker ??
      (view.markers[index] = this.host.add
        .sprite(x, view.floorY, TELEGRAPHS_ATLAS.key, telegraphFrame('floor_marker', 0))
        .setOrigin(pivot.x, pivot.y)
        .setDepth(HAZARD_DEPTH - 1))
    sprite.setVisible(true).setPosition(x, view.floorY).setFrame(telegraphFrame('floor_marker', Math.floor(elapsedMs / 90) % 4))
  }

  private destroyView(view: HazardView): void {
    view.sprites.forEach((sprite) => sprite.destroy())
    view.zones.forEach((zone) => zone?.destroy())
    view.solids.forEach((zone) => zone?.destroy())
    view.markers.forEach((marker) => marker?.destroy())
    view.field?.destroy()
  }
}

function roundRect(rect: BossRect | null): BossRect | null {
  return rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: rect.width, height: rect.height } : null
}
