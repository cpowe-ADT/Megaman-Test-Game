import { describe, expect, it } from 'vitest'
import { BossAttackController } from '../framework/BossAttackController'
import { AttackContext, BossAttackDefinition } from '../framework/types'

function makeCtx(distanceToPlayer: number): AttackContext {
  return {
    nowMs: 0,
    dtMs: 16,
    bossPosition: { x: 0, y: 0 },
    playerPosition: { x: distanceToPlayer, y: 0 },
    distanceToPlayer,
    lineOfSight: true,
    rng: () => 0.01,
    phaseIndex: 0,
    speedMultiplier: 1,
    thinkTimeMultiplier: 1,
    isPlayerTooClose: distanceToPlayer <= 24
  }
}

function makeAttack(id: string, rangeMin: number, rangeMax: number, type: BossAttackDefinition['type']) {
  return {
    id,
    type,
    windupTime: 50,
    activeTime: 50,
    recoveryTime: 50,
    cooldown: 200,
    rangeMin,
    rangeMax,
    weight: 1,
    panicWeight: 4,
    hit: { damageAmount: 1, damageType: 'normal' }
  } satisfies BossAttackDefinition
}

describe('BossAttackController', () => {
  it('respects cooldowns and anti-repeat memory', () => {
    const controller = new BossAttackController([
      makeAttack('a', 0, 200, 'projectile'),
      makeAttack('b', 0, 200, 'projectile')
    ])

    const ctx = makeCtx(120)
    const first = controller.tryStartAttack(ctx, 30)
    expect(first?.id).toBe('a')

    // End attack and set cooldown.
    for (let i = 0; i < 4; i += 1) {
      controller.tick(60, ctx)
    }
    for (let i = 0; i < 4; i += 1) {
      controller.tick(60, ctx)
    }

    const second = controller.tryStartAttack(ctx, 30)
    expect(second?.id).toBe('b')
  })

  it('uses panic choice when player is too close', () => {
    const controller = new BossAttackController([
      makeAttack('melee', 0, 40, 'melee'),
      makeAttack('far_shot', 40, 240, 'projectile')
    ])

    const selected = controller.tryStartAttack(makeCtx(20), 30)
    expect(selected?.id).toBe('melee')
  })
})
