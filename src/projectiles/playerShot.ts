import type { UpgradeModifiers } from '../progression/upgrades'
import { getWeaponConfig, WEAPON_TUNING, type WeaponFireBehavior, type WeaponOnHitTag, type WeaponRuntimeConfig } from '../content/weapons'
import { PLAYER_GAMEPLAY_CONFIG } from '../player/config'
import { resolvePlayerProjectileId } from './definitions/coreProjectiles'
import type { ProjectileSpawnRequest } from './types'
import { chainJumpsForCharge, resolveAimVelocity, resolveFanVelocities, type Vec } from './weaponEffects'

export type PlayerShotIntent = {
  chargeLevel: 0 | 1 | 2 | 3 | 4
  facing: 1 | -1
  /** HydroLance (`aim`): -1 with up held, 1 with down held, 0 level. */
  aim?: -1 | 0 | 1
  /** FlameSerpent (`hold_stream`): a flame the held trigger fires after the first; it costs the sustain cost. */
  sustain?: boolean
}

export type ResolvedPlayerShot = {
  projectileId: string
  weapon: WeaponRuntimeConfig
  chargeLevel: 0 | 1 | 2 | 3 | 4
  energyCost: number
  impactFxKey: string
  behavior: WeaponFireBehavior
  onHitTag: WeaponOnHitTag
  /** The first projectile (the centre dart of a fan). */
  spawnRequest: ProjectileSpawnRequest
  /** Every projectile one trigger fires: three for AeroDarts, one for the rest. */
  spawnRequests: ProjectileSpawnRequest[]
}

function resolveEnergyCost(weapon: WeaponRuntimeConfig, intent: PlayerShotIntent, modifiers?: UpgradeModifiers): number {
  if (weapon.energyCost <= 0) return 0
  if (intent.sustain && weapon.behavior === 'hold_stream') return WEAPON_TUNING.flameStream.sustainCost
  return Math.max(1, weapon.energyCost - (modifiers?.specialEnergyDiscount ?? 0))
}

function resolveVelocities(weapon: WeaponRuntimeConfig, intent: PlayerShotIntent): Array<Vec | undefined> {
  if (weapon.behavior === 'fan') {
    const fan = resolveFanVelocities(weapon.speed, intent.facing)
    // Centre dart first so `spawnRequest` stays the level shot.
    return [...fan.filter((v) => v.y === 0), ...fan.filter((v) => v.y !== 0)]
  }
  if (weapon.behavior === 'aim' && intent.aim) return [resolveAimVelocity(weapon.speed, intent.facing, intent.aim)]
  return [undefined]
}

export function resolvePlayerShot(options: {
  weaponId: string
  modifiers?: UpgradeModifiers
  intent: PlayerShotIntent
  x: number
  y: number
}): ResolvedPlayerShot {
  const weapon = getWeaponConfig(options.weaponId)
  const chargeLevel = weapon.allowCharge ? options.intent.chargeLevel : 0
  const projectileId = resolvePlayerProjectileId(weapon.id, chargeLevel)
  const impactFxKey =
    weapon.id === 'Buster' && chargeLevel > 0
      ? PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[chargeLevel as 1 | 2 | 3 | 4].impactFxKey
      : 'fx_impact_small'
  const special = weapon.id !== 'Buster'
  const metadata = {
    weaponId: weapon.id,
    weaponElement: weapon.element,
    projectileId,
    chargeLevel,
    impactFxKey,
    source: 'player',
    behavior: weapon.behavior,
    onHitTag: weapon.onHitTag,
    ...(weapon.onHitTag === 'chain' ? { chainJumps: chainJumpsForCharge(chargeLevel) } : {}),
    ...(weapon.onHitTag === 'bounce' ? { bouncesLeft: WEAPON_TUNING.bounce.bounces } : {}),
    ...(weapon.behavior === 'aim' ? { aim: options.intent.aim ?? 0 } : {})
  }
  const spawnRequests: ProjectileSpawnRequest[] = resolveVelocities(weapon, options.intent).map((velocity) => ({
    id: projectileId,
    ...(weapon.id === 'Buster' && chargeLevel === 0 && options.modifiers ? { damage: options.modifiers.busterPelletDamage } : {}),
    // A charged ThunderSpike draws a little larger per level.
    ...(special && chargeLevel > 0 ? { scale: Math.round(weapon.scale * (1 + 0.12 * chargeLevel) * 100) / 100 } : {}),
    ...(velocity ? { velocity } : {}),
    x: options.x,
    y: options.y,
    direction: options.intent.facing,
    chargeLevel,
    metadata: { ...metadata }
  }))

  return {
    projectileId,
    weapon,
    chargeLevel,
    energyCost: resolveEnergyCost(weapon, options.intent, options.modifiers),
    impactFxKey,
    behavior: weapon.behavior,
    onHitTag: weapon.onHitTag,
    spawnRequest: spawnRequests[0],
    spawnRequests
  }
}

export function canAffordPlayerShot(availableEnergy: number, energyCost: number): boolean {
  return energyCost <= 0 || availableEnergy >= energyCost
}

export function energyAfterPlayerShot(
  availableEnergy: number,
  energyCost: number,
  projectileSpawned: boolean
): number {
  if (!projectileSpawned || energyCost <= 0) {
    return availableEnergy
  }
  return Math.max(0, availableEnergy - energyCost)
}
