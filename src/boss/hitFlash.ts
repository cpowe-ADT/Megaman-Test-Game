/** A game object the hit blink can dim: anything with an alpha. */
export type BlinkTarget = { alpha: number; setAlpha(value: number): unknown }

/** The tween manager as the blink uses it (Phaser's `scene.tweens`). */
export type BlinkTweens = {
  add(config: {
    targets: BlinkTarget
    alpha: number
    yoyo: boolean
    duration: number
    repeat: number
    onComplete: () => void
    onStop: () => void
  }): { stop(): unknown }
}

const BLINKS = new WeakMap<BlinkTarget, { stop(): unknown }>()

/**
 * One hit blink at a time on a boss. A yoyo tween returns to the alpha it started from, so a blink started while
 * another was mid-way ended dimmed, and fast hits ratcheted the boss down until it stayed see-through (Craig,
 * 2026-09-25). A new blink stops the last one and restores full opacity first, and every blink ends at 1.
 */
export function blinkBossHit(tweens: BlinkTweens | undefined, target: BlinkTarget | undefined, alpha: number, durationMs: number, repeat = 0): void {
  if (!tweens || !target) return
  BLINKS.get(target)?.stop()
  target.setAlpha(1)
  const restore = () => {
    target.setAlpha(1)
    BLINKS.delete(target)
  }
  BLINKS.set(target, tweens.add({ targets: target, alpha, yoyo: true, duration: durationMs, repeat, onComplete: restore, onStop: restore }))
}
