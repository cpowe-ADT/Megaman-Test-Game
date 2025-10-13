import { describe, expect, it } from 'vitest'
import { clampCooldown, computeNextAvailable, remainingCooldown, canFireNow } from '../logic/cooldown'

describe('cooldown helpers', () => {
  it('clamps cooldown values to the configured min/max', () => {
    expect(clampCooldown(20, 100, 400)).toBe(100)
    expect(clampCooldown(800, 100, 400)).toBe(400)
    expect(clampCooldown(240, 100, 400)).toBe(240)
  })

  it('honors the first attack delay when no previous fire exists', () => {
    const now = 1000
    const next = computeNextAvailable(undefined, now, {
      cooldownMs: 600,
      firstAttackDelayMs: 250,
      minMs: 100,
      maxMs: 800
    })
    expect(next).toBe(now + 250)
  })

  it('scales cooldown by cadence multiplier and reports remaining time', () => {
    const now = 5000
    const lastFireAt = 4200
    const config = { cooldownMs: 400, cadenceMultiplier: 1.5, minMs: 100, maxMs: 1200 }
    const nextAvailable = computeNextAvailable(lastFireAt, now, config)
    expect(nextAvailable).toBe(lastFireAt + 600)
    expect(remainingCooldown(lastFireAt, now, config)).toBe(0)
    expect(canFireNow(lastFireAt, now, config)).toBe(true)
  })
})
