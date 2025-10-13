import { describe, expect, it } from 'vitest'
import { advancePatternIndex, selectNextPattern, shouldFireStep, PatternStep } from '../logic/pattern'

describe('pattern helpers', () => {
  it('selects the highest weighted step that is ready to fire', () => {
    const now = 2000
    const steps: PatternStep[] = [
      { name: 'A', cooldownMs: 600, lastFireAt: 1600, weight: 1 },
      { name: 'B', cooldownMs: 400, lastFireAt: 1200, weight: 3 },
      { name: 'C', cooldownMs: 800, lastFireAt: 100, weight: 2 }
    ]
    const result = selectNextPattern(steps, now)
    expect(result?.name).toBe('B')
  })

  it('prevents firing when step is still on cooldown or disabled', () => {
    const now = 1500
    const readyStep: PatternStep = { name: 'Ready', cooldownMs: 400, lastFireAt: 1000 }
    const coolingStep: PatternStep = { name: 'Cooling', cooldownMs: 1000, lastFireAt: 800 }
    const disabledStep: PatternStep = { name: 'Disabled', cooldownMs: 100, enabled: false }

    expect(shouldFireStep(readyStep, now)).toBe(true)
    expect(shouldFireStep(coolingStep, now)).toBe(false)
    expect(shouldFireStep(disabledStep, now)).toBe(false)
  })

  it('advances to the next enabled index and wraps when needed', () => {
    const steps: PatternStep[] = [
      { name: 'A', cooldownMs: 200 },
      { name: 'B', cooldownMs: 200, enabled: false },
      { name: 'C', cooldownMs: 200 }
    ]
    expect(advancePatternIndex(0, steps)).toBe(2)
    expect(advancePatternIndex(2, steps)).toBe(0)
    expect(advancePatternIndex(2, steps, { wrap: false })).toBe(2)
  })
})
