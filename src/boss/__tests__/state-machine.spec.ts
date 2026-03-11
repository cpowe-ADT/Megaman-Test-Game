import { describe, expect, it } from 'vitest'
import { BossBase } from '../framework/BossBase'
import { BossDefinition } from '../framework/types'

const baseDef: BossDefinition = {
  boss_id: 'test_boss',
  displayName: 'Test Boss',
  maxHP: 30,
  contactDamage: 2,
  phases: [
    { threshold: 1, unlockAttacks: ['jab'] },
    { threshold: 0.4, unlockAttacks: ['jab'], attackWeightOverrides: { jab: 3 } }
  ],
  attacks: [
    {
      id: 'jab',
      type: 'melee',
      windupTime: 50,
      activeTime: 50,
      recoveryTime: 50,
      cooldown: 200,
      rangeMin: 0,
      rangeMax: 80,
      weight: 1,
      hit: { damageAmount: 2, damageType: 'impact' }
    }
  ]
}

function tick(boss: BossBase, dtMs: number): void {
  boss.TickAI({
    nowMs: 0,
    dtMs,
    bossPosition: { x: 100, y: 0 },
    playerPosition: { x: 120, y: 0 },
    distanceToPlayer: 20,
    lineOfSight: true,
    rng: () => 0,
    phaseIndex: 0,
    speedMultiplier: 1,
    thinkTimeMultiplier: 1
  })
}

describe('BossBase', () => {
  it('transitions intro -> think after intro unlock', () => {
    const boss = new BossBase(baseDef)
    boss.OnFightStart()
    expect(boss.state).toBe('INTRO')

    tick(boss, 1500)
    expect(boss.state).toBe('INTRO')

    boss.unlockIntro()
    tick(boss, 1300)
    expect(boss.state).toBe('THINK')
  })

  it('enters phase transition after threshold crossing', () => {
    const boss = new BossBase(baseDef)
    boss.OnFightStart()
    boss.unlockIntro()
    tick(boss, 1300)

    boss.ApplyDamage({ amount: 20, type: 'normal', source: 'test', iFrameMs: 0 })
    tick(boss, 16)

    expect(boss.currentPhaseIndex).toBe(1)
    expect(['PHASE_TRANSITION', 'THINK'].includes(boss.state)).toBe(true)
  })
})
