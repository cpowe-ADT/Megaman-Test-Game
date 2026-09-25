import type { AttackPattern, TelegraphSpec } from '../bosses/types'
import { telegraphFrame, type TelegraphGroup } from './telegraphArt'

/**
 * What a boss attack's wind-up draws (prompt 07 phase 7.1 item 2; prompt 12 part 12f), as plain data:
 * the adapter `src/scenes/game/BossTelegraphs.ts` only turns these marks and lines into sprites.
 *
 * - `reticle`: the `reticle` group on the hero (an aimed shot); it follows the hero through the wind-up.
 * - `glow`: `warning_flash` over the boss for attacks it delivers with its body (dashes, melee),
 *   otherwise `charge_glow` at the muzzle (beams, charges, lobs).
 * - `wave`: a row of `floor_marker`s on the floor where the strike lands: from the boss's feet in its
 *   facing for `self` anchors, centred on the hero's column for `target` anchors.
 * - `fan-lines`: `charge_glow` at the muzzle and lines fanning out from it, aimed at the hero for
 *   `target` anchors and along the facing otherwise.
 */
export type WarningFx = TelegraphSpec['warningFx']
export type TelegraphAnchor = TelegraphSpec['anchor']

export const WARNING_FX: readonly WarningFx[] = ['glow', 'fan-lines', 'reticle', 'wave']
export const TELEGRAPH_ANCHORS: readonly TelegraphAnchor[] = ['self', 'target', 'projectile']

/** Sprite origin per group: floor markers sit on the floor line, the flash stands on the boss's head. */
export const TELEGRAPH_GROUP_ORIGIN: Record<TelegraphGroup, { x: number; y: number }> = {
  reticle: { x: 0.5, y: 0.5 },
  floor_marker: { x: 0.5, y: 0.7 },
  warning_flash: { x: 0.5, y: 1 },
  charge_glow: { x: 0.5, y: 0.5 }
}

export const WAVE_MARKER_COUNT = 3
export const WAVE_MARKER_SPACING_PX = 48
export const FAN_LINE_COUNT = 3
export const FAN_LINE_SPREAD_RAD = 0.5
export const FAN_LINE_LENGTH_PX = 120
/** Frames per group in `telegraphs_v1`; the wind-up plays them once, 000 at the start and 003 at the end. */
export const TELEGRAPH_FRAME_COUNT = 4

export interface TelegraphGeometry {
  /** The boss's physics body: centre x and its top and bottom edges (game px, world space). */
  boss: { x: number; top: number; bottom: number }
  /** Where the boss's shots leave (`resolveBossMuzzleY`, 12px ahead of the boss in its facing). */
  muzzle: { x: number; y: number }
  facing: 1 | -1
  /** The hero's centre, or null when there is no live hero. */
  hero: { x: number; y: number } | null
  /** The arena floor under the boss room (game px, world space). */
  floorY: number
}

/** What a mark rides during the wind-up: the hero (reticle), the boss (flash, muzzle glow) or nothing (floor). */
export type TelegraphFollow = 'hero' | 'boss' | 'none'

export interface TelegraphMark {
  group: TelegraphGroup
  x: number
  y: number
  follow: TelegraphFollow
}

export interface TelegraphLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface TelegraphPlan {
  fx: WarningFx
  anchor: TelegraphAnchor
  durationMs: number
  /** `marks[0]` is the primary mark, the one `render_game_to_text` reports. */
  marks: TelegraphMark[]
  lines: TelegraphLine[]
}

export type TelegraphAttack = Pick<AttackPattern, 'state' | 'telegraph'> & {
  /** The runtime definition's attack type (`melee`, `projectile`, `hazard`, `dash`, `slam`), when known. */
  kind?: string
}

/** Attacks the boss delivers with its own body: the tell flashes over the boss, not at a muzzle. */
export function isBodyAttack(state: string, kind?: string): boolean {
  return state === 'dash' || kind === 'melee' || kind === 'dash'
}

export function planBossTelegraph(attack: TelegraphAttack, geometry: TelegraphGeometry): TelegraphPlan {
  const { warningFx: fx, anchor, telegraphMs } = attack.telegraph
  const { hero, facing, muzzle, boss, floorY } = geometry
  const marks: TelegraphMark[] = []
  const lines: TelegraphLine[] = []
  switch (fx) {
    case 'reticle': {
      marks.push(
        hero
          ? { group: 'reticle', x: hero.x, y: hero.y, follow: 'hero' }
          : { group: 'reticle', x: boss.x + facing * 64, y: muzzle.y, follow: 'none' }
      )
      break
    }
    case 'glow': {
      marks.push(
        isBodyAttack(attack.state, attack.kind)
          ? { group: 'warning_flash', x: boss.x, y: boss.top - 2, follow: 'boss' }
          : { group: 'charge_glow', x: muzzle.x, y: muzzle.y, follow: 'boss' }
      )
      break
    }
    case 'wave': {
      const onHero = anchor === 'target' && hero !== null
      for (let index = 0; index < WAVE_MARKER_COUNT; index += 1) {
        // Centred rows list the hero's column first, then alternate either side of it.
        const offset = onHero
          ? (index === 0 ? 0 : (index % 2 === 1 ? -1 : 1) * Math.ceil(index / 2)) * WAVE_MARKER_SPACING_PX
          : facing * WAVE_MARKER_SPACING_PX * (index + 1)
        marks.push({ group: 'floor_marker', x: (onHero ? hero.x : boss.x) + offset, y: floorY, follow: 'none' })
      }
      break
    }
    case 'fan-lines': {
      marks.push({ group: 'charge_glow', x: muzzle.x, y: muzzle.y, follow: 'none' })
      const base =
        anchor === 'target' && hero ? Math.atan2(hero.y - muzzle.y, hero.x - muzzle.x) : facing === -1 ? Math.PI : 0
      for (let index = 0; index < FAN_LINE_COUNT; index += 1) {
        const t = index / Math.max(1, FAN_LINE_COUNT - 1)
        const angle = base - FAN_LINE_SPREAD_RAD / 2 + t * FAN_LINE_SPREAD_RAD
        lines.push({
          x1: muzzle.x,
          y1: muzzle.y,
          x2: muzzle.x + Math.cos(angle) * FAN_LINE_LENGTH_PX,
          y2: muzzle.y + Math.sin(angle) * FAN_LINE_LENGTH_PX
        })
      }
      break
    }
    default: {
      const unknown: never = fx
      throw new Error(`[Boss] unknown telegraph warningFx '${String(unknown)}'`)
    }
  }
  return { fx, anchor, durationMs: Math.max(0, telegraphMs), marks, lines }
}

/** Frame 000 at the start of the wind-up to 003 in its last quarter; a zero-length wind-up shows 003. */
export function telegraphFrameIndex(elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) {
    return TELEGRAPH_FRAME_COUNT - 1
  }
  const index = Math.floor((TELEGRAPH_FRAME_COUNT * Math.max(0, elapsedMs)) / durationMs)
  return Math.max(0, Math.min(TELEGRAPH_FRAME_COUNT - 1, index))
}

/** What `render_game_to_text().bossState.runtime.telegraph` reports for the live wind-up. */
export interface TelegraphDebugState {
  attack: string
  fx: WarningFx
  anchor: TelegraphAnchor
  group: TelegraphGroup
  frame: string
  x: number
  y: number
  remainingMs: number
  marks: number
  lines: number
}

export function describeTelegraph(
  attackName: string,
  plan: TelegraphPlan,
  elapsedMs: number,
  primary: { x: number; y: number } = plan.marks[0] ?? { x: 0, y: 0 }
): TelegraphDebugState | null {
  const mark = plan.marks[0]
  if (!mark) {
    return null
  }
  return {
    attack: attackName,
    fx: plan.fx,
    anchor: plan.anchor,
    group: mark.group,
    frame: telegraphFrame(mark.group, telegraphFrameIndex(elapsedMs, plan.durationMs)),
    x: Math.round(primary.x),
    y: Math.round(primary.y),
    remainingMs: Math.max(0, Math.round(plan.durationMs - elapsedMs)),
    marks: plan.marks.length,
    lines: plan.lines.length
  }
}
