import type { EnemyAnimationKeys, EnemyDefinition } from './types'
import { CUSTODIAN_TUNING } from './custodianWalker'
import { RELAY_NEST_TUNING } from './relayTurretNest'
import { SENTRY_TWINS_TUNING } from './sentryTwins'
import { DRILL_SERPENT_TUNING } from './drillSerpent'

/**
 * The mini-boss roster (EVAL-P6-005; prompt 02 §2.3, part 12c): four archetypes on the enemy framework
 * (a pure state machine and a brain each, not the boss framework prompt 02 named), 14 to 20 HP, super
 * armour, a large health drop on defeat (`minibossDefeatDrop`), no reward. Each stage skin is its own
 * family: the skin atlas carries its own frame prefix (`<skin>/idle/000`), so a skin is the base
 * definition under the skin's type key, with the same brain.
 */
const MINIBOSS_BODY_HITBOXES = { melee: { width: 1, height: 1, offsetX: 0, offsetY: 0 } }
const NO_PUSH = { pushMinDamage: 99, pushSpeed: 0, pushMs: 0 }

function animationSet(typeKey: string): EnemyAnimationKeys {
  return {
    idle: `${typeKey}_idle`,
    move: `${typeKey}_move`,
    attackWindup: `${typeKey}_attack_windup`,
    attackActive: `${typeKey}_attack_active`,
    attackRecover: `${typeKey}_idle`,
    hurt: `${typeKey}_hurt`,
    death: `${typeKey}_death`
  }
}

/** The base family under a skin's type key: same body, stats and brain, the skin's animation set. */
export function skinOf(base: EnemyDefinition, typeKey: string): EnemyDefinition {
  const animations = Object.fromEntries(
    Object.entries(base.animations).map(([slot, key]) => [slot, String(key).replace(base.typeKey, typeKey)])
  ) as unknown as EnemyAnimationKeys
  return { ...base, typeKey, animations }
}

// Heat Works mini-boss (EVAL-P6-005): 64px frames with the feet on row 62, so the 44x50 body sits 2px
// up from the frame bottom. 20 HP is 20 buster pellets or two and a half 2/2/4 saber combos.
const CUSTODIAN_WALKER: EnemyDefinition = {
  typeKey: 'custodian_walker',
  movementType: 'walker',
  collider: { width: 44, height: 50, offsetX: 0, offsetY: -2 },
  hurtbox: { width: 44, height: 50, offsetX: 0, offsetY: -2 },
  hitboxes: MINIBOSS_BODY_HITBOXES,
  stats: {
    hp: 20,
    damage: 3,
    speed: 36,
    gravityScale: 1,
    knockbackResist: 1,
    contactDamage: 3,
    hitstunLightMs: 0,
    hitstunHeavyMs: 0,
    invulnerabilityMs: 40,
    heavy: { pushMinDamage: 4, pushSpeed: 60, pushMs: 120 }
  },
  ai: { sightRange: 360, aggroRange: 360, leashRange: 448, reactionTime: 0 },
  attack: {
    type: 'melee',
    cooldownMs: 800,
    windupMs: 500,
    activeMs: 250,
    recoveryMs: 700,
    range: 96
  },
  drops: { healthChance: 1, ammoChance: 0, scoreChance: 1, scoreValue: 1000 },
  deathBehavior: 'explode',
  deathSequenceMs: CUSTODIAN_TUNING.deathMs,
  brain: 'custodian_walker',
  role: 'miniboss',
  animations: {
    idle: 'custodian_walker_idle',
    move: 'custodian_walker_move',
    attackWindup: 'custodian_walker_attack_windup',
    attackActive: 'custodian_walker_attack_active',
    attackRecover: 'custodian_walker_idle',
    hurt: 'custodian_walker_hurt',
    death: 'custodian_walker_death'
  }
}

// Tide mini-boss: 64px frames, feet on row 62; a squat 44x40 body under the barrel. 16 HP.
const RELAY_TURRET_NEST: EnemyDefinition = {
  typeKey: 'relay_turret_nest',
  movementType: 'walker',
  collider: { width: 44, height: 40, offsetX: 0, offsetY: -2 },
  hurtbox: { width: 44, height: 40, offsetX: 0, offsetY: -2 },
  hitboxes: MINIBOSS_BODY_HITBOXES,
  stats: {
    hp: 16,
    damage: 2,
    speed: RELAY_NEST_TUNING.shuffleSpeed,
    gravityScale: 1,
    knockbackResist: 1,
    contactDamage: 2,
    hitstunLightMs: 0,
    hitstunHeavyMs: 0,
    invulnerabilityMs: 40,
    heavy: NO_PUSH
  },
  ai: { sightRange: 360, aggroRange: 360, leashRange: 448, reactionTime: 0 },
  attack: {
    type: 'burst',
    cooldownMs: RELAY_NEST_TUNING.cooldownMs,
    windupMs: RELAY_NEST_TUNING.burstWindupMs,
    activeMs: RELAY_NEST_TUNING.burstMs,
    recoveryMs: RELAY_NEST_TUNING.recoveryMs,
    range: 360,
    projectileKey: 'enemy_shot_basic',
    burstCount: RELAY_NEST_TUNING.burstShots,
    burstSpacingMs: RELAY_NEST_TUNING.burstSpacingMs
  },
  drops: { healthChance: 1, ammoChance: 0, scoreChance: 1, scoreValue: 1000 },
  deathBehavior: 'explode',
  deathSequenceMs: RELAY_NEST_TUNING.deathMs,
  brain: 'relay_turret_nest',
  role: 'miniboss',
  animations: animationSet('relay_turret_nest')
}

// Volt mini-boss: two 48px drones (feet row 44) sharing one 18 HP pool; a 26x26 body round the lens.
const SENTRY_TWIN: EnemyDefinition = {
  typeKey: 'sentry_twin',
  movementType: 'flyer',
  collider: { width: 26, height: 26, offsetX: 0, offsetY: -6 },
  hurtbox: { width: 26, height: 26, offsetX: 0, offsetY: -6 },
  hitboxes: MINIBOSS_BODY_HITBOXES,
  stats: {
    hp: 18,
    damage: 2,
    speed: SENTRY_TWINS_TUNING.swoopSpeed,
    gravityScale: 0,
    knockbackResist: 1,
    contactDamage: 2,
    hitstunLightMs: 0,
    hitstunHeavyMs: 0,
    invulnerabilityMs: 40,
    heavy: NO_PUSH
  },
  ai: { sightRange: 360, aggroRange: 360, leashRange: 448, reactionTime: 0 },
  attack: {
    type: 'projectile',
    cooldownMs: SENTRY_TWINS_TUNING.gapMs,
    windupMs: SENTRY_TWINS_TUNING.boltWindupMs,
    activeMs: SENTRY_TWINS_TUNING.boltMs,
    recoveryMs: 0,
    range: 448,
    projectileKey: 'enemy_beam_pulse'
  },
  drops: { healthChance: 1, ammoChance: 0, scoreChance: 1, scoreValue: 1000 },
  deathBehavior: 'explode',
  deathSequenceMs: SENTRY_TWINS_TUNING.deathMs,
  brain: 'sentry_twins',
  role: 'miniboss',
  animations: animationSet('sentry_twin')
}

// Mire mini-boss: 64px frames, feet on row 62; a 36x44 body under the drill. 16 HP.
const DRILL_SERPENT: EnemyDefinition = {
  typeKey: 'drill_serpent',
  movementType: 'walker',
  collider: { width: 36, height: 44, offsetX: 0, offsetY: -2 },
  hurtbox: { width: 36, height: 44, offsetX: 0, offsetY: -2 },
  hitboxes: MINIBOSS_BODY_HITBOXES,
  stats: {
    hp: 16,
    damage: 3,
    speed: DRILL_SERPENT_TUNING.lungeSpeed,
    gravityScale: 1,
    knockbackResist: 1,
    contactDamage: 3,
    hitstunLightMs: 0,
    hitstunHeavyMs: 0,
    invulnerabilityMs: 40,
    heavy: { pushMinDamage: 4, pushSpeed: 60, pushMs: 120 }
  },
  ai: { sightRange: 360, aggroRange: 360, leashRange: 448, reactionTime: 0 },
  attack: {
    type: 'charge',
    cooldownMs: DRILL_SERPENT_TUNING.surfaceCooldownMs,
    windupMs: DRILL_SERPENT_TUNING.coilMs,
    activeMs: DRILL_SERPENT_TUNING.lungeMs,
    recoveryMs: DRILL_SERPENT_TUNING.lungeRecoverMs,
    range: 360,
    chargeSpeed: DRILL_SERPENT_TUNING.lungeSpeed
  },
  drops: { healthChance: 1, ammoChance: 0, scoreChance: 1, scoreValue: 1000 },
  deathBehavior: 'explode',
  deathSequenceMs: DRILL_SERPENT_TUNING.deathMs,
  brain: 'drill_serpent',
  role: 'miniboss',
  animations: animationSet('drill_serpent')
}

/** Archetype family -> its stage skins (palette swaps cut in d19f0cc). */
export const MINIBOSS_SKINS: Readonly<Record<string, readonly string[]>> = {
  custodian_walker: ['custodian_walker_basalt', 'custodian_walker_glacier'],
  relay_turret_nest: ['relay_turret_nest_ferro'],
  sentry_twin: ['sentry_twin_gale'],
  drill_serpent: []
}

const BASES = [CUSTODIAN_WALKER, RELAY_TURRET_NEST, SENTRY_TWIN, DRILL_SERPENT]

export const MINIBOSS_CATALOG: Record<string, EnemyDefinition> = Object.fromEntries(
  BASES.flatMap((base) => [base, ...(MINIBOSS_SKINS[base.typeKey] ?? []).map((skin) => skinOf(base, skin))]).map((definition) => [
    definition.typeKey,
    definition
  ])
)

export const MINIBOSS_TYPE_KEYS = Object.keys(MINIBOSS_CATALOG)

export function isMinibossDefinition(definition?: Pick<EnemyDefinition, 'role'>): boolean {
  return definition?.role === 'miniboss'
}

/**
 * The drop a defeat forces: a mini-boss always leaves the large health capsule (heals 6, part 12h); any other enemy rolls as before
 * (undefined). The Game scene's enemy-defeat handler passes it to `spawnEnemyDrop`.
 */
export function minibossDefeatDrop(definition?: Pick<EnemyDefinition, 'role'>): 'health_large' | undefined {
  return isMinibossDefinition(definition) ? 'health_large' : undefined
}
