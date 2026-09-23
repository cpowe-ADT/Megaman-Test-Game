export type StageIntroPhase = 'idle' | 'card' | 'briefing' | 'ready' | 'done'

export type StageIntroSnapshot = {
  phase: StageIntroPhase
  active: boolean
  cardRemainingMs: number
}

export const STAGE_CARD_MS = 900

/**
 * Pure stage-intro state: card -> briefing -> ready -> done. The presenter drives the briefing
 * through the dialogue overlay and reports back with `briefingComplete()`. `ready` is reserved for
 * prompt 04's READY blink and currently completes immediately.
 */
export class StageIntroSequence {
  private phase: StageIntroPhase = 'idle'
  private cardRemainingMs = 0
  private wantBriefing = false

  start(options: { card: boolean; briefing: boolean }): StageIntroSnapshot {
    this.wantBriefing = options.briefing
    if (options.card) {
      this.phase = 'card'
      this.cardRemainingMs = STAGE_CARD_MS
    } else if (options.briefing) {
      this.phase = 'briefing'
    } else {
      this.phase = 'done'
    }
    return this.snapshot()
  }

  /** Advances timers; returns true when the phase changed this tick. */
  tick(deltaMs: number): boolean {
    if (this.phase !== 'card') return false
    this.cardRemainingMs = Math.max(0, this.cardRemainingMs - Math.max(0, deltaMs))
    if (this.cardRemainingMs > 0) return false
    this.phase = this.wantBriefing ? 'briefing' : 'ready'
    if (this.phase === 'ready') this.phase = 'done'
    return true
  }

  briefingComplete(): boolean {
    if (this.phase !== 'briefing') return false
    this.phase = 'done'
    return true
  }

  /** Confirm during the card ends it early; during the briefing the overlay owns confirm. */
  advance(): boolean {
    if (this.phase === 'card') {
      this.cardRemainingMs = 0
      return this.tick(0)
    }
    return false
  }

  skip(): boolean {
    if (this.phase === 'idle' || this.phase === 'done') return false
    this.phase = 'done'
    return true
  }

  isActive(): boolean {
    return this.phase !== 'idle' && this.phase !== 'done'
  }

  snapshot(): StageIntroSnapshot {
    return { phase: this.phase, active: this.isActive(), cardRemainingMs: this.cardRemainingMs }
  }
}
