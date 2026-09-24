import type { InputBindings } from '../input/ActionState'

/**
 * `room_lock` with `requiredInput` (prompt 05 §5.7, pulled forward from 06): a gate at the end of a
 * room that opens once the player performed the room's verb inside it. Pure state; the Phaser side
 * (gate body, camera lock, verb listening) lives in `adapters/RoomLockAdapter.ts`.
 */
export const ROOM_LOCK_INPUTS = ['jump', 'dash', 'wall_jump', 'charge', 'saber'] as const
export type RoomLockInput = (typeof ROOM_LOCK_INPUTS)[number]
export type RoomLockPhase = 'dormant' | 'locked' | 'open'

export type RoomRect = { x: number; y: number; width: number; height: number }

export type RoomLockDefinition = {
  id: string
  /** The room the camera locks to while the gate is closed; taller than a screen for the wall shaft. */
  room: RoomRect
  /** World x of the gate at the room's exit. */
  gateX: number
  requiredInput: RoomLockInput
  /** Saber only: hits on the breakable gate before it falls (default 1). */
  hitsRequired?: number
}

export type RoomLockState = {
  id: string
  phase: RoomLockPhase
  requiredInput: RoomLockInput
  progress: number
  hitsRequired: number
  /** The required input was performed while the lock was armed. */
  satisfied: boolean
}

export function createRoomLockState(definition: RoomLockDefinition): RoomLockState {
  return {
    id: definition.id,
    phase: 'dormant',
    requiredInput: definition.requiredInput,
    progress: 0,
    hitsRequired: Math.max(1, Math.floor(definition.hitsRequired ?? 1)),
    satisfied: false
  }
}

/** The player entered the room: a dormant lock closes behind its teaching prompt. */
export function armRoomLock(state: RoomLockState): RoomLockState {
  return state.phase === 'dormant' ? { ...state, phase: 'locked' } : state
}

/** Only the room's own verb, performed while armed, counts; the gate opens on the last required hit. */
export function applyRoomLockInput(state: RoomLockState, input: RoomLockInput): RoomLockState {
  if (state.phase !== 'locked' || input !== state.requiredInput) return state
  const progress = state.progress + 1
  const satisfied = progress >= state.hitsRequired
  return { ...state, progress, satisfied, phase: satisfied ? 'open' : 'locked' }
}

export function isInsideRoom(room: RoomRect, x: number): boolean {
  return x >= room.x && x < room.x + room.width
}

/** Index of the room containing `x`, or -1. */
export function findRoomIndex(definitions: readonly RoomLockDefinition[], x: number): number {
  return definitions.findIndex((definition) => isInsideRoom(definition.room, x))
}

/**
 * The room the camera is held to: the player's room while its gate is closed, and a room taller
 * than the screen for as long as the player is inside it (the shaft needs vertical scroll). -1
 * hands the camera back to the stage bounds.
 */
export function resolveCameraRoomIndex(
  definitions: readonly RoomLockDefinition[],
  states: readonly RoomLockState[],
  x: number,
  screenHeight: number
): number {
  const index = findRoomIndex(definitions, x)
  if (index < 0) return -1
  const tall = definitions[index].room.height > screenHeight
  return states[index]?.phase === 'locked' || tall ? index : -1
}

/** What the verbs need from the player runtime (`NewPlayerRuntime.getVerbSample()`), once per frame. */
export type RoomLockVerbSample = {
  grounded: boolean
  velocityY: number
  lastJumpSource: string
  dashStartedAtMs: number
  wallJumping: boolean
  projectileSpawnMs: number
  projectileChargeLevel: number
  /** Saber swings started since the runtime was created; counted by the runtime, so no swing is missed between samples. */
  slashesStarted: number
  /** Hurt lock (hitstun): an upward knockback is not a jump. */
  hurtLocked: boolean
}

/** Verb edges between two samples: a jump take-off, a dash start, a wall kick, a charged shot, a saber swing. */
export function detectRoomLockVerbs(prev: RoomLockVerbSample | null, next: RoomLockVerbSample): RoomLockInput[] {
  if (!prev) return []
  const verbs: RoomLockInput[] = []
  const jumpSourceChanged = next.lastJumpSource !== prev.lastJumpSource
  const groundTakeoff = prev.grounded && !next.grounded && next.velocityY < 0 && !next.hurtLocked
  if (groundTakeoff || (jumpSourceChanged && (next.lastJumpSource === 'ground' || next.lastJumpSource === 'coyote'))) {
    verbs.push('jump')
  }
  if (next.dashStartedAtMs > 0 && next.dashStartedAtMs !== prev.dashStartedAtMs) verbs.push('dash')
  if ((next.wallJumping && !prev.wallJumping) || (jumpSourceChanged && next.lastJumpSource === 'wall')) {
    verbs.push('wall_jump')
  }
  if (next.projectileSpawnMs !== prev.projectileSpawnMs && next.projectileChargeLevel >= 1) verbs.push('charge')
  for (let swing = prev.slashesStarted; swing < next.slashesStarted; swing += 1) verbs.push('saber')
  return verbs
}

/**
 * World ceiling (Arcade bounds top). Inside a room taller than the screen it rises to the room's top;
 * after the hero leaves that room it stays raised until the hero's body is back below the base ceiling
 * or grounded, so a hero leaving the shaft high is never snapped down by the bounds.
 */
export function resolveWorldCeiling(input: {
  baseTop: number
  currentTop: number
  tallRoomTop: number | null
  heroTop: number
  grounded: boolean
}): number {
  if (input.tallRoomTop !== null) return Math.min(input.baseTop, input.tallRoomTop)
  const raised = input.currentTop < input.baseTop
  if (raised && input.heroTop < input.baseTop && !input.grounded) return input.currentTop
  return input.baseTop
}

/** A saber swing lands on the breakable gate when the player faces it from within reach. */
export function isSaberInReach(playerX: number, facing: 1 | -1, gateX: number, reach = 44): boolean {
  const dx = gateX - playerX
  return Math.sign(dx) === facing && Math.abs(dx) <= reach
}

/** `KeyZ` -> `Z`, `Space` -> `SPACE`, `ArrowUp` -> `UP`, `Digit1` -> `1`. */
export function formatKeyCode(code: string): string {
  const label = code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace(/^Numpad/, 'NUM ')
  return label.toUpperCase()
}

/** The lane's key hint (UI, never dialogue), named from the current bindings. */
export function roomLockKeyHint(input: RoomLockInput, bindings: InputBindings): string {
  const key = (action: keyof InputBindings) => formatKeyCode(bindings[action]?.[0] ?? '?')
  switch (input) {
    case 'jump':
      return `JUMP: ${key('jump')}`
    case 'dash':
      return `DASH: ${key('dash')}`
    case 'wall_jump':
      return 'WALL: JUMP OFF THE WALL'
    case 'charge':
      return `HOLD ${key('shoot')} TO CHARGE`
    case 'saber':
      return `SABER: ${key('saber')}`
  }
}
