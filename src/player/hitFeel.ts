import { FEEL_FRAME_MS } from './config'

/** Pure hit feel rules (prompt 05 §5.2 items 1, 2 and 6): contact hit-stop, shake budget, hurt blink. */

export type ShakeConfig = { intensity: number; duration: number }
export type ContactHitKind = 'sword_ground' | 'sword_air' | 'pellet' | 'boss_weakness'

/** Heavy at 0.025 moved a 448px view about 11px; no shake goes above this. */
export const SHAKE_INTENSITY_CAP = 0.016

export const SHAKES = {
  light: { intensity: 0.005, duration: 100 },
  medium: { intensity: 0.012, duration: 180 },
  heavy: { intensity: SHAKE_INTENSITY_CAP, duration: 300 }
} as const satisfies Record<string, ShakeConfig>

/** Hit-stop only when something is hit: sword 5 grounded / 4 air, pellet 2, boss weakness 8. */
export const CONTACT_HIT_FEEL: Record<ContactHitKind, { hitstopFrames: number; shake?: ShakeConfig }> = {
  sword_ground: { hitstopFrames: 5, shake: SHAKES.medium },
  sword_air: { hitstopFrames: 4, shake: SHAKES.medium },
  pellet: { hitstopFrames: 2 },
  boss_weakness: { hitstopFrames: 8, shake: SHAKES.medium }
}

/** A boss hit is a weakness hit (8-frame hit-stop) only at 1.4x or more and only when damage landed (not IMMUNE or BLOCKED). */
export const WEAKNESS_MULTIPLIER = 1.4

export function isWeaknessContact(multiplier: number, amountApplied: number): boolean {
  return multiplier >= WEAKNESS_MULTIPLIER && amountApplied > 0
}

export function capShake(shake: ShakeConfig): ShakeConfig {
  return { intensity: Math.min(SHAKE_INTENSITY_CAP, Math.max(0, shake.intensity)), duration: Math.max(0, shake.duration) }
}

/**
 * Shakes never stack: while one runs, a request that is not stronger is dropped and a stronger one
 * replaces it. Returns the capped shake to start, or null.
 */
export function resolveShakeRequest(
  request: ShakeConfig,
  active: { running: boolean; intensity: number }
): ShakeConfig | null {
  const capped = capShake(request)
  if (capped.intensity <= 0 || capped.duration <= 0) {
    return null
  }
  if (active.running && capped.intensity <= active.intensity) {
    return null
  }
  return capped
}

/** Hurt blink: alpha toggles every 4 frames (60Hz) while i-frames remain. */
export const IFRAME_BLINK_FRAMES = 4
export const IFRAME_BLINK_ALPHA = 0.3

export function iFrameBlinkAlpha(elapsedMs: number, iFramesRemainingMs: number): number {
  if (iFramesRemainingMs <= 0) {
    return 1
  }
  const phase = Math.floor(Math.max(0, elapsedMs) / (IFRAME_BLINK_FRAMES * FEEL_FRAME_MS)) % 2
  return phase === 0 ? IFRAME_BLINK_ALPHA : 1
}

/**
 * The charge ring's particle burst rate (prompt 05 §5.3 item 3, the first consumer of
 * `Settings.reducedFlashing`, the accessibility setting for players sensitive to rapid flashing):
 * a 340ms period is under 3Hz, well under the photosensitive-seizure guideline threshold, versus
 * the normal 42ms burst-to-burst gap.
 */
const CHARGE_AURA_FREQUENCY_MS = 42
const CHARGE_AURA_REDUCED_FREQUENCY_MS = 340
export function resolveChargeAuraFrequencyMs(reducedFlashing: boolean): number {
  return reducedFlashing ? CHARGE_AURA_REDUCED_FREQUENCY_MS : CHARGE_AURA_FREQUENCY_MS
}
