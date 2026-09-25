/**
 * `rockfall` (prompt 12 part 12b; 02 §2.2): a ceiling spawner. A warning dust puff for `warnMs`, then a
 * boulder falls, damages the hero on contact and breaks into rubble (on the hero or on the floor); the
 * rubble clears and the spawner waits again. It starts when the hero crosses `triggerX` (either way), or
 * every `intervalMs` when it has no trigger. The checkpoint respawn resets it. Pure; the Phaser edge is
 * `adapters/HazardMechanicsAdapter.ts`.
 */
import { boxesOverlap, type Box } from './crumbleGroup'

export type RockfallDefinition = {
  id: string
  /** Column centre, world px. */
  x: number
  /** Boulder centre where it appears (under the ceiling) and where it rests on the floor, world px. */
  topY: number
  floorY: number
  /** Crossing this x starts a drop; without it the drops repeat every `intervalMs`. */
  triggerX?: number
  /** Default 2600 (timer mode only). */
  intervalMs?: number
  /** Dust puff before the drop, ms (default 400: the 02 §2.2 telegraph). */
  warnMs?: number
  /** HP per hit (default 2). */
  damage?: number
  /** Boulder box side, px (default 22). */
  size?: number
}

export type RockfallPhase = 'waiting' | 'warning' | 'falling' | 'rubble'

export type RockfallState = {
  id: string
  phase: RockfallPhase
  /** Time in the current phase, ms. */
  timerMs: number
  /** Boulder centre y and fall speed. */
  y: number
  velocityY: number
  drops: number
  hits: number
}

export const ROCKFALL_WARN_MS = 400
export const ROCKFALL_INTERVAL_MS = 2600
export const ROCKFALL_RUBBLE_MS = 700
export const ROCKFALL_GRAVITY = 900
export const ROCKFALL_MAX_FALL_SPEED = 480
export const ROCKFALL_DEFAULT_SIZE = 22
export const ROCKFALL_DEFAULT_DAMAGE = 2

/** One step of a capped fall from `velocity`: the new speed and the distance covered, px. */
export function stepFall(velocity: number, gravity: number, maxSpeed: number, deltaMs: number): { velocity: number; distance: number } {
  const dt = Math.max(0, deltaMs) / 1000
  const next = Math.min(maxSpeed, velocity + gravity * dt)
  return { velocity: next, distance: ((velocity + next) / 2) * dt }
}

export function createRockfallState(definition: RockfallDefinition): RockfallState {
  return { id: definition.id, phase: 'waiting', timerMs: 0, y: definition.topY, velocityY: 0, drops: 0, hits: 0 }
}

export function rockfallBox(definition: RockfallDefinition, state: Pick<RockfallState, 'y'>): Box {
  const half = (definition.size ?? ROCKFALL_DEFAULT_SIZE) / 2
  return { left: definition.x - half, right: definition.x + half, top: state.y - half, bottom: state.y + half }
}

/** The hero crossed `triggerX` this frame, in either direction. */
export function crossedTrigger(triggerX: number, prevX: number, x: number): boolean {
  return (prevX < triggerX && x >= triggerX) || (prevX > triggerX && x <= triggerX)
}

/** One frame; `hit` is true on the frame the boulder breaks on the hero. The adapter skips frames while paused or dying. */
export function stepRockfall(
  definition: RockfallDefinition,
  state: RockfallState,
  input: { heroX: number; prevHeroX: number; hero: Box | null; deltaMs: number }
): { state: RockfallState; hit: boolean } {
  const deltaMs = Math.max(0, input.deltaMs)
  const timerMs = state.timerMs + deltaMs
  switch (state.phase) {
    case 'waiting': {
      const start =
        definition.triggerX !== undefined
          ? crossedTrigger(definition.triggerX, input.prevHeroX, input.heroX)
          : timerMs >= Math.max(1, definition.intervalMs ?? ROCKFALL_INTERVAL_MS)
      return { state: start ? { ...state, phase: 'warning', timerMs: 0 } : { ...state, timerMs }, hit: false }
    }
    case 'warning':
      if (timerMs < Math.max(0, definition.warnMs ?? ROCKFALL_WARN_MS)) return { state: { ...state, timerMs }, hit: false }
      return { state: { ...state, phase: 'falling', timerMs: 0, y: definition.topY, velocityY: 0, drops: state.drops + 1 }, hit: false }
    case 'falling': {
      const fall = stepFall(state.velocityY, ROCKFALL_GRAVITY, ROCKFALL_MAX_FALL_SPEED, deltaMs)
      const y = Math.min(definition.floorY, state.y + fall.distance)
      const moved = { ...state, timerMs, y, velocityY: fall.velocity }
      if (input.hero && boxesOverlap(input.hero, rockfallBox(definition, moved))) {
        return { state: { ...moved, phase: 'rubble', timerMs: 0, velocityY: 0, hits: state.hits + 1 }, hit: true }
      }
      return { state: y >= definition.floorY ? { ...moved, phase: 'rubble', timerMs: 0, velocityY: 0 } : moved, hit: false }
    }
    case 'rubble':
      if (timerMs < ROCKFALL_RUBBLE_MS) return { state: { ...state, timerMs }, hit: false }
      return { state: { ...state, phase: 'waiting', timerMs: 0, y: definition.topY, velocityY: 0 }, hit: false }
  }
}

/** The checkpoint respawn: waiting again, the boulder back under the ceiling (the drop and hit counts stay). */
export function resetRockfall(definition: RockfallDefinition, state: RockfallState): RockfallState {
  return { ...createRockfallState(definition), drops: state.drops, hits: state.hits }
}
