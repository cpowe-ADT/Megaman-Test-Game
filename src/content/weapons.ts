/** Weapon configs: the Buster and each boss weapon's tuning, charged forms and fire behaviour, plus energy and weapon-order helpers. */
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
  /** The weapon-get card and the weapon demo's one-line flavour text (13d, `EVAL-P13-013`). */
  useLine?: string
}

/**
 * A weapon's charged form (13d, `EVAL-P13-008`): its own move, not a bigger copy of the plain shot.
 * Released at the top of the charge (chargeLevel 4, the same hold as the Buster's strongest shot), or
 * for Flame Serpent, on releasing a stream held past `WEAPON_TUNING.flameStream.chargeReadyFrames`.
 * Costs twice the plain shot (`resolveEnergyCost`) and deals triple on a boss (`bossDamageScale`).
 */
export type WeaponChargedFormConfig = {
  /** Documentation and debug only (EVAL_LEDGER, the demo); not rendered on the HUD. */
  name: string
  damage: number
  speed: number
  scale: number
  onHitTag: WeaponOnHitTag
  /** `weapons_v1` charged-effect art group (nine sheets, 13d item 3). */
  artGroup: string
  projectile: WeaponProjectileConfig
  /** Chain (Thunder Spike): jumps and radius past the plain shot's fixed one jump. */
  chainJumps?: number
  chainRadiusPx?: number
  /** Corrode (Acid Glob): ticks, interval and per-tick damage past `WEAPON_TUNING.corrode`. */
  corrodeTicks?: number
  corrodeIntervalMs?: number
  corrodeDamage?: number
  /** Freeze (Frost Shatter): duration past `WEAPON_TUNING.freeze.durationMs`. */
  freezeDurationMs?: number
  /** Bounce (Aero Darts): bounces past `WEAPON_TUNING.bounce.bounces`. */
  bounces?: number
  /** Quake Knuckle only: the charged knuckle lands both ways (forward and back). */
  bothWays?: boolean
}

/** Tuning for the behaviours and on-hit tags above; the effects read it from here. */
export const WEAPON_TUNING = {
  /**
   * FlameSerpent: after the first flame, a trigger held `startFrames` frames streams a flame every `intervalFrames`
   * (counted in frames, so a tap never streams however slow the frame); each streamed flame costs `sustainCost`.
   */
  flameStream: {
    startFrames: 12,
    intervalFrames: 8,
    sustainCost: 1,
    /** 13d (EVAL-P13-008): held this many update ticks (~1s) past the first flame, releasing fires
     * Inferno Coil instead of just ending the stream. */
    chargeReadyFrames: 60
  },
  /** The puddle a flame leaves where it hits an enemy or the floor. */
  burnPuddle: { lifetimeMs: 900, damage: 1, pierce: 6, scale: 0.5 },
  /** Inferno Coil (Flame Serpent's charged release): a bigger puddle. */
  burnPuddleCharged: { lifetimeMs: 1400, damage: 2, pierce: 10, scale: 0.9 },
  /** HydroLance: up or down held at the trigger tilts the lance this far. */
  hydroAim: { angleDeg: 32 },
  /** ThunderSpike's plain shot always arcs to one nearby enemy; Storm Burst (charged) jumps to more,
   * farther (`WeaponChargedFormConfig.chainJumps`/`chainRadiusPx`). */
  chain: { radiusPx: 104, maxJumps: 1, arcMs: 140 },
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

type WeaponOverride = Omit<WeaponRuntimeConfig, 'id' | 'displayName' | 'element' | 'maxEnergy'>

/**
 * Energy costs (13d, `EVAL-P13-007`, Craig: "they should last a bit longer they finish too fast"): a
 * 28-unit bar at 1 (light), 2 (medium) or 4 (heavy) a shot, so 7 to 28 shots. The table and its reasons
 * are in `docs/design/weapons.md`; Arc Slash keeps its own cost (forced to 0 in `firePlayerShot.ts` --
 * the tutorial saber has no cycling slot or bar to spend from).
 */
const SPECIAL_WEAPON_OVERRIDES: Partial<Record<WeaponRuntimeId, WeaponOverride>> = {
  ArcSlash: {
    energyCost: 2,
    damage: 2,
    speed: 260,
    scale: 0.85,
    tint: 0xd9d9ff,
    allowCharge: false,
    behavior: 'saber_release',
    onHitTag: 'none',
    artGroup: 'arc_slash',
    projectile: { style: 'standard', lifetimeMs: 600, pierce: 0 },
    useLine: 'A dash-saber cut. No bar to spend -- it is always ready.'
  },
  FlameSerpent: {
    energyCost: 2,
    damage: 3,
    speed: 250,
    scale: 0.7,
    tint: 0xff9040,
    // Its own hold-to-stream charge lives in WeaponRuntime.updateStream (13d): the generic charge
    // timer would fire a second, conflicting shot on release, so this stays false.
    allowCharge: false,
    behavior: 'hold_stream',
    onHitTag: 'burn',
    artGroup: 'flame_serpent',
    projectile: { style: 'wave', lifetimeMs: 520, pierce: 0, waveAmplitude: 6, wavePeriodMs: 150 },
    useLine: 'A burning stream. Hold it a beat past full and release for Inferno Coil.'
  },
  HydroLance: {
    energyCost: 2,
    damage: 3,
    speed: 320,
    scale: 0.72,
    tint: 0x66d6ff,
    allowCharge: true,
    behavior: 'aim',
    onHitTag: 'pierce',
    artGroup: 'hydro_lance',
    // 13d (EVAL-P13-007): a generous backstop now that a standard shot leaves on camera exit, not a
    // fixed timer (ProjectileSystem.ts) -- it used to die at 275 px of a 448 px view.
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 2 },
    useLine: 'A piercing lance, tiltable up or down. Charge it for Tidal Surge.'
  },
  ThunderSpike: {
    energyCost: 4,
    damage: 4,
    speed: 340,
    scale: 0.72,
    tint: 0xfff066,
    allowCharge: true,
    behavior: 'charge',
    onHitTag: 'chain',
    artGroup: 'thunder_spike',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 0 },
    useLine: 'Arcs to one nearby foe. Charge it for Storm Burst, a wider chain.'
  },
  QuakeKnuckle: {
    energyCost: 4,
    damage: 4,
    speed: 220,
    scale: 0.7,
    tint: 0xd29f68,
    allowCharge: true,
    behavior: 'lob',
    onHitTag: 'quake',
    artGroup: 'quake_knuckle',
    projectile: { style: 'lob', lifetimeMs: 1400, pierce: 0, gravityY: 760 },
    useLine: 'A lobbed knuckle that quakes the floor. Charge it for Fault Line, both ways.'
  },
  MagcutDisc: {
    energyCost: 1,
    damage: 3,
    speed: 330,
    scale: 0.75,
    tint: 0xc3d6ff,
    allowCharge: true,
    behavior: 'boomerang',
    onHitTag: 'magnet',
    artGroup: 'magcut_disc',
    projectile: { style: 'boomerang', lifetimeMs: 1400, pierce: 1, returnAfterMs: 260, returnSpeed: 290 },
    useLine: 'A thrown disc, hits out and back, pulls drops in. Charge it for Twin Cutter.'
  },
  AcidGlob: {
    energyCost: 2,
    damage: 3,
    speed: 250,
    scale: 0.65,
    tint: 0x8cff84,
    allowCharge: true,
    behavior: 'lob',
    onHitTag: 'corrode',
    artGroup: 'acid_glob',
    projectile: { style: 'lob', lifetimeMs: 1200, pierce: 0, gravityY: 560 },
    useLine: 'Sticks and ticks damage. Charge it for Corrosive Burst, more ticks.'
  },
  AeroDarts: {
    energyCost: 1,
    damage: 2,
    speed: 360,
    scale: 0.55,
    tint: 0xd0f2ff,
    allowCharge: true,
    behavior: 'fan',
    onHitTag: 'bounce',
    artGroup: 'aero_darts',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 0 },
    useLine: 'Three bouncing darts in a spread. Charge it for Cyclone Volley, five darts.'
  },
  FrostShatter: {
    energyCost: 4,
    damage: 4,
    speed: 300,
    scale: 0.72,
    tint: 0xc7f2ff,
    allowCharge: true,
    behavior: 'straight',
    onHitTag: 'freeze',
    artGroup: 'frost_shatter',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 0 },
    useLine: 'Freezes a foe solid. Charge it for Glacial Ram, a longer freeze.'
  }
}

export const BUSTER_WEAPON_CONFIG: WeaponRuntimeConfig = {
  id: 'Buster',
  displayName: 'Buster',
  element: 'Normal',
  energyCost: 0,
  maxEnergy: 28,
  damage: 1,
  // 13b.3 (EVAL-P13-004): at least 360 px/s so the pellet outruns the dash (about 320); it used to lag
  // behind and draw under the hero's own body for the whole dash. `lifetimeMs` is a generous backstop
  // now that `ProjectileSystem` expires a standard player shot when it leaves the camera view instead.
  speed: 370,
  scale: 1,
  allowCharge: true,
  behavior: 'charge',
  onHitTag: 'none',
  projectile: {
    style: 'standard',
    lifetimeMs: 2000,
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
    energyCost: 2,
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
    // 13d (EVAL-P13-007): every special's bar is 28 units now (Craig: "they finish too fast"), not the
    // boss roster's authored max (24 to 40) -- the per-weapon cost (`SPECIAL_WEAPON_OVERRIDES`, docs/design/weapons.md) is what varies.
    maxEnergy: 28
  }
  return acc
}, { Buster: BUSTER_WEAPON_CONFIG })

/**
 * A weapon's charged form (13d, `EVAL-P13-008`): looked up only when the shot is actually charged
 * (`resolvePlayerShot`); Arc Slash and the Buster have none (the Buster's own four levels are unchanged).
 */
const SPECIAL_WEAPON_CHARGED_FORMS: Partial<Record<WeaponRuntimeId, WeaponChargedFormConfig>> = {
  FlameSerpent: {
    name: 'Inferno Coil',
    damage: 6,
    speed: 260,
    scale: 1.3,
    onHitTag: 'burn',
    artGroup: 'flame_serpent_charged',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 1 }
  },
  HydroLance: {
    name: 'Tidal Surge',
    damage: 5,
    speed: 340,
    scale: 1.25,
    onHitTag: 'pierce',
    artGroup: 'hydro_lance_charged',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 6 }
  },
  ThunderSpike: {
    name: 'Storm Burst',
    damage: 6,
    speed: 380,
    scale: 1.3,
    onHitTag: 'chain',
    artGroup: 'thunder_spike_charged',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 0 },
    chainJumps: 5,
    chainRadiusPx: 150
  },
  QuakeKnuckle: {
    name: 'Fault Line',
    damage: 6,
    speed: 240,
    scale: 1.25,
    onHitTag: 'quake',
    artGroup: 'quake_knuckle_charged',
    projectile: { style: 'lob', lifetimeMs: 1400, pierce: 0, gravityY: 760 },
    bothWays: true
  },
  MagcutDisc: {
    name: 'Twin Cutter',
    damage: 5,
    speed: 350,
    scale: 1.3,
    onHitTag: 'magnet',
    artGroup: 'magcut_disc_charged',
    projectile: { style: 'boomerang', lifetimeMs: 1400, pierce: 3, returnAfterMs: 340, returnSpeed: 320 }
  },
  AcidGlob: {
    name: 'Corrosive Burst',
    damage: 5,
    speed: 270,
    scale: 1.3,
    onHitTag: 'corrode',
    artGroup: 'acid_glob_charged',
    projectile: { style: 'lob', lifetimeMs: 1200, pierce: 0, gravityY: 520 },
    corrodeTicks: 5,
    corrodeIntervalMs: 350,
    corrodeDamage: 2
  },
  AeroDarts: {
    name: 'Cyclone Volley',
    damage: 3,
    speed: 380,
    scale: 0.68,
    onHitTag: 'bounce',
    artGroup: 'aero_darts_charged',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 0 },
    bounces: 2
  },
  FrostShatter: {
    name: 'Glacial Ram',
    damage: 6,
    speed: 260,
    scale: 1.3,
    onHitTag: 'freeze',
    artGroup: 'frost_shatter_charged',
    projectile: { style: 'standard', lifetimeMs: 2000, pierce: 2 },
    freezeDurationMs: 2500
  }
}

/** Aero Darts' charged spread (13d): five darts, wider than the plain three. */
export const CHARGED_FAN_SPREAD_DEG: readonly number[] = [-28, -14, 0, 14, 28]

export function getChargedFormConfig(weaponId: string): WeaponChargedFormConfig | undefined {
  return SPECIAL_WEAPON_CHARGED_FORMS[weaponId as WeaponRuntimeId]
}

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

/** Whether `id` is a weapon this game actually has (the Buster, Arc Slash or a warden special). */
function isKnownWeaponId(id: string): boolean {
  return id === 'Buster' || id === 'ArcSlash' || (SPECIAL_WEAPON_ORDER as readonly string[]).includes(id)
}

/**
 * A save's stored energy for one weapon, clamped to that weapon's current max (13d, `EVAL-P13-007`): a
 * save from before the 28-unit rebalance could hold up to 40 for Flame Serpent, over today's cap. An id
 * outside today's roster (a stale or foreign key) passes through unclamped rather than being coerced to
 * the Buster's cap.
 */
export function clampWeaponEnergy(weaponId: string, storedEnergy: number): number {
  if (!isKnownWeaponId(weaponId)) return storedEnergy
  const max = getWeaponConfig(weaponId).maxEnergy
  if (!Number.isFinite(storedEnergy)) return max
  return Math.max(0, Math.min(max, Math.round(storedEnergy)))
}

/** The same clamp over a whole `weaponEnergyById` map (`RunState.applyActiveRunSnapshot`). */
export function clampWeaponEnergySnapshot(energyById: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(energyById).map(([weaponId, energy]) => [weaponId, clampWeaponEnergy(weaponId, energy)]))
}
