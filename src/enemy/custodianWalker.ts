import type { EnemyState } from './types'

/**
 * The custodian walker (Heat Works mini-boss, EVAL-P6-005): a pure state machine, stepped by
 * `CustodianWalkerBrain`. It walks its floor toward the hero and turns at ledges and walls; in range it
 * raises a leg (the tell), stomps (two ground shockwaves), recovers with its back exposed, and only then
 * turns to face the hero: "it stomps before it turns". Below half HP it winds up and walks faster.
 */
export const CUSTODIAN_TUNING = {
  aggroRangeX: 360,
  aggroRangeY: 120,
  walkSpeed: 36,
  enragedWalkSpeed: 48,
  /** Stomp when the hero is this close (either side: the waves run both ways). */
  stompRangeX: 96,
  stompRangeY: 72,
  /** Held at a ledge or wall, it stomps at a hero this far away (the wave reaches). */
  blockedStompRangeX: 224,
  windupMs: 500,
  enragedWindupMs: 320,
  stompMs: 250,
  recoveryMs: 700,
  turnMs: 220,
  /** Walking time after a stomp before the next wind-up. */
  stompCooldownMs: 800,
  enragedStompCooldownMs: 500,
  /** The first wind-up waits this long after it wakes. */
  aggroCooldownMs: 400,
  /** A hero behind it this long, out of stomp range, makes it turn while walking. */
  behindTurnMs: 900,
  enrageBelowHpFraction: 0.5,
  /** Four death frames at 8 fps. */
  deathMs: 500
} as const

export type CustodianPhase = 'dormant' | 'walk' | 'windup' | 'stomp' | 'recover' | 'turn' | 'dying' | 'gone'

export type CustodianEvent = 'aggro' | 'windup' | 'stomp' | 'turn' | 'defeated'

export interface CustodianState {
  phase: CustodianPhase
  facing: 1 | -1
  phaseMs: number
  cooldownMs: number
  behindMs: number
  /** The wind-up length chosen when this wind-up began (shorter when enraged). */
  windupMs: number
  stomps: number
}

export interface CustodianInput {
  dtMs: number
  /** Hero x minus walker x. */
  dx: number
  /** Hero y minus walker y. */
  dy: number
  hpFraction: number
  /** One more step in `facing` would leave the floor, meet a wall or leave the patrol bounds. */
  blockedAhead: boolean
}

export interface CustodianStep {
  state: CustodianState
  velocityX: number
  /** The generic enemy state the animator and debug readers see. */
  animState: EnemyState
  events: CustodianEvent[]
}

export function createCustodianState(facing: 1 | -1 = -1): CustodianState {
  return { phase: 'dormant', facing, phaseMs: 0, cooldownMs: 0, behindMs: 0, windupMs: CUSTODIAN_TUNING.windupMs, stomps: 0 }
}

export function isCustodianEnraged(hpFraction: number): boolean {
  return hpFraction < CUSTODIAN_TUNING.enrageBelowHpFraction
}

/** The kill: the death frames play, then `defeated` fires once. */
export function killCustodian(state: CustodianState): CustodianState {
  if (state.phase === 'dying' || state.phase === 'gone') {
    return state
  }
  return { ...state, phase: 'dying', phaseMs: 0 }
}

const ANIM_STATE: Record<CustodianPhase, EnemyState> = {
  dormant: 'idle',
  walk: 'chase',
  windup: 'attack_windup',
  stomp: 'attack_active',
  recover: 'attack_recover',
  turn: 'alert',
  dying: 'dead',
  gone: 'dead'
}

function enter(state: CustodianState, phase: CustodianPhase, patch: Partial<CustodianState> = {}): CustodianState {
  return { ...state, ...patch, phase, phaseMs: 0 }
}

export function stepCustodian(previous: CustodianState, input: CustodianInput): CustodianStep {
  const t = CUSTODIAN_TUNING
  const events: CustodianEvent[] = []
  const enraged = isCustodianEnraged(input.hpFraction)
  const heroSide: 1 | -1 = input.dx >= 0 ? 1 : -1
  const absDx = Math.abs(input.dx)
  const absDy = Math.abs(input.dy)
  let state: CustodianState = { ...previous, phaseMs: previous.phaseMs + input.dtMs }
  let velocityX = 0

  switch (state.phase) {
    case 'dormant':
      if (absDx <= t.aggroRangeX && absDy <= t.aggroRangeY) {
        state = enter(state, 'walk', { facing: heroSide, cooldownMs: t.aggroCooldownMs, behindMs: 0 })
        events.push('aggro')
      }
      break
    case 'walk': {
      const cooldownMs = Math.max(0, state.cooldownMs - input.dtMs)
      const behind = heroSide !== state.facing && absDx > 8
      const behindMs = behind ? state.behindMs + input.dtMs : 0
      state = { ...state, cooldownMs, behindMs }
      const inRange = absDx <= t.stompRangeX && absDy <= t.stompRangeY
      const reachFromEdge = input.blockedAhead && absDx <= t.blockedStompRangeX && absDy <= t.stompRangeY
      if (cooldownMs <= 0 && (inRange || reachFromEdge)) {
        state = enter(state, 'windup', { windupMs: enraged ? t.enragedWindupMs : t.windupMs })
        events.push('windup')
      } else if (input.blockedAhead || behindMs >= t.behindTurnMs) {
        state = enter(state, 'turn')
      } else {
        velocityX = state.facing * (enraged ? t.enragedWalkSpeed : t.walkSpeed)
      }
      break
    }
    case 'windup':
      if (state.phaseMs >= state.windupMs) {
        state = enter(state, 'stomp', { stomps: state.stomps + 1 })
        events.push('stomp')
      }
      break
    case 'stomp':
      if (state.phaseMs >= t.stompMs) {
        state = enter(state, 'recover')
      }
      break
    case 'recover':
      if (state.phaseMs >= t.recoveryMs) {
        const cooldownMs = enraged ? t.enragedStompCooldownMs : t.stompCooldownMs
        state = heroSide !== state.facing
          ? enter(state, 'turn', { cooldownMs, behindMs: 0 })
          : enter(state, 'walk', { cooldownMs, behindMs: 0 })
      }
      break
    case 'turn':
      if (state.phaseMs >= t.turnMs) {
        state = enter(state, 'walk', { facing: state.facing === 1 ? -1 : 1, behindMs: 0 })
        events.push('turn')
      }
      break
    case 'dying':
      if (state.phaseMs >= t.deathMs) {
        state = enter(state, 'gone')
        events.push('defeated')
      }
      break
    case 'gone':
      break
  }

  return { state, velocityX, animState: ANIM_STATE[state.phase], events }
}
