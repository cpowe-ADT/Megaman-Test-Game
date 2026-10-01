import type { EnemyState } from './types'

/**
 * The drill serpent (Mire mini-boss; 12c, EVAL-P6-005): a pure state machine stepped by
 * `DrillSerpentBrain`. Two attacks, alternating. It burrows (its move frames: sink, drill tip, flat
 * mound) and travels under the floor toward the hero; a small shaking mound at the surface (the tell,
 * 500 ms) marks where it bursts up, under or beside the hero. Then a coiled lunge along the floor (the
 * wind-up frames, then the active frames). It cannot be hurt while burrowed (burrow, tunnel, mound).
 */
export const DRILL_SERPENT_TUNING = {
  aggroRangeX: 360,
  aggroRangeY: 140,
  aggroCooldownMs: 500,
  /** Surfaced and facing the hero between attacks. */
  surfaceCooldownMs: 700,
  /** Three burrow frames at 8 fps. */
  burrowMs: 375,
  tunnelSpeed: 200,
  tunnelMinMs: 300,
  tunnelMaxMs: 2000,
  /** The tell: the mound shakes where it will come up. */
  moundMs: 500,
  burstMs: 375,
  burstRecoverMs: 800,
  /** The lunge's tell: three coil frames at 6 fps. */
  coilMs: 500,
  lungeSpeed: 260,
  lungeMs: 450,
  lungeRecoverMs: 700,
  /** Under the hero when this close (the last step is capped, so it lands on the spot). */
  arriveDeadZoneX: 1,
  /** Four death frames at 8 fps. */
  deathMs: 500
} as const

export type SerpentPhase =
  | 'dormant'
  | 'surface'
  | 'burrow'
  | 'tunnel'
  | 'mound'
  | 'burst'
  | 'coil'
  | 'lunge'
  | 'recover'
  | 'dying'
  | 'gone'

export type SerpentAttack = 'burrow' | 'lunge'
export type SerpentEvent = 'aggro' | 'burrow' | 'mound' | 'burst' | 'coil' | 'lunge' | 'defeated'

export interface SerpentState {
  phase: SerpentPhase
  facing: 1 | -1
  phaseMs: number
  cooldownMs: number
  /** The recovery length chosen when this recovery began. */
  recoverMs: number
  nextAttack: SerpentAttack
  /** Where the mound came up (null until the first one). */
  moundX: number | null
  burrows: number
  bursts: number
  lunges: number
}

export interface SerpentInput {
  dtMs: number
  /** Hero x minus serpent x. */
  dx: number
  /** Hero y minus serpent y. */
  dy: number
  /** The serpent's x (under the floor too). */
  x: number
  /** Its room: the tunnel and the lunge stay inside. */
  bounds?: { minX: number; maxX: number }
  /** One more step in `facing` would leave the floor, meet a wall or leave the bounds. */
  blockedAhead: boolean
}

export interface SerpentStep {
  state: SerpentState
  velocityX: number
  animState: EnemyState
  events: SerpentEvent[]
}

export function createSerpentState(facing: 1 | -1 = -1): SerpentState {
  return {
    phase: 'dormant',
    facing,
    phaseMs: 0,
    cooldownMs: 0,
    recoverMs: DRILL_SERPENT_TUNING.burstRecoverMs,
    nextAttack: 'burrow',
    moundX: null,
    burrows: 0,
    bursts: 0,
    lunges: 0
  }
}

/** Burrowing, tunnelling or under its mound: no body, no damage taken. */
export function isSerpentUnderground(phase: SerpentPhase): boolean {
  return phase === 'burrow' || phase === 'tunnel' || phase === 'mound'
}

/**
 * Frames beyond the animator's set, cut from the move group (sink, drill tip, flat mound, emerging):
 * the dive, the shaking mound (flat mound and drill tip in turn) and the burst back up. The brain makes
 * them as `<typeKey>_<suffix>` from `atlas_<typeKey>`.
 */
export const SERPENT_ANIMATIONS = {
  burrow: { frames: ['run/000', 'run/001', 'run/002'], frameRate: 8, repeat: 0 },
  mound: { frames: ['run/002', 'run/001'], frameRate: 12, repeat: -1 },
  emerge: { frames: ['run/003', 'idle/000', 'idle/001'], frameRate: 8, repeat: 0 }
} as const

/** The frames a phase shows beyond the animator's usual set (`<typeKey>_<suffix>`), or null. */
export function serpentAnimationSuffix(phase: SerpentPhase): 'burrow' | 'mound' | 'emerge' | null {
  return phase === 'burrow' ? 'burrow' : phase === 'mound' ? 'mound' : phase === 'burst' ? 'emerge' : null
}

export function killSerpent(state: SerpentState): SerpentState {
  if (state.phase === 'dying' || state.phase === 'gone') {
    return state
  }
  return { ...state, phase: 'dying', phaseMs: 0 }
}

const ANIM_STATE: Record<SerpentPhase, EnemyState> = {
  dormant: 'idle',
  surface: 'idle',
  burrow: 'retreat',
  tunnel: 'retreat',
  mound: 'alert',
  burst: 'attack_active',
  coil: 'attack_windup',
  lunge: 'attack_active',
  recover: 'attack_recover',
  dying: 'dead',
  gone: 'dead'
}

function enter(state: SerpentState, phase: SerpentPhase, patch: Partial<SerpentState> = {}): SerpentState {
  return { ...state, ...patch, phase, phaseMs: 0 }
}

export function stepSerpent(previous: SerpentState, input: SerpentInput): SerpentStep {
  const t = DRILL_SERPENT_TUNING
  const events: SerpentEvent[] = []
  const heroSide: 1 | -1 = input.dx >= 0 ? 1 : -1
  let state: SerpentState = { ...previous, phaseMs: previous.phaseMs + input.dtMs }
  let velocityX = 0

  switch (state.phase) {
    case 'dormant':
      if (Math.abs(input.dx) <= t.aggroRangeX && Math.abs(input.dy) <= t.aggroRangeY) {
        state = enter(state, 'surface', { facing: heroSide, cooldownMs: t.aggroCooldownMs })
        events.push('aggro')
      }
      break
    case 'surface': {
      const cooldownMs = Math.max(0, state.cooldownMs - input.dtMs)
      state = { ...state, cooldownMs, facing: heroSide }
      if (cooldownMs <= 0 && state.nextAttack === 'burrow') {
        state = enter(state, 'burrow', { burrows: state.burrows + 1 })
        events.push('burrow')
      } else if (cooldownMs <= 0) {
        state = enter(state, 'coil')
        events.push('coil')
      }
      break
    }
    case 'burrow':
      if (state.phaseMs >= t.burrowMs) {
        state = enter(state, 'tunnel')
      }
      break
    case 'tunnel': {
      const heroX = input.x + input.dx
      const targetX = input.bounds ? Math.max(input.bounds.minX, Math.min(input.bounds.maxX, heroX)) : heroX
      const gap = targetX - input.x
      const arrived = Math.abs(gap) <= t.arriveDeadZoneX
      if ((arrived && state.phaseMs >= t.tunnelMinMs) || state.phaseMs >= t.tunnelMaxMs) {
        state = enter(state, 'mound', { moundX: input.x, facing: heroSide })
        events.push('mound')
      } else if (!arrived) {
        // Never overshoot the hero in one step.
        const speed = Math.min(t.tunnelSpeed, (Math.abs(gap) * 1000) / Math.max(1, input.dtMs))
        velocityX = Math.sign(gap) * speed
        state = { ...state, facing: gap >= 0 ? 1 : -1 }
      }
      break
    }
    case 'mound':
      if (state.phaseMs >= t.moundMs) {
        state = enter(state, 'burst', { facing: heroSide })
        events.push('burst')
      }
      break
    case 'burst':
      if (state.phaseMs >= t.burstMs) {
        state = enter(state, 'recover', { recoverMs: t.burstRecoverMs, nextAttack: 'lunge', bursts: state.bursts + 1 })
      }
      break
    case 'coil':
      if (state.phaseMs >= t.coilMs) {
        state = enter(state, 'lunge')
        events.push('lunge')
      }
      break
    case 'lunge':
      if (input.blockedAhead || state.phaseMs >= t.lungeMs) {
        state = enter(state, 'recover', { recoverMs: t.lungeRecoverMs, nextAttack: 'burrow', lunges: state.lunges + 1 })
      } else {
        velocityX = state.facing * t.lungeSpeed
      }
      break
    case 'recover':
      if (state.phaseMs >= state.recoverMs) {
        state = enter(state, 'surface', { cooldownMs: t.surfaceCooldownMs })
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
