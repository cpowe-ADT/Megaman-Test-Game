import { isSaberInReach } from './roomLock'
import type { Box } from './crumbleGroup'

/**
 * `breakable_wall` (prompt 02 §2.2): a solid block that saber cuts or a charged shot break open,
 * revealing what is behind it. Each saber cut is one hit; a player shot at or above `minChargeLevel`
 * breaks it outright. The reach rule is the scrap gate's (`isSaberInReach` in `roomLock.ts`),
 * measured to the wall's near face. Pure; the Phaser edge is `adapters/StageMechanicsAdapter.ts`.
 */
export type BreakableWallDefinition = {
  id: string
  /** Centre and size, world px (like a `wall` platform). */
  x: number
  y: number
  width: number
  height: number
  /** Saber cuts before it breaks (default 3). */
  hitsRequired?: number
  /** A shot at or above this charge level (1 to 4) breaks it outright (default 1: any charged shot). */
  minChargeLevel?: number
  color?: number
}

export type BreakableWallPhase = 'intact' | 'cracked' | 'broken'

export type BreakableWallState = {
  id: string
  phase: BreakableWallPhase
  hits: number
  hitsRequired: number
}

export type BreakableWallHit = { kind: 'saber' } | { kind: 'shot'; chargeLevel: number }

export function createBreakableWallState(definition: BreakableWallDefinition): BreakableWallState {
  return {
    id: definition.id,
    phase: 'intact',
    hits: 0,
    hitsRequired: Math.max(1, Math.floor(definition.hitsRequired ?? 3))
  }
}

export function wallBox(definition: BreakableWallDefinition): Box {
  return {
    left: definition.x - definition.width / 2,
    right: definition.x + definition.width / 2,
    top: definition.y - definition.height / 2,
    bottom: definition.y + definition.height / 2
  }
}

/** Uncharged shots do nothing; a cut adds one hit; a charged shot at the minimum breaks it. */
export function applyBreakableWallHit(
  definition: BreakableWallDefinition,
  state: BreakableWallState,
  hit: BreakableWallHit
): BreakableWallState {
  if (state.phase === 'broken') return state
  let hits = state.hits
  if (hit.kind === 'saber') hits += 1
  else if (hit.chargeLevel >= Math.max(1, definition.minChargeLevel ?? 1)) hits = state.hitsRequired
  else return state
  return { ...state, hits, phase: hits >= state.hitsRequired ? 'broken' : 'cracked' }
}

/** A cut lands when the hero faces the wall's near face from within reach and overlaps it vertically. */
export function isSaberReachingWall(
  hero: { x: number; top: number; bottom: number },
  facing: 1 | -1,
  wall: Box,
  reach = 44
): boolean {
  if (hero.bottom <= wall.top || hero.top >= wall.bottom) return false
  const face = facing > 0 ? wall.left : wall.right
  return isSaberInReach(hero.x, facing, face, reach)
}

/**
 * A moving shot reaches the wall within the next frame (the platform collider recycles shots on
 * contact, so the adapter counts the hit one frame ahead): its box swept by one frame's travel overlaps.
 */
export function shotReachesWall(shot: Box & { velocityX: number }, wall: Box, frameMs: number): boolean {
  const travel = (shot.velocityX * Math.max(0, frameMs)) / 1000
  const left = Math.min(shot.left, shot.left + travel) - 1
  const right = Math.max(shot.right, shot.right + travel) + 1
  return right > wall.left && left < wall.right && shot.bottom > wall.top && shot.top < wall.bottom
}

/** Crack stage for the tell: 0 intact, then 1 to 3 as hits land. */
export function breakableWallCrackStage(state: BreakableWallState): number {
  if (state.phase === 'broken') return 3
  return Math.min(2, Math.ceil((state.hits / state.hitsRequired) * 2))
}
