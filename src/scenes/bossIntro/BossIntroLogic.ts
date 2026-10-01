/**
 * Pure boss-intro timing and gating (part 13g, `EVAL-P13-012`): the pre-stage card that plays after
 * Stage Select confirms a warden and before the stage loads. Phaser- and Save-free so it is
 * unit-testable without a scene; the Phaser edge is `BossIntroScene.ts`.
 */
import { typewriterVisibleChars } from '../../ui/dialogueTypewriter'

export type BossIntroPhase = 'idle' | 'active' | 'done'

export type BossIntroSnapshot = {
  phase: BossIntroPhase
  active: boolean
  elapsedMs: number
  remainingMs: number
  /** How many characters of the boss's name are typed in, this frame (`ui_move` blips as it grows). */
  visibleChars: number
}

/** About 3 s (spec 13g item 1); Enter, `?storyIntro=off` or an unasked automation run skip it early. */
export const BOSS_INTRO_DURATION_MS = 3000

/** Card -> done. `start` takes the boss name's length so the typewriter has something to type toward. */
export class BossIntroSequence {
  private phase: BossIntroPhase = 'idle'
  private elapsedMs = 0
  private nameLength = 0
  private durationMs = BOSS_INTRO_DURATION_MS

  start(nameLength: number, durationMs: number = BOSS_INTRO_DURATION_MS): BossIntroSnapshot {
    this.phase = 'active'
    this.elapsedMs = 0
    this.nameLength = Math.max(0, nameLength)
    this.durationMs = Math.max(0, durationMs)
    return this.snapshot()
  }

  /** Advances the clock; returns true the one frame the phase changes (active -> done). */
  tick(deltaMs: number): boolean {
    if (this.phase !== 'active') return false
    this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + Math.max(0, deltaMs))
    if (this.elapsedMs >= this.durationMs) {
      this.phase = 'done'
      return true
    }
    return false
  }

  /** Enter (or a caller that decided to end the card now): jump straight to done. */
  skip(): boolean {
    if (this.phase !== 'active') return false
    this.elapsedMs = this.durationMs
    this.phase = 'done'
    return true
  }

  isActive(): boolean {
    return this.phase === 'active'
  }

  snapshot(): BossIntroSnapshot {
    return {
      phase: this.phase,
      active: this.isActive(),
      elapsedMs: this.elapsedMs,
      remainingMs: Math.max(0, this.durationMs - this.elapsedMs),
      visibleChars: typewriterVisibleChars(this.nameLength, this.elapsedMs)
    }
  }
}

/** The atlas's `<bossId>/intro/<n>` frames (the naming `BossController.buildGroupedAtlasFrames` reads), in order. */
export function resolveBossIntroFrames(frameNames: readonly string[], bossId: string): string[] {
  const prefix = `${bossId}/intro/`
  return frameNames
    .filter((frame) => frame.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export type BossIntroGateInput = {
  stageId: string | null
  bossId: string | null
  tutorialStageId: string
  /** A resumed active run (`loadFromSave`) never shows a fresh-entry beat. */
  loadFromSave?: boolean
  /** `AUTOMATION.storyIntro`: false only for `?storyIntro=off`. */
  storyIntroEnabled: boolean
  /** `AUTOMATION.enabled`: true under `?automation=1` or the smoke/automation env. */
  automationEnabled: boolean
  /** `AUTOMATION.bossIntro`: a smoke's explicit ask (`?bossIntro=on`) to see the card anyway. */
  automationBossIntro: boolean
}

/**
 * Whether the pre-stage card should play at all (spec 13g item 1): never the tutorial, never a resumed run, off
 * with the story switch, and skipped under automation unless a smoke explicitly asks for it.
 */
export function shouldPlayBossIntro(input: BossIntroGateInput): boolean {
  if (!input.stageId || !input.bossId) return false
  if (input.stageId === input.tutorialStageId) return false
  if (input.loadFromSave) return false
  if (!input.storyIntroEnabled) return false
  if (input.automationEnabled && !input.automationBossIntro) return false
  return true
}
