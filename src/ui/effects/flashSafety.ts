import { explosionFlashStyle, Settings } from '../../systems/Settings'

/**
 * Part 12i (EVAL-P8-003): Reduced Flashing for the charge ring and the explosions, the numbers in one place. The
 * low-HP pulse obeys it in `src/ui/beats/lowHp.ts`; the charge particles' rate in `resolveChargeAuraFrequencyMs`.
 */

/** The boss's killing blow and vanish flash the screen white; under Reduced Flashing, a faint wash. */
export function cameraFlashAlpha(reducedFlashing: boolean): number {
  return reducedFlashing ? 0.2 : 1
}

/** The boss's chained death bursts alternate white and gold; under Reduced Flashing every burst is a dimmer gold. */
export function deathBurstStyle(reducedFlashing: boolean, index: number): { color: number; alpha: number } {
  if (reducedFlashing) return { color: 0xffd26a, alpha: explosionFlashStyle(true).alphaScale }
  return { color: index % 2 === 0 ? 0xffffff : 0xffd26a, alpha: 1 }
}

/** The charge ring (the aura, its release burst and ring): no additive glow and dimmer under Reduced Flashing. */
export function chargeRingStyle(reducedFlashing: boolean): { additive: boolean; alphaScale: number } {
  return explosionFlashStyle(reducedFlashing)
}

type ExplosionSprite = { setAlpha(value: number): unknown }

/** The enemy defeat burst: unchanged normally, dimmed under Reduced Flashing. Returns the sprite for chaining. */
export function styleExplosion<T extends ExplosionSprite>(sprite: T, reducedFlashing: boolean = Settings.get().reducedFlashing): T {
  if (reducedFlashing) sprite.setAlpha(explosionFlashStyle(true).alphaScale)
  return sprite
}
