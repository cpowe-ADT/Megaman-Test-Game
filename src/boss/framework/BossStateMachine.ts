import { BossState } from './types'

const ALLOWED_TRANSITIONS: Record<BossState, BossState[]> = {
  INTRO: ['THINK', 'DEAD'],
  THINK: ['MOVE_TO_RANGE', 'ATTACKING', 'PHASE_TRANSITION', 'HURT_INVULN', 'DEAD'],
  MOVE_TO_RANGE: ['THINK', 'ATTACKING', 'HURT_INVULN', 'PHASE_TRANSITION', 'DEAD'],
  ATTACKING: ['RECOVER', 'HURT_INVULN', 'PHASE_TRANSITION', 'DEAD'],
  RECOVER: ['THINK', 'HURT_INVULN', 'PHASE_TRANSITION', 'DEAD'],
  HURT_INVULN: ['THINK', 'PHASE_TRANSITION', 'DEAD'],
  PHASE_TRANSITION: ['THINK', 'DEAD'],
  DEAD: []
}

export class BossStateMachine {
  private _state: BossState = 'INTRO'
  private _stateTimerMs = 0

  get state(): BossState {
    return this._state
  }

  get stateTimerMs(): number {
    return this._stateTimerMs
  }

  tick(dtMs: number): void {
    this._stateTimerMs += dtMs
  }

  reset(initial: BossState = 'INTRO'): void {
    this._state = initial
    this._stateTimerMs = 0
  }

  canTransition(next: BossState): boolean {
    return ALLOWED_TRANSITIONS[this._state].includes(next)
  }

  tryTransition(next: BossState): boolean {
    if (next === this._state) {
      return true
    }
    if (!this.canTransition(next)) {
      return false
    }
    this._state = next
    this._stateTimerMs = 0
    return true
  }
}
