import { BossBlueprint, AttackPattern } from '../../bosses/types'
import { BossAttackDefinition, BossDefinition } from './types'

function toAttackType(pattern: AttackPattern): BossAttackDefinition['type'] {
  if (pattern.state === 'shoot' || pattern.state === 'summon') {
    return 'projectile'
  }
  if (pattern.state === 'dash') {
    return 'dash'
  }
  if (pattern.state === 'special') {
    return 'hazard'
  }
  return 'melee'
}

function normalizedId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function inferRange(blueprint: BossBlueprint, pattern: AttackPattern): { min: number; max: number } {
  const profile = blueprint.movementProfile.preferredRange
  if (pattern.state === 'dash') {
    return { min: 40, max: 220 }
  }
  if (pattern.state === 'shoot' || pattern.state === 'summon') {
    return profile === 'long' ? { min: 48, max: 220 } : { min: 30, max: 170 }
  }
  return profile === 'close' ? { min: 0, max: 64 } : { min: 0, max: 100 }
}

export function toBossDefinition(blueprint: BossBlueprint): BossDefinition {
  const attacks: BossAttackDefinition[] = blueprint.attacks.map((attack) => {
    const range = inferRange(blueprint, attack)
    return {
      id: normalizedId(attack.name),
      displayName: attack.name,
      type: toAttackType(attack),
      windupTime: attack.telegraph.telegraphMs,
      activeTime: Math.max(80, attack.executeMs),
      recoveryTime: 220,
      cooldown: attack.cooldownMs,
      rangeMin: range.min,
      rangeMax: range.max,
      weight: 1,
      params: {
        spawns: attack.spawns?.join(',') ?? ''
      },
      hit: {
        damageAmount: 2,
        damageType: 'normal',
        hitstopFrames: 2
      },
      telegraph: {
        animationName: attack.state,
        sfxName: attack.name,
        vfxName: attack.telegraph.warningFx
      }
    }
  })

  const phases = blueprint.phases.map((phase) => {
    const overrides: Record<string, number> = {}
    phase.newAttacks.forEach((attackName) => {
      overrides[normalizedId(attackName)] = 3
    })

    return {
      threshold: phase.threshold,
      speedMultiplier: phase.cadenceMultiplier,
      thinkTimeMultiplier: phase.enraged ? 1.25 : 1,
      attackWeightOverrides: overrides,
      unlockAttacks: phase.newAttacks.map((attackName) => normalizedId(attackName)),
      transitionLockMs: phase.enraged ? 420 : 0
    }
  })

  return {
    boss_id: blueprint.id,
    displayName: blueprint.codename,
    maxHP: blueprint.baseStats.maxHp,
    contactDamage: blueprint.baseStats.contactDamage,
    defense: 0,
    resistances: {},
    introLockMs: 1200,
    recoverMs: 180,
    hurtInvulnMs: 220,
    hurtStunMs: 75,
    moveSpeed: blueprint.baseStats.moveSpeed,
    preferredRange:
      blueprint.movementProfile.preferredRange === 'close'
        ? { min: 24, max: 80 }
        : blueprint.movementProfile.preferredRange === 'long'
          ? { min: 80, max: 200 }
          : { min: 44, max: 140 },
    panicDistance: 34,
    phases,
    attacks
  }
}

export function toAttackPatternFromDefinition(attack: BossAttackDefinition): AttackPattern {
  const state: AttackPattern['state'] =
    attack.type === 'projectile'
      ? 'shoot'
      : attack.type === 'dash'
        ? 'dash'
        : attack.type === 'hazard'
          ? 'special'
          : 'move'

  return {
    name: attack.displayName ?? attack.id,
    state,
    description: attack.displayName ?? attack.id,
    telegraph: {
      telegraphMs: attack.windupTime,
      warningFx: 'glow',
      anchor: 'self'
    },
    executeMs: attack.activeTime,
    cooldownMs: attack.cooldown,
    spawns: undefined
  }
}
