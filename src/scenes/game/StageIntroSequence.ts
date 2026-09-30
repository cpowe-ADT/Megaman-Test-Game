export type StageIntroPhase = 'idle' | 'card' | 'briefing' | 'ready' | 'done'

export type StageIntroSnapshot = {
  phase: StageIntroPhase
  active: boolean
  cardRemainingMs: number
  /** Time left in the intro's READY (the `ready` phase). */
  readyRemainingMs: number
  /** Whether the blinking READY is lit this frame. */
  readyVisible: boolean
}

export const STAGE_CARD_MS = 900
/** Prompt 04 phase 4.2 item 1: after the card (and briefing) READY blinks three times over 1.2 s, then control. */
export const READY_MS = 1200
/** A checkpoint respawn's READY, without the card. */
export const RESPAWN_READY_MS = 600
export const READY_BLINKS = 3
/** The share of each blink READY is lit. */
const READY_LIT_SHARE = 0.6

/** Whether READY is lit `elapsedMs` into a READY `durationMs` long: `blinks` on-off cycles, lit for the first 60% of each. */
export function readyLit(elapsedMs: number, durationMs: number, blinks = READY_BLINKS): boolean {
  if (!(durationMs > 0) || elapsedMs < 0 || elapsedMs >= durationMs) return false
  const cycle = durationMs / Math.max(1, Math.floor(blinks))
  return elapsedMs % cycle < cycle * READY_LIT_SHARE
}

/**
 * Pure stage-intro state: card -> briefing -> ready -> done. The presenter drives the briefing through the dialogue
 * overlay and reports back with `briefingComplete()`. The `ready` phase runs only when `start` asks for it (the
 * presenter always does); without it the intro ends where READY would begin.
 */
export class StageIntroSequence {
  private phase: StageIntroPhase = 'idle'
  private cardRemainingMs = 0
  private readyRemainingMs = 0
  private wantBriefing = false
  private wantReady = false

  start(options: { card: boolean; briefing: boolean; ready?: boolean }): StageIntroSnapshot {
    this.wantBriefing = options.briefing
    this.wantReady = options.ready === true
    this.cardRemainingMs = 0
    this.readyRemainingMs = 0
    if (options.card) {
      this.phase = 'card'
      this.cardRemainingMs = STAGE_CARD_MS
    } else if (options.briefing) {
      this.phase = 'briefing'
    } else {
      this.enterReadyOrDone()
    }
    return this.snapshot()
  }

  /** Advances timers; returns true when the phase changed this tick. */
  tick(deltaMs: number): boolean {
    const ms = Math.max(0, deltaMs)
    if (this.phase === 'card') {
      this.cardRemainingMs = Math.max(0, this.cardRemainingMs - ms)
      if (this.cardRemainingMs > 0) return false
      if (this.wantBriefing) this.phase = 'briefing'
      else this.enterReadyOrDone()
      return true
    }
    if (this.phase === 'ready') {
      this.readyRemainingMs = Math.max(0, this.readyRemainingMs - ms)
      if (this.readyRemainingMs > 0) return false
      this.phase = 'done'
      return true
    }
    return false
  }

  briefingComplete(): boolean {
    if (this.phase !== 'briefing') return false
    this.enterReadyOrDone()
    return true
  }

  /** Confirm during the card ends it early; during the briefing the overlay owns confirm; READY runs its course. */
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
    this.cardRemainingMs = 0
    this.readyRemainingMs = 0
    return true
  }

  isActive(): boolean {
    return this.phase !== 'idle' && this.phase !== 'done'
  }

  snapshot(): StageIntroSnapshot {
    const readyVisible = this.phase === 'ready' && readyLit(READY_MS - this.readyRemainingMs, READY_MS)
    return { phase: this.phase, active: this.isActive(), cardRemainingMs: this.cardRemainingMs, readyRemainingMs: this.readyRemainingMs, readyVisible }
  }

  private enterReadyOrDone(): void {
    if (this.wantReady) {
      this.phase = 'ready'
      this.readyRemainingMs = READY_MS
    } else {
      this.phase = 'done'
    }
  }
}

/** A READY on its own (a checkpoint respawn): no phase and no control lock; the presenter ticks it. */
export class ReadyBlink {
  private durationMs = 0
  private elapsedMs = 0

  start(durationMs: number): void {
    this.durationMs = Math.max(0, durationMs)
    this.elapsedMs = 0
  }

  tick(deltaMs: number): void {
    if (this.isActive()) this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + Math.max(0, deltaMs))
  }

  isActive(): boolean {
    return this.elapsedMs < this.durationMs
  }

  lit(): boolean {
    return readyLit(this.elapsedMs, this.durationMs)
  }

  remainingMs(): number {
    return Math.max(0, this.durationMs - this.elapsedMs)
  }
}
