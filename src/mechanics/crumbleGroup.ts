/**
 * `crumble_group` (prompt 02 §2.2, timings from the finish-plan card): a platform shakes for
 * `shakeMs` once the hero lands on it, then falls (no body), and returns `respawnMs` later once the
 * hero is not inside its box. Each platform of a group runs on its own; the group shares type,
 * timing and colour. Pure; the Phaser edge is `adapters/StageMechanicsAdapter.ts`.
 */
export type CrumblePlatformDefinition = {
  id: string
  /** Centre, world px (like `midPlatforms`). */
  x: number
  y: number
  width: number
  /** Default 8. */
  height?: number
}

export type CrumbleGroupDefinition = {
  id: string
  platforms: CrumblePlatformDefinition[]
  /** Default `oneWay`. */
  type?: 'oneWay' | 'solid'
  /** Shake before the fall, ms (default 400). */
  shakeMs?: number
  /** Time fallen before it returns, ms (default 3000). */
  respawnMs?: number
  color?: number
}

export type CrumblePhase = 'solid' | 'shaking' | 'fallen'

export type CrumbleState = {
  id: string
  groupId: string
  phase: CrumblePhase
  /** Time in the current phase, ms. */
  timerMs: number
}

export type Box = { left: number; right: number; top: number; bottom: number }

export const CRUMBLE_SHAKE_MS = 400
export const CRUMBLE_RESPAWN_MS = 3000
export const CRUMBLE_DEFAULT_HEIGHT = 8

export function crumbleTiming(group: CrumbleGroupDefinition): { shakeMs: number; respawnMs: number } {
  return {
    shakeMs: Math.max(0, group.shakeMs ?? CRUMBLE_SHAKE_MS),
    respawnMs: Math.max(0, group.respawnMs ?? CRUMBLE_RESPAWN_MS)
  }
}

export function createCrumbleStates(group: CrumbleGroupDefinition): CrumbleState[] {
  return group.platforms.map((platform) => ({ id: platform.id, groupId: group.id, phase: 'solid', timerMs: 0 }))
}

export function crumbleBox(platform: CrumblePlatformDefinition): Box {
  const height = platform.height ?? CRUMBLE_DEFAULT_HEIGHT
  return {
    left: platform.x - platform.width / 2,
    right: platform.x + platform.width / 2,
    top: platform.y - height / 2,
    bottom: platform.y + height / 2
  }
}

/** The hero stands on the box: grounded, horizontally over it, feet within `tolerancePx` of its top. */
export function isStandingOn(hero: Box, box: Box, grounded: boolean, tolerancePx = 3): boolean {
  if (!grounded) return false
  const overlapsX = hero.right > box.left + 1 && hero.left < box.right - 1
  return overlapsX && Math.abs(hero.bottom - box.top) <= tolerancePx
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
}

/** One frame. Once shaking starts it runs out even if the hero jumps off. */
export function stepCrumble(
  state: CrumbleState,
  input: { heroStanding: boolean; heroOverlapping: boolean; deltaMs: number },
  timing: { shakeMs: number; respawnMs: number }
): CrumbleState {
  const deltaMs = Math.max(0, input.deltaMs)
  switch (state.phase) {
    case 'solid':
      return input.heroStanding ? { ...state, phase: 'shaking', timerMs: 0 } : state
    case 'shaking': {
      const timerMs = state.timerMs + deltaMs
      return timerMs >= timing.shakeMs ? { ...state, phase: 'fallen', timerMs: 0 } : { ...state, timerMs }
    }
    case 'fallen': {
      const timerMs = state.timerMs + deltaMs
      if (timerMs >= timing.respawnMs && !input.heroOverlapping) return { ...state, phase: 'solid', timerMs: 0 }
      return { ...state, timerMs }
    }
  }
}

/** The shake tell: a whole-pixel sideways jitter, 0 when not shaking. */
export function crumbleShakeOffset(state: CrumbleState): number {
  if (state.phase !== 'shaking') return 0
  return Math.floor(state.timerMs / 40) % 2 === 0 ? 1 : -1
}
