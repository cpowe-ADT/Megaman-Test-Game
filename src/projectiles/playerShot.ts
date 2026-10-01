import type { UpgradeModifiers } from '../progression/upgrades'
import {
  CHARGED_FAN_SPREAD_DEG,
  getChargedFormConfig,
  getWeaponConfig,
  WEAPON_TUNING,
  type WeaponChargedFormConfig,
  type WeaponFireBehavior,
  type WeaponOnHitTag,
  type WeaponRuntimeConfig
} from '../content/weapons'
import { PLAYER_GAMEPLAY_CONFIG } from '../player/config'
import { resolvePlayerProjectileId } from './definitions/coreProjectiles'
import type { ProjectileSpawnRequest } from './types'
import { resolveAimVelocity, resolveFanVelocities, type Vec } from './weaponEffects'

export type PlayerShotIntent = {
  chargeLevel: 0 | 1 | 2 | 3 | 4
  facing: 1 | -1
  /** HydroLance (`aim`): -1 with up held, 1 with down held, 0 level. */
  aim?: -1 | 0 | 1
  /** FlameSerpent (`hold_stream`): a flame the held trigger fires after the first; it costs the sustain cost. */
  sustain?: boolean
  /**
   * Flame Serpent's charged release (13d, `EVAL-P13-008`): fired once, from `WeaponRuntime.updateStream`,
   * on releasing a stream held past `WEAPON_TUNING.flameStream.chargeReadyFrames`. It bypasses the
   * `allowCharge` gate below -- Flame Serpent keeps that false so the generic charge timer (which would
   * fire a second, conflicting shot on the same release) never engages for it.
   */
  forceCharge?: boolean
}

/**
 * Whether this release fires a weapon's charged form instead of its plain shot (13d): Flame Serpent's own
 * `forceCharge` signal, or any other special held to the same top level the Buster's strongest shot needs
 * (chargeLevel 4 of the shared 190/390/710/1020ms thresholds) -- "two charge levels like the Buster" reads
 * as not-yet-full versus full, so levels 1 to 3 still show the charge aura but release as a plain shot.
 * The Buster itself is untouched: its own four levels are unaffected.
 */
function isChargedRelease(weapon: WeaponRuntimeConfig, intent: PlayerShotIntent): boolean {
  if (weapon.id === 'Buster') return false
  if (intent.forceCharge) return true
  return weapon.allowCharge && intent.chargeLevel >= 4
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

function resolveEnergyCost(weapon: WeaponRuntimeConfig, intent: PlayerShotIntent, charged: boolean, modifiers?: UpgradeModifiers): number {
  if (weapon.energyCost <= 0) return 0
  if (intent.sustain && weapon.behavior === 'hold_stream') return WEAPON_TUNING.flameStream.sustainCost
  // 13d (EVAL-P13-008): a charged special costs twice a plain shot.
  const base = charged ? weapon.energyCost * 2 : weapon.energyCost
  return Math.max(1, base - (modifiers?.specialEnergyDiscount ?? 0))
}

function resolveVelocities(weapon: WeaponRuntimeConfig, intent: PlayerShotIntent, charged: boolean): Array<Vec | undefined> {
  if (weapon.behavior === 'fan') {
    // Cyclone Volley (Aero Darts charged, 13d): five darts in a wider spread instead of three.
    const spread = charged ? CHARGED_FAN_SPREAD_DEG : undefined
    const fan = resolveFanVelocities(weapon.speed, intent.facing, spread)
    // Centre dart first so `spawnRequest` stays the level shot.
    return [...fan.filter((v) => v.y === 0), ...fan.filter((v) => v.y !== 0)]
  }
  if (weapon.behavior === 'aim' && intent.aim) return [resolveAimVelocity(weapon.speed, intent.facing, intent.aim)]
  return [undefined]
}

/** Fault Line (Quake Knuckle charged, 13d): the knuckle lands both ways, forward and back. */
const LOB_LAUNCH_VELOCITY_Y = -150

export function resolvePlayerShot(options: {
  weaponId: string
  modifiers?: UpgradeModifiers
  intent: PlayerShotIntent
  x: number
  y: number
}): ResolvedPlayerShot {
  const weapon = getWeaponConfig(options.weaponId)
  const charged = isChargedRelease(weapon, options.intent)
  const chargedForm: WeaponChargedFormConfig | undefined = charged ? getChargedFormConfig(weapon.id) : undefined
  // Specials collapse to 0 (plain) or 4 (charged, the Buster's own top level) -- levels 1 to 3 still show
  // the aura while held but release as a plain shot; the Buster keeps its real analog level.
  const chargeLevel: 0 | 1 | 2 | 3 | 4 = weapon.id === 'Buster' ? options.intent.chargeLevel : chargedForm ? 4 : 0
  const projectileId = resolvePlayerProjectileId(weapon.id, chargeLevel, Boolean(chargedForm))
  const impactFxKey =
    weapon.id === 'Buster' && chargeLevel > 0
      ? PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[chargeLevel as 1 | 2 | 3 | 4].impactFxKey
      : 'fx_impact_small'
  const damage = chargedForm?.damage ?? weapon.damage
  const onHitTag = chargedForm?.onHitTag ?? weapon.onHitTag
  const metadata = {
    weaponId: weapon.id,
    weaponElement: weapon.element,
    projectileId,
    chargeLevel,
    impactFxKey,
    source: 'player',
    behavior: weapon.behavior,
    onHitTag,
    charged: Boolean(chargedForm),
    // Thunder Spike: a plain hit always arcs to one nearby enemy; Storm Burst (charged) jumps to more, farther.
    ...(onHitTag === 'chain' ? { chainJumps: chargedForm?.chainJumps ?? WEAPON_TUNING.chain.maxJumps, chainRadius: chargedForm?.chainRadiusPx ?? WEAPON_TUNING.chain.radiusPx } : {}),
    ...(onHitTag === 'bounce' ? { bouncesLeft: chargedForm?.bounces ?? WEAPON_TUNING.bounce.bounces } : {}),
    ...(onHitTag === 'corrode' && chargedForm
      ? { corrodeTicks: chargedForm.corrodeTicks, corrodeIntervalMs: chargedForm.corrodeIntervalMs, corrodeDamage: chargedForm.corrodeDamage }
      : {}),
    ...(onHitTag === 'freeze' && chargedForm?.freezeDurationMs ? { freezeDurationMs: chargedForm.freezeDurationMs } : {}),
    ...(weapon.behavior === 'aim' ? { aim: options.intent.aim ?? 0 } : {})
  }
  const baseRequest = {
    id: projectileId,
    ...(weapon.id === 'Buster' && chargeLevel === 0 && options.modifiers ? { damage: options.modifiers.busterPelletDamage } : {}),
    ...(chargedForm && weapon.id !== 'Buster' ? { damage } : {}),
    x: options.x,
    y: options.y,
    chargeLevel,
    metadata: { ...metadata }
  }
  const spawnRequests: ProjectileSpawnRequest[] =
    chargedForm?.bothWays
      ? [
          { ...baseRequest, direction: options.intent.facing, velocity: { x: weapon.speed * options.intent.facing, y: LOB_LAUNCH_VELOCITY_Y }, metadata: { ...metadata } },
          { ...baseRequest, direction: (-options.intent.facing as 1 | -1), velocity: { x: -weapon.speed * options.intent.facing, y: LOB_LAUNCH_VELOCITY_Y }, metadata: { ...metadata } }
        ]
      : resolveVelocities(weapon, options.intent, Boolean(chargedForm)).map((velocity) => ({
          ...baseRequest,
          ...(velocity ? { velocity } : {}),
          direction: options.intent.facing,
          metadata: { ...metadata }
        }))

  return {
    projectileId,
    weapon,
    chargeLevel,
    energyCost: resolveEnergyCost(weapon, options.intent, Boolean(chargedForm), options.modifiers),
    impactFxKey,
    behavior: weapon.behavior,
    onHitTag,
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
