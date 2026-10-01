/**
 * `crumble_group` (prompt 02 §2.2, timings from the finish-plan card): a platform shakes for
 * `shakeMs` once the hero lands on it, then falls (no body), and returns `respawnMs` later once the
 * hero is not inside its box. Each platform of a group runs on its own; the group shares type,
 * timing and colour. A `stomp` group (12d Structural Works) ignores the hero and shakes when the
 * custodian walker stomps toward it; a group can name the solid ledges beside it that carry load lines.
 * Pure; the Phaser edge is `adapters/StageMechanicsAdapter.ts`.
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
  /**
   * What starts the shake: `land` (default) when the hero lands on it; `stomp` only when a stomper (the
   * custodian walker) stomps on the same floor facing it, within `stompReachPx`.
   */
  trigger?: 'land' | 'stomp'
  /** Stomp reach from the stomper's centre, px (default 176). */
  stompReachPx?: number
  /** Ids of the solid `midPlatforms` beside the group that carry load lines: the path that holds. */
  loadLines?: string[]
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
export const CRUMBLE_STOMP_REACH_PX = 176

export type CrumbleTiming = { shakeMs: number; respawnMs: number; trigger?: 'land' | 'stomp'; stompReachPx?: number }

export function crumbleTiming(group: CrumbleGroupDefinition): CrumbleTiming {
  return {
    shakeMs: Math.max(0, group.shakeMs ?? CRUMBLE_SHAKE_MS),
    respawnMs: Math.max(0, group.respawnMs ?? CRUMBLE_RESPAWN_MS),
    ...(group.trigger === 'stomp' ? { trigger: 'stomp' as const, stompReachPx: Math.max(0, group.stompReachPx ?? CRUMBLE_STOMP_REACH_PX) } : {})
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

/** One frame. Once shaking starts it runs out even if the hero jumps off. A `stomp` group shakes only when `stomped`. */
export function stepCrumble(
  state: CrumbleState,
  input: { heroStanding: boolean; heroOverlapping: boolean; deltaMs: number; stomped?: boolean },
  timing: Pick<CrumbleTiming, 'shakeMs' | 'respawnMs' | 'trigger'>
): CrumbleState {
  const deltaMs = Math.max(0, input.deltaMs)
  switch (state.phase) {
    case 'solid': {
      const start = timing.trigger === 'stomp' ? Boolean(input.stomped) : input.heroStanding
      return start ? { ...state, phase: 'shaking', timerMs: 0 } : state
    }
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

/** A stomp as the crumbles see it: where it landed, the floor it landed on, and the side it faces. */
export type CrumbleStomp = { x: number; floorTop: number; facing: 1 | -1 }

/** One enemy per frame, as the adapter reads it from the spawner: id, family, animation state, facing, body. */
export type CrumbleStomperSample = { id: string; typeKey: string; state: string; facing: 1 | -1; x: number; bottom: number }

/** The custodian walker family (its skins included) is the stomper. */
export function isCrumbleStomper(typeKey: string): boolean {
  return typeKey === 'custodian_walker' || typeKey.startsWith('custodian_walker_')
}

/**
 * Stomps this frame: a stomper entering `attack_active` (its stomp phase). `seen` holds each stomper's
 * last state and is updated in place; stompers that are gone are dropped from it.
 */
export function detectCrumbleStomps(seen: Map<string, string>, samples: readonly CrumbleStomperSample[]): CrumbleStomp[] {
  const stomps: CrumbleStomp[] = []
  const live = new Set<string>()
  for (const sample of samples) {
    if (!isCrumbleStomper(sample.typeKey)) continue
    live.add(sample.id)
    if (sample.state === 'attack_active' && seen.get(sample.id) !== 'attack_active') {
      stomps.push({ x: sample.x, floorTop: sample.bottom, facing: sample.facing })
    }
    seen.set(sample.id, sample.state)
  }
  for (const id of [...seen.keys()]) if (!live.has(id)) seen.delete(id)
  return stomps
}

/** The stomp shakes this platform: its top is the stomper's floor (within 6px), on the side faced, within reach. */
export function isStompedCrumble(box: Box, stomp: CrumbleStomp, reachPx = CRUMBLE_STOMP_REACH_PX): boolean {
  if (Math.abs(box.top - stomp.floorTop) > 6) return false
  if (stomp.facing > 0) return box.right > stomp.x && box.left <= stomp.x + reachPx
  return box.left < stomp.x && box.right >= stomp.x - reachPx
}

/** Load lines on a solid ledge: an amber rail along its top and a tick every 8px under it, whole pixels. */
export function loadLineMarks(box: Box): Array<{ x: number; y: number; width: number; height: number }> {
  const left = Math.round(box.left)
  const width = Math.max(0, Math.round(box.right) - left)
  if (width < 8) return []
  const top = Math.round(box.top)
  const marks = [{ x: left, y: top + 1, width, height: 1 }]
  for (let x = left + 3; x <= left + width - 5; x += 8) marks.push({ x, y: top + 2, width: 2, height: 3 })
  return marks
}
