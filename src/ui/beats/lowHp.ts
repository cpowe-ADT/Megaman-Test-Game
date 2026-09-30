// Low HP (prompt 04 phase 4.2 item 6, part 12i, EVAL-P8-004): at or below 25% the health bar pulses and a soft beep
// plays every 1.5 s; both are off under Reduced Flashing. Pure: the HUD feeds it frames and applies what it returns.

export const LOW_HP_RATIO = 0.25
export const LOW_HP_BEEP_MS = 1500
/** One pulse: full, down to LOW_HP_MIN_ALPHA, and back. */
export const LOW_HP_PULSE_MS = 750
export const LOW_HP_MIN_ALPHA = 0.35
/** No `low_hp` sfx exists yet: the beep is this existing soft key (listed in TESTING.md). */
export const LOW_HP_BEEP_SFX = 'ui_move'

/** At or below a quarter of max HP and still alive. */
export function isLowHp(current: number, max: number): boolean {
  return max > 0 && current > 0 && current / max <= LOW_HP_RATIO
}

/** The bar's alpha `elapsedMs` into the pulse: 1 at the start of each period, LOW_HP_MIN_ALPHA half way (a cosine). */
export function lowHpPulseAlpha(elapsedMs: number): number {
  const t = (((elapsedMs % LOW_HP_PULSE_MS) + LOW_HP_PULSE_MS) % LOW_HP_PULSE_MS) / LOW_HP_PULSE_MS
  return LOW_HP_MIN_ALPHA + (1 - LOW_HP_MIN_ALPHA) * ((1 + Math.cos(t * Math.PI * 2)) / 2)
}

export type LowHpInput = { current: number; max: number; live: boolean; reducedFlashing: boolean }
export type LowHpFrame = { active: boolean; alpha: number; beep: boolean }
export type LowHpSnapshot = { active: boolean; alpha: number; beeps: number; elapsedMs: number }

/**
 * Pulse and beep clock. The first beep plays on the first live frame at low HP, then one every LOW_HP_BEEP_MS of
 * live time; while the world is not live (paused, dialogue, hit-stop) the clock holds and the bar is solid.
 */
export class LowHpPulse {
  private active = false
  private elapsedMs = 0
  private nextBeepMs = 0
  private alpha = 1
  private beeps = 0

  tick(deltaMs: number, input: LowHpInput): LowHpFrame {
    if (input.reducedFlashing || !isLowHp(input.current, input.max)) {
      this.active = false
      this.elapsedMs = 0
      this.nextBeepMs = 0
      this.alpha = 1
      return { active: false, alpha: 1, beep: false }
    }
    this.active = true
    if (!input.live) {
      this.alpha = 1
      return { active: true, alpha: 1, beep: false }
    }
    this.elapsedMs += Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const beep = this.elapsedMs >= this.nextBeepMs
    if (beep) {
      this.beeps += 1
      this.nextBeepMs = this.elapsedMs + LOW_HP_BEEP_MS
    }
    this.alpha = lowHpPulseAlpha(this.elapsedMs)
    return { active: true, alpha: this.alpha, beep }
  }

  snapshot(): LowHpSnapshot {
    return { active: this.active, alpha: Math.round(this.alpha * 1000) / 1000, beeps: this.beeps, elapsedMs: Math.round(this.elapsedMs) }
  }
}
