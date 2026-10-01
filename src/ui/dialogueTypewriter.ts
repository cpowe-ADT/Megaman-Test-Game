/**
 * Pure typewriter timing for the dialogue overlay (prompt 07 "Phase 7.5"): how many characters of a
 * line are visible at an elapsed time, when the blip tick fires, and the confirm rule (complete the
 * line, then advance). Phaser- and Settings-free so it is unit-testable without a scene; the Phaser
 * edge (the per-frame tick, the blip SFX, reduced-flashing and automation reads) is
 * `DialogueOverlayController.ts`.
 */

/** Characters per second a line types at. */
export const TYPEWRITER_CHARS_PER_SECOND = 40
/** A blip plays every this many newly-shown characters. */
export const TYPEWRITER_BLIP_EVERY_CHARS = 2

/** Characters visible `elapsedMs` into a line of `textLength`; clamped to the line's own length. */
export function typewriterVisibleChars(textLength: number, elapsedMs: number): number {
  if (textLength <= 0 || elapsedMs <= 0) return 0
  const shown = Math.floor((elapsedMs / 1000) * TYPEWRITER_CHARS_PER_SECOND)
  return Math.min(textLength, Math.max(0, shown))
}

/**
 * True the frame `visibleChars` crosses a blip tick since `previousVisibleChars`, so the caller plays
 * one SFX per tick reached, not one per character revealed (a big frame jump still ticks once).
 */
export function typewriterBlipTicked(previousVisibleChars: number, visibleChars: number): boolean {
  if (visibleChars <= previousVisibleChars) return false
  return Math.floor(visibleChars / TYPEWRITER_BLIP_EVERY_CHARS) > Math.floor(previousVisibleChars / TYPEWRITER_BLIP_EVERY_CHARS)
}

/** The confirm rule: while the line is still typing, confirm completes it; once complete, confirm advances. */
export function typewriterConfirmAction(visibleChars: number, textLength: number): 'complete' | 'advance' {
  return visibleChars < textLength ? 'complete' : 'advance'
}
