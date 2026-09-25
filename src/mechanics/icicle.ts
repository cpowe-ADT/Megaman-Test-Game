/**
 * `icicle` (prompt 12 part 12b; 02 §2.2): hangs from the ceiling, shakes for `shakeMs` once the hero
 * passes under it, falls, damages the hero on contact and shatters (on the hero or on the floor). A
 * shattered icicle stays gone until the checkpoint respawn. Pure; the Phaser edge is
 * `adapters/HazardMechanicsAdapter.ts`.
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
}

export const ICICLE_SHAKE_MS = 400
export const ICICLE_GRAVITY = 1100
export const ICICLE_MAX_FALL_SPEED = 520
export const ICICLE_TRIGGER_HALF_WIDTH = 20
/** The spike's damage box: 10 px wide, 24 px long (the art's spike rows). */
export const ICICLE_LENGTH = 24
export const ICICLE_HALF_WIDTH = 5
export const ICICLE_DEFAULT_DAMAGE = 2

export function createIcicleState(definition: IcicleDefinition): IcicleState {
  return { id: definition.id, phase: 'hanging', timerMs: 0, dropY: 0, velocityY: 0, hits: 0 }
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

/** One frame; `hit` is true on the frame it shatters on the hero. Once shaking starts it falls even if the hero moves on. */
export function stepIcicle(
  definition: IcicleDefinition,
  state: IcicleState,
  input: { hero: Box | null; deltaMs: number }
): { state: IcicleState; hit: boolean } {
  const deltaMs = Math.max(0, input.deltaMs)
  const timerMs = state.timerMs + deltaMs
  switch (state.phase) {
    case 'hanging':
      return { state: input.hero && isHeroUnderIcicle(definition, input.hero) ? { ...state, phase: 'shaking', timerMs: 0 } : state, hit: false }
    case 'shaking':
      if (timerMs < Math.max(0, definition.shakeMs ?? ICICLE_SHAKE_MS)) return { state: { ...state, timerMs }, hit: false }
      return { state: { ...state, phase: 'falling', timerMs: 0, velocityY: 0 }, hit: false }
    case 'falling': {
      const fall = stepFall(state.velocityY, ICICLE_GRAVITY, ICICLE_MAX_FALL_SPEED, deltaMs)
      const maxDrop = Math.max(0, definition.floorY - definition.y - ICICLE_LENGTH)
      const moved = { ...state, timerMs, dropY: Math.min(maxDrop, state.dropY + fall.distance), velocityY: fall.velocity }
      if (input.hero && boxesOverlap(input.hero, icicleBox(definition, moved))) {
        return { state: { ...moved, phase: 'shattered', timerMs: 0, velocityY: 0, hits: state.hits + 1 }, hit: true }
      }
      return { state: moved.dropY >= maxDrop ? { ...moved, phase: 'shattered', timerMs: 0, velocityY: 0 } : moved, hit: false }
    }
    case 'shattered':
      return { state: { ...state, timerMs }, hit: false }
  }
}

/** The checkpoint respawn: hanging again (the hit count stays). */
export function resetIcicle(definition: IcicleDefinition, state: IcicleState): IcicleState {
  return { ...createIcicleState(definition), hits: state.hits }
}

/** The shake tell: a whole-pixel sideways jitter, 0 when not shaking. */
export function icicleShakeOffset(state: Pick<IcicleState, 'phase' | 'timerMs'>): number {
  if (state.phase !== 'shaking') return 0
  return Math.floor(state.timerMs / 40) % 2 === 0 ? 1 : -1
}
