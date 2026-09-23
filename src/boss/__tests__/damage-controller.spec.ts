import { describe, expect, it } from 'vitest'
import { BossDamageController } from '../framework/BossDamageController'

describe('BossDamageController', () => {
  it('applies damage then rejects hits during i-frames', () => {
    const damage = new BossDamageController({
      maxHP: 20,
      defense: 0,
      resistances: {},
      invulnMs: 200
    })

    const first = damage.applyDamage({ amount: 4, type: 'normal', source: 'test' })
    expect(first.accepted).toBe(true)
    expect(first.nextHP).toBe(16)

    const second = damage.applyDamage({ amount: 4, type: 'normal', source: 'test' })
    expect(second.accepted).toBe(false)
    expect(second.reason).toBe('invuln')

    damage.tick(220)
    const third = damage.applyDamage({ amount: 4, type: 'normal', source: 'test' })
    expect(third.accepted).toBe(true)
    expect(third.nextHP).toBe(12)
  })

  it('uses resistance multipliers and defense', () => {
    const damage = new BossDamageController({
      maxHP: 20,
      defense: 1,
      resistances: { electric: 0.5 },
      invulnMs: 0
    })

    const hit = damage.applyDamage({ amount: 6, type: 'electric', source: 'test' })
    expect(hit.amountApplied).toBe(2)
    expect(hit.nextHP).toBe(18)
  })
})
