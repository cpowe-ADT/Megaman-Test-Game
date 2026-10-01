/**
 * The sentry twins (Volt mini-boss; Gale skin; 12c, EVAL-P6-005): two `sentry_twin` drones sharing one
 * health pool, a pure state machine stepped by `SentryTwinsBrain`. Each round one twin is the shooter and
 * the other the swooper: the shooter's lens crackles (the tell, its three wind-up frames) and it fires an
 * electric bolt at the hero; then the swooper drops from its perch to the hero's height, holds under a
 * warning flash, dashes across the room, rises and flies home. Roles swap after each round; defeating the
 * pool defeats both. Twin 0 is the marker's own sprite and starts as the shooter.
 */
export const SENTRY_TWINS_TUNING = {
  aggroRangeX: 360,
  aggroRangeY: 200,
  /** Hover between rounds (and after waking). */
  gapMs: 500,
  /** Three wind-up frames at 5 fps. */
  boltWindupMs: 600,
  boltMs: 300,
  lineUpMs: 400,
  flashMs: 450,
  swoopSpeed: 320,
  /** The dash stops this far short of the other twin's perch, so it never rises into it. */
  swoopStopShortX: 64,
  riseMs: 250,
  returnSpeed: 220,
  /** The dash line stays this far over the floor and this far under the perches. */
  floorClearance: 16,
  perchClearance: 24,
  /** Four death frames at 8 fps. */
  deathMs: 500
} as const

export type TwinsPhase =
  | 'dormant'
  | 'gap'
  | 'bolt_windup'
  | 'bolt'
  | 'line_up'
  | 'flash'
  | 'swoop'
  | 'rise'
  | 'return'
  | 'dying'
  | 'gone'

export type TwinsEvent = 'aggro' | 'bolt_windup' | 'bolt' | 'flash' | 'swoop' | 'swap' | 'defeated'
export type TwinIndex = 0 | 1
export type TwinPoseName = 'hover' | 'dash' | 'windup' | 'fire' | 'dead'

export interface TwinPoint {
  x: number
  y: number
}

export interface TwinPose extends TwinPoint {
  facing: 1 | -1
  pose: TwinPoseName
}

export interface TwinsState {
  phase: TwinsPhase
  phaseMs: number
  /** The twin that fires this round; the other swoops. */
  shooter: TwinIndex
  perches: readonly [TwinPoint, TwinPoint]
  /** Where the swooper is (its perch until it lines up). */
  swooper: TwinPoint
  /** The dash height, chosen from the hero's height when the line-up starts. */
  lineY: number
  bolts: number
  swoops: number
  rounds: number
}

export interface TwinsInput {
  dtMs: number
  heroX: number
  heroY: number
  /** The room's floor top under the dash line. */
  floorTop: number
}

export interface TwinsStep {
  state: TwinsState
  poses: [TwinPose, TwinPose]
  events: TwinsEvent[]
}

export function createTwinsState(perches: readonly [TwinPoint, TwinPoint]): TwinsState {
  return {
    phase: 'dormant',
    phaseMs: 0,
    shooter: 0,
    perches,
    swooper: { ...perches[1] },
    lineY: perches[1].y,
    bolts: 0,
    swoops: 0,
    rounds: 0
  }
}

export function swooperOf(state: Pick<TwinsState, 'shooter'>): TwinIndex {
  return state.shooter === 0 ? 1 : 0
}

/** The dash height: the hero's, kept over the floor and under the perches. */
export function twinsDashLine(heroY: number, perchY: number, floorTop: number): number {
  const t = SENTRY_TWINS_TUNING
  return Math.max(perchY + t.perchClearance, Math.min(heroY, floorTop - t.floorClearance))
}

/** Where the swooper's dash ends: across the room, short of the shooter's perch. */
export function twinsSwoopEndX(state: Pick<TwinsState, 'shooter' | 'perches'>): number {
  const from = state.perches[swooperOf(state)].x
  const to = state.perches[state.shooter].x
  const dir = to >= from ? 1 : -1
  return to - dir * SENTRY_TWINS_TUNING.swoopStopShortX
}

export function killTwins(state: TwinsState): TwinsState {
  if (state.phase === 'dying' || state.phase === 'gone') {
    return state
  }
  return { ...state, phase: 'dying', phaseMs: 0 }
}

function enter(state: TwinsState, phase: TwinsPhase, patch: Partial<TwinsState> = {}): TwinsState {
  return { ...state, ...patch, phase, phaseMs: 0 }
}

const easeOut = (p: number) => 1 - (1 - p) * (1 - p)

function moveToward(from: number, to: number, speed: number, dtMs: number): number {
  const stepPx = (speed * dtMs) / 1000
  return Math.abs(to - from) <= stepPx ? to : from + Math.sign(to - from) * stepPx
}

export function stepTwins(previous: TwinsState, input: TwinsInput): TwinsStep {
  const t = SENTRY_TWINS_TUNING
  const events: TwinsEvent[] = []
  let state: TwinsState = { ...previous, phaseMs: previous.phaseMs + input.dtMs }
  const swooper = swooperOf(state)
  const home = state.perches[swooper]

  switch (state.phase) {
    case 'dormant': {
      const midX = (state.perches[0].x + state.perches[1].x) / 2
      if (Math.abs(input.heroX - midX) <= t.aggroRangeX && Math.abs(input.heroY - home.y) <= t.aggroRangeY) {
        state = enter(state, 'gap', { swooper: { ...home } })
        events.push('aggro')
      }
      break
    }
    case 'gap':
      if (state.phaseMs >= t.gapMs) {
        state = enter(state, 'bolt_windup')
        events.push('bolt_windup')
      }
      break
    case 'bolt_windup':
      if (state.phaseMs >= t.boltWindupMs) {
        state = enter(state, 'bolt', { bolts: state.bolts + 1 })
        events.push('bolt')
      }
      break
    case 'bolt':
      if (state.phaseMs >= t.boltMs) {
        state = enter(state, 'line_up', { swooper: { ...home }, lineY: twinsDashLine(input.heroY, home.y, input.floorTop) })
      }
      break
    case 'line_up': {
      const p = Math.min(1, state.phaseMs / t.lineUpMs)
      state = { ...state, swooper: { x: home.x, y: home.y + (state.lineY - home.y) * easeOut(p) } }
      if (p >= 1) {
        state = enter(state, 'flash', { swooper: { x: home.x, y: state.lineY } })
        events.push('flash')
      }
      break
    }
    case 'flash':
      if (state.phaseMs >= t.flashMs) {
        state = enter(state, 'swoop', { swoops: state.swoops + 1 })
        events.push('swoop')
      }
      break
    case 'swoop': {
      const endX = twinsSwoopEndX(state)
      const x = moveToward(state.swooper.x, endX, t.swoopSpeed, input.dtMs)
      state = { ...state, swooper: { x, y: state.lineY } }
      if (x === endX) {
        state = enter(state, 'rise')
      }
      break
    }
    case 'rise': {
      const p = Math.min(1, state.phaseMs / t.riseMs)
      state = { ...state, swooper: { x: state.swooper.x, y: state.lineY + (home.y - state.lineY) * p } }
      if (p >= 1) {
        state = enter(state, 'return')
      }
      break
    }
    case 'return': {
      const x = moveToward(state.swooper.x, home.x, t.returnSpeed, input.dtMs)
      state = { ...state, swooper: { x, y: home.y } }
      if (x === home.x) {
        const next = state.shooter
        state = enter(state, 'gap', { shooter: swooper, swooper: { ...state.perches[next] }, rounds: state.rounds + 1 })
        events.push('swap')
      }
      break
    }
    case 'dying':
      if (state.phaseMs >= t.deathMs) {
        state = enter(state, 'gone')
        events.push('defeated')
      }
      break
    case 'gone':
      break
  }

  return { state, poses: twinsPoses(state, input.heroX), events }
}

/** Where each twin is, which way it faces and which frames it shows. */
export function twinsPoses(state: TwinsState, heroX: number): [TwinPose, TwinPose] {
  const swooper = swooperOf(state)
  const dead = state.phase === 'dying' || state.phase === 'gone'
  const pose = (index: TwinIndex): TwinPose => {
    const shooting = index === state.shooter
    const at = shooting ? state.perches[index] : state.swooper
    const towardHero: 1 | -1 = heroX >= at.x ? 1 : -1
    if (dead) {
      return { ...at, facing: towardHero, pose: 'dead' }
    }
    if (shooting) {
      const name: TwinPoseName = state.phase === 'bolt_windup' ? 'windup' : state.phase === 'bolt' ? 'fire' : 'hover'
      return { ...at, facing: towardHero, pose: name }
    }
    const home = state.perches[swooper]
    if (state.phase === 'swoop' || state.phase === 'rise') {
      return { ...at, facing: twinsSwoopEndX(state) >= home.x ? 1 : -1, pose: 'dash' }
    }
    if (state.phase === 'return') {
      return { ...at, facing: home.x >= at.x ? 1 : -1, pose: 'dash' }
    }
    return { ...at, facing: towardHero, pose: state.phase === 'line_up' ? 'dash' : 'hover' }
  }
  return [pose(0), pose(1)]
}
