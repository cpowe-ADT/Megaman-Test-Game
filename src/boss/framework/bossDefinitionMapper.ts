import { BossBlueprint, AttackPattern } from '../../bosses/types'
import { BossAttackDefinition, BossDefinition } from './types'
import { BOSS_COMBAT_PROFILES } from '../../bosses/bossCombatProfiles'

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

function resolveDamageType(blueprint: BossBlueprint): string {
  return blueprint.element.toLowerCase()
}

function resolveAttackDamage(pattern: AttackPattern): number {
  if (pattern.state === 'dash' || pattern.state === 'special') {
    return 2
  }
  return 1
}

function resolveAttackParams(blueprint: BossBlueprint, pattern: AttackPattern) {
  const spawns = pattern.spawns ?? []
  return {
    spawns: spawns.join(','),
    projectileSpeed: pattern.state === 'shoot' || pattern.state === 'summon' ? 240 : undefined,
    count: spawns.some((spawn) =>
      ['arc_shards', 'flame_cone', 'freeze_cone', 'dart_spread', 'boulder_radial'].includes(spawn)
    )
      ? 3
      : undefined,
    spread: spawns.some((spawn) =>
      ['arc_shards', 'flame_cone', 'freeze_cone', 'dart_spread', 'boulder_radial'].includes(spawn)
    )
      ? 0.36
      : undefined,
    dashSpeed: pattern.state === 'dash' ? Math.max(220, blueprint.baseStats.dashSpeed * 1.8) : undefined,
    hazardDuration: pattern.state === 'special' || pattern.state === 'summon' ? 850 : undefined,
    radius: pattern.state === 'special' ? 72 : undefined
  }
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
    const combatProfile =
      BOSS_COMBAT_PROFILES[blueprint.id as keyof typeof BOSS_COMBAT_PROFILES]?.attacks[
        normalizedId(attack.name)
      ]
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
      panicWeight: attack.state === 'dash' ? 3 : undefined,
      params: resolveAttackParams(blueprint, attack),
      hit: {
        damageAmount: resolveAttackDamage(attack),
        damageType: resolveDamageType(blueprint),
        knockbackVector: attack.state === 'dash' ? { x: 150, y: -45 } : { x: 100, y: -30 },
        hitstopFrames: attack.state === 'dash' || attack.state === 'special' ? 4 : 2
      },
      telegraph: {
        animationName: attack.state,
        sfxName: attack.name,
        vfxName: attack.telegraph.warningFx,
        warningFx: attack.telegraph.warningFx,
        anchor: attack.telegraph.anchor
      },
      requirements: {
        grounded: combatProfile?.requiresGrounded,
        maxActiveHazards:
          attack.state === 'special' || attack.state === 'summon'
            ? BOSS_COMBAT_PROFILES[blueprint.id as keyof typeof BOSS_COMBAT_PROFILES]?.room
                .maxActiveHazards
            : undefined
      }
    }
  })

  const laterPhaseUnlocks = new Set(
    blueprint.phases.slice(1).flatMap((phase) => phase.newAttacks.map((attackName) => normalizedId(attackName)))
  )
  const phases = blueprint.phases.map((phase, phaseIndex) => {
    const overrides: Record<string, number> = {}
    phase.newAttacks.forEach((attackName) => {
      overrides[normalizedId(attackName)] = 3
    })

    return {
      threshold: phase.threshold,
      speedMultiplier: phase.cadenceMultiplier,
      thinkTimeMultiplier: phase.enraged ? 1.25 : 1,
      attackWeightOverrides: overrides,
      unlockAttacks:
        phaseIndex === 0
          ? attacks.map((attack) => attack.id).filter((attackId) => !laterPhaseUnlocks.has(attackId))
          : phase.newAttacks.map((attackName) => normalizedId(attackName)),
      transitionLockMs: phase.enraged ? 420 : 0,
      patternDeck:
        BOSS_COMBAT_PROFILES[blueprint.id as keyof typeof BOSS_COMBAT_PROFILES]?.deterministicDeck?.[
          phaseIndex
        ]
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
        : attack.type === 'hazard' || attack.type === 'slam'
          ? 'special'
          : 'move'

  // The authored tell passes through: no fallback, `validateBossDefinition` rejects an attack without one.
  const warningFx = attack.telegraph?.warningFx
  const anchor = attack.telegraph?.anchor
  if (!warningFx || !anchor) {
    throw new Error(`[Boss] attack '${attack.id}' names no telegraph warningFx and anchor`)
  }
  return {
    name: attack.displayName ?? attack.id,
    state,
    description: attack.displayName ?? attack.id,
    telegraph: {
      telegraphMs: attack.windupTime,
      warningFx,
      anchor
    },
    executeMs: attack.activeTime,
    cooldownMs: attack.cooldown,
    spawns:
      typeof attack.params?.spawns === 'string'
        ? attack.params.spawns.split(',').map((value) => value.trim()).filter(Boolean)
        : undefined
  }
}
