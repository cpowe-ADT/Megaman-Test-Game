import type { EnemyState } from './types'

/**
 * The relay turret nest (Tide mini-boss; Ferro skin; 12c, EVAL-P6-005): a pure state machine, stepped by
 * `RelayTurretNestBrain`. Mostly stationary, it shuffles a little on its legs around its home spot and
 * turns to face the hero between attacks. Two attacks, alternating: an aimed three-shot burst after a
 * barrel-glow wind-up (the tell, its three wind-up frames), then a lobbed mortar shell that lands where
 * the hero stood, over a floor marker (`mortarShell.ts`).
 */
export const RELAY_NEST_TUNING = {
  aggroRangeX: 360,
  aggroRangeY: 140,
  /** It shuffles this far either side of home, at this speed. */
  shuffleRangeX: 12,
  shuffleSpeed: 16,
  turnMs: 240,
  /** The barrel-glow tell before the burst: three wind-up frames at 5 fps. */
  burstWindupMs: 600,
  burstShots: 3,
  burstSpacingMs: 150,
  burstMs: 450,
  /** The mortar's wind-up plays the same frames faster. */
  mortarWindupMs: 500,
  mortarFireMs: 250,
  recoveryMs: 700,
  /** Shuffling time between the recovery and the next wind-up. */
  cooldownMs: 900,
  aggroCooldownMs: 500,
  /** A hero this far behind it makes it turn. */
  behindDeadZoneX: 8,
  /** Four death frames at 8 fps. */
  deathMs: 500
} as const

export type RelayNestPhase =
  | 'dormant'
  | 'shuffle'
  | 'turn'
  | 'burst_windup'
  | 'burst'
  | 'mortar_windup'
  | 'mortar'
  | 'recover'
  | 'dying'
  | 'gone'

export type RelayNestAttack = 'burst' | 'mortar'

export type RelayNestEvent = 'aggro' | 'burst_windup' | 'shot' | 'mortar_windup' | 'mortar' | 'turn' | 'defeated'

export interface RelayNestState {
  phase: RelayNestPhase
  facing: 1 | -1
  phaseMs: number
  cooldownMs: number
  nextAttack: RelayNestAttack
  /** Which way the shuffle steps (independent of facing: it backs up too). */
  shuffleDir: 1 | -1
  /** Shots fired in the current burst. */
  burstShotsFired: number
  shots: number
  bursts: number
  mortars: number
  turns: number
}

export interface RelayNestInput {
  dtMs: number
  /** Hero x minus nest x. */
  dx: number
  /** Hero y minus nest y. */
  dy: number
  /** Nest x minus its home x (where it first stood). */
  offsetX: number
  /** One more step in `shuffleDir` would leave the floor, meet a wall or leave the bounds. */
  blockedShuffle: boolean
}

export interface RelayNestStep {
  state: RelayNestState
  velocityX: number
  animState: EnemyState
  events: RelayNestEvent[]
}

export function createRelayNestState(facing: 1 | -1 = -1): RelayNestState {
  return {
    phase: 'dormant',
    facing,
    phaseMs: 0,
    cooldownMs: 0,
    nextAttack: 'burst',
    shuffleDir: facing,
    burstShotsFired: 0,
    shots: 0,
    bursts: 0,
    mortars: 0,
    turns: 0
  }
}

export function killRelayNest(state: RelayNestState): RelayNestState {
  if (state.phase === 'dying' || state.phase === 'gone') {
    return state
  }
  return { ...state, phase: 'dying', phaseMs: 0 }
}

/** The wind-up art is tuned to the burst's 600 ms; the mortar's shorter wind-up plays it faster. */
export function relayNestWindupTimeScale(state: Pick<RelayNestState, 'phase'>): number {
  return state.phase === 'mortar_windup' ? RELAY_NEST_TUNING.burstWindupMs / RELAY_NEST_TUNING.mortarWindupMs : 1
}

const ANIM_STATE: Record<RelayNestPhase, EnemyState> = {
  dormant: 'idle',
  shuffle: 'patrol',
  turn: 'alert',
  burst_windup: 'attack_windup',
  burst: 'attack_active',
  mortar_windup: 'attack_windup',
  mortar: 'attack_active',
  recover: 'attack_recover',
  dying: 'dead',
  gone: 'dead'
}

function enter(state: RelayNestState, phase: RelayNestPhase, patch: Partial<RelayNestState> = {}): RelayNestState {
  return { ...state, ...patch, phase, phaseMs: 0 }
}

export function stepRelayNest(previous: RelayNestState, input: RelayNestInput): RelayNestStep {
  const t = RELAY_NEST_TUNING
  const events: RelayNestEvent[] = []
  const heroSide: 1 | -1 = input.dx >= 0 ? 1 : -1
  const heroBehind = heroSide !== previous.facing && Math.abs(input.dx) > t.behindDeadZoneX
  let state: RelayNestState = { ...previous, phaseMs: previous.phaseMs + input.dtMs }
  let velocityX = 0

  switch (state.phase) {
    case 'dormant':
      if (Math.abs(input.dx) <= t.aggroRangeX && Math.abs(input.dy) <= t.aggroRangeY) {
        state = enter(state, 'shuffle', { facing: heroSide, shuffleDir: heroSide, cooldownMs: t.aggroCooldownMs })
        events.push('aggro')
      }
      break
    case 'shuffle': {
      const cooldownMs = Math.max(0, state.cooldownMs - input.dtMs)
      state = { ...state, cooldownMs }
      if (heroBehind) {
        state = enter(state, 'turn')
      } else if (cooldownMs <= 0) {
        const attack = state.nextAttack
        state = enter(state, attack === 'burst' ? 'burst_windup' : 'mortar_windup', { burstShotsFired: 0 })
        events.push(attack === 'burst' ? 'burst_windup' : 'mortar_windup')
      } else {
        const out = (state.shuffleDir > 0 && input.offsetX >= t.shuffleRangeX) || (state.shuffleDir < 0 && input.offsetX <= -t.shuffleRangeX)
        const shuffleDir: 1 | -1 = out || input.blockedShuffle ? (state.shuffleDir > 0 ? -1 : 1) : state.shuffleDir
        state = { ...state, shuffleDir }
        velocityX = shuffleDir * t.shuffleSpeed
      }
      break
    }
    case 'turn':
      if (state.phaseMs >= t.turnMs) {
        state = enter(state, 'shuffle', { facing: state.facing > 0 ? -1 : 1, turns: state.turns + 1 })
        events.push('turn')
      }
      break
    case 'burst_windup':
      if (state.phaseMs >= t.burstWindupMs) {
        // The first shot leaves as the glow peaks; the other two follow `burstSpacingMs` apart.
        state = enter(state, 'burst', { burstShotsFired: 1, shots: state.shots + 1 })
        events.push('shot')
      }
      break
    case 'burst': {
      let fired = state.burstShotsFired
      let shots = state.shots
      while (fired < t.burstShots && state.phaseMs >= fired * t.burstSpacingMs) {
        fired += 1
        shots += 1
        events.push('shot')
      }
      state = { ...state, burstShotsFired: fired, shots }
      if (state.phaseMs >= t.burstMs && fired >= t.burstShots) {
        state = enter(state, 'recover', { bursts: state.bursts + 1, nextAttack: 'mortar' })
      }
      break
    }
    case 'mortar_windup':
      if (state.phaseMs >= t.mortarWindupMs) {
        state = enter(state, 'mortar', { mortars: state.mortars + 1 })
        events.push('mortar')
      }
      break
    case 'mortar':
      if (state.phaseMs >= t.mortarFireMs) {
        state = enter(state, 'recover', { nextAttack: 'burst' })
      }
      break
    case 'recover':
      if (state.phaseMs >= t.recoveryMs) {
        state = heroBehind ? enter(state, 'turn', { cooldownMs: t.cooldownMs }) : enter(state, 'shuffle', { cooldownMs: t.cooldownMs })
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
