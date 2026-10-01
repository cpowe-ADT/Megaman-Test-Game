/**
 * `icicle` (prompt 12 part 12b; 02 §2.2): hangs from the ceiling, shakes for `shakeMs` once the hero
 * passes under it, falls, damages the hero on contact and shatters (on the hero or on the floor). A
 * shattered icicle stays gone until the checkpoint respawn. An icicle on a `rhythm` (12d, the Public
 * Archives gallery) drops on the stage clock instead, whoever is under it, and grows back after it
 * shatters. While it shakes and falls a shadow on the floor marks where it lands (`icicleShadow`).
 * Pure; the Phaser edge is `adapters/HazardMechanicsAdapter.ts`.
 */
import { boxesOverlap, type Box } from './crumbleGroup'
import { stepFall } from './rockfall'

export type IcicleDefinition = {
  id: string
  /** Centre x, and the ceiling line the spike hangs from (its top), world px. */
  x: number
  y: number
  /** The floor line the tip shatters on, world px. */
  floorY: number
  /** The hero within this many px (horizontally) below it starts the shake (default 20). */
  triggerHalfWidth?: number
  /** Shake before the drop, ms (default 400). */
  shakeMs?: number
  /** HP per hit (default 2). */
  damage?: number
  /** Drops on the stage clock, not when the hero passes under (12d): one drop per period. */
  rhythm?: IcicleRhythm
}

export type IcicleRhythm = {
  /** One drop per this much stage clock, ms; longer than the shake, the fall and the regrow. */
  periodMs: number
  /** Where in the period the shake starts, ms (default 0): staggered offsets make a wave. */
  offsetMs?: number
  /** It grows back this long after it shatters, ms (default `ICICLE_REGROW_MS`). */
  regrowMs?: number
}

export type IciclePhase = 'hanging' | 'shaking' | 'falling' | 'shattered'

export type IcicleState = {
  id: string
  phase: IciclePhase
  /** Time in the current phase, ms. */
  timerMs: number
  /** How far the spike has dropped, px, and its fall speed. */
  dropY: number
  velocityY: number
  hits: number
  /** On a rhythm: the clock cycle it last dropped in (null before its first drop and after a respawn). */
  cycle: number | null
}

export const ICICLE_SHAKE_MS = 400
export const ICICLE_GRAVITY = 1100
export const ICICLE_MAX_FALL_SPEED = 520
export const ICICLE_TRIGGER_HALF_WIDTH = 20
/** The spike's damage box: 10 px wide, 24 px long (the art's spike rows). */
export const ICICLE_LENGTH = 24
export const ICICLE_HALF_WIDTH = 5
export const ICICLE_DEFAULT_DAMAGE = 2
/** A rhythm icicle grows back this long after it shatters (the shards fade in 450ms). */
export const ICICLE_REGROW_MS = 600

export function createIcicleState(definition: IcicleDefinition): IcicleState {
  return { id: definition.id, phase: 'hanging', timerMs: 0, dropY: 0, velocityY: 0, hits: 0, cycle: null }
}

/** Where the stage clock sits in a rhythm: the cycle index and the time since that cycle's shake was due. */
export function icicleRhythmAt(rhythm: IcicleRhythm, clockMs: number): { cycle: number; sinceShakeMs: number } {
  const period = Math.max(1, rhythm.periodMs)
  const shifted = clockMs - (rhythm.offsetMs ?? 0)
  const cycle = Math.floor(shifted / period)
  return { cycle, sinceShakeMs: shifted - cycle * period }
}

/** How far the spike drops before its tip meets the floor line, px. */
export function icicleMaxDrop(definition: IcicleDefinition): number {
  return Math.max(0, definition.floorY - definition.y - ICICLE_LENGTH)
}

/** The shadow's size while the icicle shakes, as a share of its full size (it grows to 1 as the tip lands). */
export const ICICLE_SHADOW_START_SCALE = 0.8

/** The telegraph: a shadow on the floor under it while it shakes and falls, growing as the tip nears. */
export function icicleShadow(definition: IcicleDefinition, state: Pick<IcicleState, 'phase' | 'dropY'>): { visible: boolean; scale: number } {
  if (state.phase !== 'shaking' && state.phase !== 'falling') return { visible: false, scale: 0 }
  const progress = state.phase === 'falling' ? Math.min(1, Math.max(0, state.dropY / Math.max(1, icicleMaxDrop(definition)))) : 0
  return { visible: true, scale: ICICLE_SHADOW_START_SCALE + (1 - ICICLE_SHADOW_START_SCALE) * progress }
}

export function icicleBox(definition: IcicleDefinition, state: Pick<IcicleState, 'dropY'>): Box {
  const top = definition.y + state.dropY
  return { left: definition.x - ICICLE_HALF_WIDTH, right: definition.x + ICICLE_HALF_WIDTH, top, bottom: top + ICICLE_LENGTH }
}

/** The hero is below the ceiling line and within the trigger half-width of the icicle's x. */
export function isHeroUnderIcicle(definition: IcicleDefinition, hero: Box): boolean {
  const centreX = (hero.left + hero.right) / 2
  return Math.abs(centreX - definition.x) <= (definition.triggerHalfWidth ?? ICICLE_TRIGGER_HALF_WIDTH) && hero.top >= definition.y
}

/**
 * One frame; `hit` is true on the frame it shatters on the hero. Once shaking starts it falls even if the hero
 * moves on. A rhythm icicle reads `clockMs` (the stage clock): it starts shaking in the first frame of a new
 * cycle's shake window, in step with the clock, and it grows back `regrowMs` after it shatters.
 */
export function stepIcicle(
  definition: IcicleDefinition,
  state: IcicleState,
  input: { hero: Box | null; deltaMs: number; clockMs?: number }
): { state: IcicleState; hit: boolean } {
  const deltaMs = Math.max(0, input.deltaMs)
  const timerMs = state.timerMs + deltaMs
  const shakeMs = Math.max(0, definition.shakeMs ?? ICICLE_SHAKE_MS)
  switch (state.phase) {
    case 'hanging': {
      if (definition.rhythm) {
        const at = icicleRhythmAt(definition.rhythm, input.clockMs ?? 0)
        const due = at.cycle !== state.cycle && at.sinceShakeMs < shakeMs
        return { state: due ? { ...state, phase: 'shaking', timerMs: at.sinceShakeMs, cycle: at.cycle } : state, hit: false }
      }
      return { state: input.hero && isHeroUnderIcicle(definition, input.hero) ? { ...state, phase: 'shaking', timerMs: 0 } : state, hit: false }
    }
    case 'shaking':
      if (timerMs < shakeMs) return { state: { ...state, timerMs }, hit: false }
      return { state: { ...state, phase: 'falling', timerMs: 0, velocityY: 0 }, hit: false }
    case 'falling': {
      const fall = stepFall(state.velocityY, ICICLE_GRAVITY, ICICLE_MAX_FALL_SPEED, deltaMs)
      const maxDrop = icicleMaxDrop(definition)
      const moved = { ...state, timerMs, dropY: Math.min(maxDrop, state.dropY + fall.distance), velocityY: fall.velocity }
      if (input.hero && boxesOverlap(input.hero, icicleBox(definition, moved))) {
        return { state: { ...moved, phase: 'shattered', timerMs: 0, velocityY: 0, hits: state.hits + 1 }, hit: true }
      }
      return { state: moved.dropY >= maxDrop ? { ...moved, phase: 'shattered', timerMs: 0, velocityY: 0 } : moved, hit: false }
    }
    case 'shattered':
      if (definition.rhythm && timerMs >= Math.max(0, definition.rhythm.regrowMs ?? ICICLE_REGROW_MS)) {
        return { state: { ...state, phase: 'hanging', timerMs: 0, dropY: 0, velocityY: 0 }, hit: false }
      }
      return { state: { ...state, timerMs }, hit: false }
  }
}

/** The checkpoint respawn: hanging again (the hit count stays; a rhythm icicle waits for the next shake window). */
export function resetIcicle(definition: IcicleDefinition, state: IcicleState): IcicleState {
  return { ...createIcicleState(definition), hits: state.hits }
}

/** The shake tell: a whole-pixel sideways jitter, 0 when not shaking. */
export function icicleShakeOffset(state: Pick<IcicleState, 'phase' | 'timerMs'>): number {
  if (state.phase !== 'shaking') return 0
  return Math.floor(state.timerMs / 40) % 2 === 0 ? 1 : -1
}
