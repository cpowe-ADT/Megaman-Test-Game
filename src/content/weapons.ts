import { BOSS_ROSTER } from '../bosses/roster'
import type { Element, WeaponId } from '../bosses/types'

export type WeaponRuntimeId = 'Buster' | WeaponId

export type WeaponProjectileStyle = 'standard' | 'wave' | 'lob' | 'boomerang'

export type WeaponProjectileConfig = {
  style: WeaponProjectileStyle
  lifetimeMs: number
  pierce: number
  gravityY?: number
  waveAmplitude?: number
  wavePeriodMs?: number
  returnAfterMs?: number
  returnSpeed?: number
}

/**
 * How the shoot button drives a weapon (prompt 07 phase 7.3, EVAL-P7-004): one hold or charge behaviour each.
 * `charge` holds to charge and releases to fire; `hold_stream` keeps firing while shoot is held; `aim` tilts the
 * shot with up or down held; `lob` throws in an arc; `boomerang` flies out and back; `fan` fires a spread.
 */
export type WeaponFireBehavior = 'charge' | 'saber_release' | 'hold_stream' | 'aim' | 'lob' | 'boomerang' | 'fan' | 'straight'

/**
 * What a hit does besides damage, applied by `ProjectileCollisionRouter` (targets) and `ProjectileSystem`
 * (floors and walls): `burn` leaves a burn puddle, `pierce` passes through, `chain` arcs to nearby enemies,
 * `quake` shakes the floor where it lands, `magnet` pulls drops, `corrode` sticks and ticks, `bounce` bounces
 * once, `freeze` freezes an enemy solid (a platform).
 */
export type WeaponOnHitTag = 'none' | 'burn' | 'pierce' | 'chain' | 'quake' | 'magnet' | 'corrode' | 'bounce' | 'freeze'

export type WeaponRuntimeConfig = {
  id: WeaponRuntimeId
  displayName: string
  element: Element
  energyCost: number
  maxEnergy: number
  damage: number
  speed: number
  scale: number
  /** The weapon's colour: the HUD bar and stripe (the shot draws its own art). */
  tint?: number
  allowCharge: boolean
  behavior: WeaponFireBehavior
  onHitTag: WeaponOnHitTag
  /** `weapons_v1` art group (`src/projectiles/weaponArt.ts`); the Buster draws `projectiles_hero`. */
  artGroup?: string
  projectile: WeaponProjectileConfig
}

/** Tuning for the behaviours and on-hit tags above; the effects read it from here. */
export const WEAPON_TUNING = {
  /**
   * FlameSerpent: after the first flame, a trigger held `startFrames` frames streams a flame every `intervalFrames`
   * (counted in frames, so a tap never streams however slow the frame); each streamed flame costs `sustainCost`.
   */
  flameStream: { startFrames: 12, intervalFrames: 8, sustainCost: 1 },
  /** The puddle a flame leaves where it hits an enemy or the floor. */
  burnPuddle: { lifetimeMs: 900, damage: 1, pierce: 6, scale: 0.5 },
  /** HydroLance: up or down held at the trigger tilts the lance this far. */
  hydroAim: { angleDeg: 32 },
  /** ThunderSpike: each charge level adds one jump to an enemy within the radius, up to `maxJumps`. */
  chain: { radiusPx: 104, maxJumps: 3, arcMs: 140 },
  /** QuakeKnuckle: the shockwave where it lands hits grounded enemies across this floor strip. */
  quake: { widthPx: 120, heightPx: 22, damage: 3, lifetimeMs: 160, pierce: 8 },
  /** MagcutDisc: drops within the radius drift to the disc while it flies. */
  magnet: { radiusPx: 84, pullSpeed: 220 },
  /** AcidGlob: the glob sticks to the enemy and ticks this much damage. */
  corrode: { ticks: 3, intervalMs: 400, damage: 1 },
  /** AeroDarts: three darts in a spread, each bounces once off a floor or wall. */
  fan: { spreadDeg: [-14, 0, 14] as readonly number[] },
  bounce: { bounces: 1 },
  /** FrostShatter: the enemy is frozen solid (hitstun and an ice block to stand on) this long. */
  freeze: { durationMs: 1500 }
} as const

type WeaponOverride = Omit<WeaponRuntimeConfig, 'id' | 'displayName' | 'element' | 'energyCost' | 'maxEnergy'>

const SPECIAL_WEAPON_OVERRIDES: Partial<Record<WeaponRuntimeId, WeaponOverride>> = {
  ArcSlash: {
    damage: 2,
    speed: 260,
    scale: 0.85,
    tint: 0xd9d9ff,
    allowCharge: false,
    behavior: 'saber_release',
    onHitTag: 'none',
    artGroup: 'arc_slash',
    projectile: { style: 'standard', lifetimeMs: 600, pierce: 0 }
  },
  FlameSerpent: {
    damage: 3,
    speed: 250,
    scale: 0.7,
    tint: 0xff9040,
    allowCharge: false,
    behavior: 'hold_stream',
    onHitTag: 'burn',
    artGroup: 'flame_serpent',
    projectile: { style: 'wave', lifetimeMs: 520, pierce: 0, waveAmplitude: 6, wavePeriodMs: 150 }
  },
  HydroLance: {
    damage: 3,
    speed: 320,
    scale: 0.72,
    tint: 0x66d6ff,
    allowCharge: false,
    behavior: 'aim',
    onHitTag: 'pierce',
    artGroup: 'hydro_lance',
    projectile: { style: 'standard', lifetimeMs: 860, pierce: 2 }
  },
  ThunderSpike: {
    damage: 4,
    speed: 340,
    scale: 0.72,
    tint: 0xfff066,
    allowCharge: true,
    behavior: 'charge',
    onHitTag: 'chain',
    artGroup: 'thunder_spike',
    projectile: { style: 'standard', lifetimeMs: 760, pierce: 0 }
  },
  QuakeKnuckle: {
    damage: 4,
    speed: 220,
    scale: 0.7,
    tint: 0xd29f68,
    allowCharge: false,
    behavior: 'lob',
    onHitTag: 'quake',
    artGroup: 'quake_knuckle',
    projectile: { style: 'lob', lifetimeMs: 1400, pierce: 0, gravityY: 760 }
  },
  MagcutDisc: {
    damage: 3,
    speed: 330,
    scale: 0.75,
    tint: 0xc3d6ff,
    allowCharge: false,
    behavior: 'boomerang',
    onHitTag: 'magnet',
    artGroup: 'magcut_disc',
    projectile: { style: 'boomerang', lifetimeMs: 1400, pierce: 1, returnAfterMs: 260, returnSpeed: 290 }
  },
  AcidGlob: {
    damage: 3,
    speed: 250,
    scale: 0.65,
    tint: 0x8cff84,
    allowCharge: false,
    behavior: 'lob',
    onHitTag: 'corrode',
    artGroup: 'acid_glob',
    projectile: { style: 'lob', lifetimeMs: 1200, pierce: 0, gravityY: 560 }
  },
  AeroDarts: {
    damage: 2,
    speed: 360,
    scale: 0.55,
    tint: 0xd0f2ff,
    allowCharge: false,
    behavior: 'fan',
    onHitTag: 'bounce',
    artGroup: 'aero_darts',
    projectile: { style: 'standard', lifetimeMs: 900, pierce: 0 }
  },
  FrostShatter: {
    damage: 4,
    speed: 300,
    scale: 0.72,
    tint: 0xc7f2ff,
    allowCharge: false,
    behavior: 'straight',
    onHitTag: 'freeze',
    artGroup: 'frost_shatter',
    projectile: { style: 'standard', lifetimeMs: 920, pierce: 0 }
  }
}

export const BUSTER_WEAPON_CONFIG: WeaponRuntimeConfig = {
  id: 'Buster',
  displayName: 'Buster',
  element: 'Normal',
  energyCost: 0,
  maxEnergy: 28,
  damage: 1,
  speed: 260,
  scale: 1,
  allowCharge: true,
  behavior: 'charge',
  onHitTag: 'none',
  projectile: {
    style: 'standard',
    lifetimeMs: 720,
    pierce: 0
  }
}

export const SPECIAL_WEAPON_ORDER: WeaponRuntimeId[] = Object.values(BOSS_ROSTER)
  .map((blueprint) => blueprint.weaponReward?.id)
  .filter((id): id is WeaponId => Boolean(id))
  .filter((id) => id !== 'ArcSlash') as WeaponRuntimeId[]

const SPECIAL_WEAPONS = Object.values(BOSS_ROSTER).reduce<Partial<Record<WeaponRuntimeId, WeaponRuntimeConfig>>>((acc, blueprint) => {
  const reward = blueprint.weaponReward
  if (!reward) {
    return acc
  }
  const overrides = SPECIAL_WEAPON_OVERRIDES[reward.id]
  acc[reward.id] = {
    damage: 2,
    speed: 300,
    scale: 1.1,
    allowCharge: false,
    behavior: 'straight',
    onHitTag: 'none',
    projectile: { style: 'standard', lifetimeMs: 820, pierce: 0 },
    ...overrides,
    id: reward.id,
    displayName: reward.displayName,
    element: reward.element,
    // Authored costs apply as written (prompt 07 phase 7.3: they are no longer squashed to 1-3).
    energyCost: Math.max(0, reward.energyCost),
    maxEnergy: reward.maxEnergy
  }
  return acc
}, { Buster: BUSTER_WEAPON_CONFIG })

export function getWeaponConfig(id: string): WeaponRuntimeConfig {
  return SPECIAL_WEAPONS[id as WeaponRuntimeId] ?? BUSTER_WEAPON_CONFIG
}

export function getWeaponDisplayName(id: string): string {
  return getWeaponConfig(id).displayName
}

export function buildWeaponOrder(unlocked: string[]): WeaponRuntimeId[] {
  const result: WeaponRuntimeId[] = ['Buster']
  for (const weaponId of SPECIAL_WEAPON_ORDER) {
    if (unlocked.includes(weaponId)) {
      result.push(weaponId)
    }
  }
  return result
}

export function buildWeaponEnergySnapshot(unlocked: string[]): Record<string, number> {
  const energy: Record<string, number> = { Buster: BUSTER_WEAPON_CONFIG.maxEnergy }
  for (const weaponId of buildWeaponOrder(unlocked)) {
    const config = getWeaponConfig(weaponId)
    energy[weaponId] = config.maxEnergy
  }
  return energy
}
