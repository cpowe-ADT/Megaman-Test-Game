/**
 * The Glacier custodian walker's `slide` variant (12c): "it slides further than it means to." The pure
 * walk/stomp/turn machine (`custodianWalker.ts`) stays shared across every skin; this is an adapter-side
 * momentum layer the Glacier skin alone runs its velocity through, so a stop or a turn eases out instead
 * of snapping, overshooting the spot the walker meant to hold.
 */
export const ICE_SLIDE_TUNING = {
  /** Exponential decay rate toward the walker's own intent: from a full 48 px/s walk this settles (within
   * half a px/s) in about 350 ms, the beat of overshoot a stop or a turn slides through. */
  decayPerSecond: 13
} as const

/** One step of the slide: `previousVelocityX` eases toward `targetVelocityX` rather than snapping to it. */
export function stepIceSlide(previousVelocityX: number, targetVelocityX: number, dtMs: number): number {
  const decay = Math.exp(-ICE_SLIDE_TUNING.decayPerSecond * (dtMs / 1000))
  const next = targetVelocityX + (previousVelocityX - targetVelocityX) * decay
  return Math.abs(next - targetVelocityX) < 0.5 ? targetVelocityX : next
}
