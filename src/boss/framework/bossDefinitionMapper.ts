import { BossBlueprint, AttackPattern } from '../../bosses/types'
import { BossAttackDefinition, BossDefinition, BossPhaseDefinition } from './types'
import { BOSS_COMBAT_PROFILES } from '../../bosses/bossCombatProfiles'
import { resolvePhaseKits } from '../phaseKit'

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

/** The runtime attack id for an authored attack name ('Ignition Dash' -> 'ignition_dash'). */
export function normalizedId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function resolveDamageType(blueprint: BossBlueprint): string {
  return blueprint.element.toLowerCase()
}

/** An attack's hit damage: its hazards, its shots and (while it is active) its contact hitbox deal this much. */
export function resolveAttackDamage(pattern: AttackPattern): number {
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

function toAttackDefinition(blueprint: BossBlueprint, attack: AttackPattern): BossAttackDefinition {
  const range = inferRange(blueprint, attack)
  const combatProfile =
    BOSS_COMBAT_PROFILES[blueprint.id as keyof typeof BOSS_COMBAT_PROFILES]?.attacks[normalizedId(attack.name)]
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
          ? BOSS_COMBAT_PROFILES[blueprint.id as keyof typeof BOSS_COMBAT_PROFILES]?.room.maxActiveHazards
          : undefined
    }
  }
}

/**
 * Phase kits (prompt 07 phase 7.2 item 1): each phase's added attacks weigh 3 and its retired ones 0, and the
 * retired ones are also flipped to `enabled: false` (cumulative, so a retirement holds into desperation);
 * retimes change the wind-up and cooldown. Desperation is one more phase at 20% HP with its own attack.
 */
export function toBossDefinition(blueprint: BossBlueprint): BossDefinition {
  const desperationPattern = blueprint.desperation?.attack
  const attacks: BossAttackDefinition[] = [
    ...blueprint.attacks,
    ...(desperationPattern ? [desperationPattern] : [])
  ].map((attack) => toAttackDefinition(blueprint, attack))

  const kits = resolvePhaseKits(blueprint)
  const laterPhaseUnlocks = new Set(kits.slice(1).flatMap((kit) => kit.added))
  const decks = BOSS_COMBAT_PROFILES[blueprint.id as keyof typeof BOSS_COMBAT_PROFILES]?.deterministicDeck
  const phases: BossPhaseDefinition[] = kits.map((kit, phaseIndex) => {
    const authored = blueprint.phases[phaseIndex]
    const overrides: Record<string, number> = {}
    kit.added.forEach((attackId) => (overrides[attackId] = kit.desperation ? 4 : 3))
    Object.entries(kit.enabled).forEach(([attackId, enabled]) => {
      if (!enabled) overrides[attackId] = 0
    })
    const lastDeck = decks?.[decks.length - 1]
    return {
      name: kit.name,
      desperation: kit.desperation || undefined,
      threshold: kit.threshold,
      speedMultiplier: authored?.cadenceMultiplier ?? blueprint.desperation?.cadenceMultiplier ?? 1,
      thinkTimeMultiplier: kit.desperation ? 1.4 : authored?.enraged ? 1.25 : 1,
      attackWeightOverrides: overrides,
      unlockAttacks:
        phaseIndex === 0 ? attacks.map((attack) => attack.id).filter((attackId) => !laterPhaseUnlocks.has(attackId)) : kit.added,
      attackEnabled: kit.enabled,
      attackTiming: kit.timing,
      transitionLockMs: kit.desperation ? 640 : authored?.enraged ? 420 : 0,
      patternDeck: kit.desperation ? (lastDeck ? [...kit.added, ...lastDeck] : undefined) : decks?.[phaseIndex]
    }
  })

  return {
    boss_id: blueprint.id,
    displayName: blueprint.codename,
    maxHP: blueprint.baseStats.maxHp,
    contactDamage: blueprint.baseStats.contactDamage,
    defense: blueprint.defense ?? 0,
    resistances: { ...(blueprint.resistances ?? {}) },
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
