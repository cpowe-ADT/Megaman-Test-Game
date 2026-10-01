import type { BossRoomDynamicsProfile } from '../bosses/bossCombatProfiles'

/**
 * The timed beats every boss fight shares (prompt 07 phase 7.2; prompt 12 part 12f wave 2, EVAL-P7-002 and
 * EVAL-P7-003): the intro (WARNING band, name-and-element card, bar fill), desperation at 20% HP (palette flash
 * and the arena change the room kind allows) and the death (defeat frames, hit-stop, chained explosion, flash,
 * freeze). Pure: no Phaser, so `tests/boss-fight-beats.test.ts` checks every number without a scene;
 * `src/scenes/game/BossPresentation.ts` only draws what these say.
 */

export const BOSS_INTRO_TIMING = {
  /** The WARNING band blinks this long... */
  warningMs: 1000,
  warningBlinkMs: 125,
  /** ...then the same band holds the boss's name and element this long, before the intro dialogue. */
  cardMs: 1200,
  /** After the intro dialogue the bar fills 0 to max over this long, one tick at a time. */
  barFillMs: 900,
  barFillTicks: 18
} as const

export type BossIntroBeat = 'warning' | 'card' | 'done'

/** Which intro beat shows `elapsedMs` after the room activates. */
export function introBeatAt(elapsedMs: number, timing = BOSS_INTRO_TIMING): BossIntroBeat {
  if (elapsedMs < timing.warningMs) return 'warning'
  if (elapsedMs < timing.warningMs + timing.cardMs) return 'card'
  return 'done'
}

/** The WARNING text shows on even blink slots and hides on odd ones. */
export function warningVisibleAt(elapsedMs: number, timing = BOSS_INTRO_TIMING): boolean {
  return Math.floor(Math.max(0, elapsedMs) / timing.warningBlinkMs) % 2 === 0
}

/** The bar's drawn fill `elapsedMs` into the fill: whole ticks only, so it climbs in visible notches. */
export function barFillAt(elapsedMs: number, timing = BOSS_INTRO_TIMING): { tick: number; fraction: number } {
  const tickMs = timing.barFillMs / timing.barFillTicks
  const tick = Math.max(0, Math.min(timing.barFillTicks, Math.floor(Math.max(0, elapsedMs) / tickMs)))
  return { tick, fraction: tick / timing.barFillTicks }
}

export const BOSS_DEATH_TIMING = {
  /** Hit-stop on the killing blow, in 60Hz frames (the hit-stop clock counts real time). */
  hitstopFrames: 20,
  /** The chained explosion over the defeat frames; the boss is removed when it ends. */
  explosionMs: 1200,
  bursts: 8,
  /** White flash on the killing blow and again when the boss vanishes. */
  flashMs: 180,
  /** The room holds still this long before the defeat dialogue. */
  freezeMs: 900
} as const

export interface BossDeathTimeline {
  hitstopMs: number
  explosionStartMs: number
  burstAtMs: number[]
  explosionEndMs: number
  dialogueAtMs: number
}

export type BossDeathBeat = 'hitstop' | 'explosion' | 'freeze' | 'dialogue'

/** Milestones from the killing blow: hit-stop, then the explosion chain, then the freeze, then dialogue. */
export function bossDeathTimeline(timing = BOSS_DEATH_TIMING): BossDeathTimeline {
  const hitstopMs = Math.round((timing.hitstopFrames * 1000) / 60)
  const explosionStartMs = hitstopMs
  const step = timing.explosionMs / timing.bursts
  const burstAtMs = Array.from({ length: timing.bursts }, (_, index) => Math.round(explosionStartMs + index * step))
  const explosionEndMs = explosionStartMs + timing.explosionMs
  return { hitstopMs, explosionStartMs, burstAtMs, explosionEndMs, dialogueAtMs: explosionEndMs + timing.freezeMs }
}

export function deathBeatAt(elapsedMs: number, timeline = bossDeathTimeline()): BossDeathBeat {
  if (elapsedMs < timeline.explosionStartMs) return 'hitstop'
  if (elapsedMs < timeline.explosionEndMs) return 'explosion'
  if (elapsedMs < timeline.dialogueAtMs) return 'freeze'
  return 'dialogue'
}

/** Where burst `index` goes around the boss: a widening spiral, so the chain reads as travelling. */
export function burstOffset(index: number): { x: number; y: number; scale: number } {
  const angle = index * 2.4
  const radius = 6 + index * 3
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius * 0.8) - 14, scale: 0.8 + (index % 3) * 0.2 }
}

/** Desperation begins at or below this share of max HP. */
export const DESPERATION_THRESHOLD = 0.2

export const DESPERATION_FLASH = { durationMs: 720, stepMs: 60 } as const

/** The colour the boss shows `elapsedMs` into its desperation flash, or null when the flash is over. */
export function paletteFlashColor(elapsedMs: number, palette: readonly number[], flash = DESPERATION_FLASH): number | null {
  if (palette.length === 0 || elapsedMs < 0 || elapsedMs >= flash.durationMs) return null
  return palette[Math.floor(elapsedMs / flash.stepMs) % palette.length]
}

export type DesperationArenaKind = 'vents_all_on' | 'mines_everywhere' | 'pillars_rising' | 'anchors_shifting' | 'none'

export interface DesperationArenaChange {
  kind: DesperationArenaKind
  /** Room fractions where arena hazards pulse (empty when the room changes no hazards). */
  hazardFractions: number[]
  /** The boss's movement anchors from desperation on (unchanged unless the anchors shift). */
  anchorFractions: number[]
  /** Hazards warn (no body) for warnMs, then hurt for onMs, every pulseEveryMs. */
  pulseEveryMs: number
  warnMs: number
  onMs: number
}

/**
 * The arena change desperation makes where the room kind allows: lane vents all fire, mine lanes fill with
 * mines, pillar lanes raise pillars, and anchor rooms shift their anchors half a gap; a flat room has nothing to
 * change (the palette flash and the new attack still play).
 */
export function resolveDesperationArena(room: BossRoomDynamicsProfile): DesperationArenaChange {
  const anchors = [...room.anchorFractions]
  const pulse = { pulseEveryMs: 2800, warnMs: 420, onMs: 1100 }
  switch (room.kind) {
    case 'lane_vents':
      return { kind: 'vents_all_on', hazardFractions: anchors, anchorFractions: anchors, ...pulse }
    case 'mine_lanes':
      return { kind: 'mines_everywhere', hazardFractions: spreadFractions(anchors), anchorFractions: anchors, ...pulse }
    case 'pillar_lanes':
      return { kind: 'pillars_rising', hazardFractions: anchors, anchorFractions: anchors, ...pulse, onMs: 1500 }
    case 'height_anchors':
    case 'teleport_anchors':
      return { kind: 'anchors_shifting', hazardFractions: [], anchorFractions: shiftAnchors(anchors), ...pulse }
    default:
      return { kind: 'none', hazardFractions: [], anchorFractions: anchors, ...pulse }
  }
}

/** Mines everywhere: every anchor plus the midpoints between them. */
function spreadFractions(anchors: number[]): number[] {
  const sorted = [...anchors].sort((a, b) => a - b)
  const midpoints = sorted.slice(1).map((value, index) => round3((value + sorted[index]) / 2))
  return [...sorted, ...midpoints].sort((a, b) => a - b)
}

/** Each anchor moves half the gap toward its neighbour (the last one moves back), inside 0.08 to 0.92. */
function shiftAnchors(anchors: number[]): number[] {
  const sorted = [...anchors].sort((a, b) => a - b)
  return sorted.map((value, index) => {
    const next = sorted[index + 1] ?? sorted[index - 1] ?? value
    return round3(Math.min(0.92, Math.max(0.08, value + (next - value) / 2)))
  })
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
