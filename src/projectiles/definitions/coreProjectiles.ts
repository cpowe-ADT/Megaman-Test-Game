import { BOSS_ROSTER } from '../../bosses/roster'
import { BUSTER_SHOT_VISUALS, HERO_PROJECTILES_ATLAS, REFLECTED_SHOT_VISUAL, type ChargeLevel } from '../../combat/heroCombatVisuals'

/** An enemy shot the saber sent back (src/combat/SwordHitRouter.ts): a player shot drawn as `reflected`. */
export const PLAYER_REFLECTED_SHOT_ID = 'player_reflected_shot'

function createReflectedShotDefinition(): ProjectileDefinition {
  return {
    id: PLAYER_REFLECTED_SHOT_ID,
    owner: 'player',
    pool: 'player',
    speed: 260,
    damage: 2,
    lifetimeMs: 1600,
    maxVelocityX: 640,
    maxVelocityY: 640,
    visual: {
      textureKey: HERO_PROJECTILES_ATLAS.key,
      frame: REFLECTED_SHOT_VISUAL.frames[0],
      animationFrames: REFLECTED_SHOT_VISUAL.frames,
      animationFrameMs: Math.round(1000 / REFLECTED_SHOT_VISUAL.frameRate),
      depth: 2,
      scale: REFLECTED_SHOT_VISUAL.scale,
      flipXWithDirection: true
    },
    hitbox: { width: REFLECTED_SHOT_VISUAL.width, height: REFLECTED_SHOT_VISUAL.height },
    behavior: { kind: 'standard' },
    hitPolicy: { hitsEnvironment: true, collidesWithWorldBounds: true, pierce: 0 }
  }
}
import { getWeaponConfig, WEAPON_TUNING, type WeaponRuntimeConfig } from '../../content/weapons'
import { WEAPON_ART_FRAME_SIZE, WEAPONS_ATLAS, weaponArtFrame } from '../weaponArt'
import { BURN_PUDDLE_PROJECTILE_ID, QUAKE_WAVE_PROJECTILE_ID } from '../weaponEffects'
import { PLAYER_GAMEPLAY_CONFIG } from '../../player/config'
import type { ProjectileDefinition } from '../types'

export const PROJECTILES_ATLAS_KEY = 'atlas_projectiles_core'
export const PLAYER_BULLET_FRAME = 'projectiles_core/core/000'
export const ENEMY_BULLET_FRAME = 'projectiles_core/core/009'

const PLAYER_WEAPON_FRAMES: Record<string, string> = {
  Buster: 'projectiles_core/core/000',
  ArcSlash: 'projectiles_core/core/006',
  FlameSerpent: 'projectiles_core/core/003',
  HydroLance: 'projectiles_core/core/001',
  ThunderSpike: 'projectiles_core/core/004',
  QuakeKnuckle: 'projectiles_core/core/011',
  MagcutDisc: 'projectiles_core/core/017',
  AcidGlob: 'projectiles_core/core/012',
  AeroDarts: 'projectiles_core/core/005',
  FrostShatter: 'projectiles_core/core/002'
}

const PLAYER_CHARGE_FRAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'projectiles_core/core/000',
  2: 'projectiles_core/core/001',
  3: 'projectiles_core/core/006',
  4: 'projectiles_core/core/007'
}

export function resolvePlayerWeaponFrame(weaponId: string): string {
  return PLAYER_WEAPON_FRAMES[weaponId] ?? PLAYER_BULLET_FRAME
}

export function resolvePlayerChargeFrame(level: 1 | 2 | 3 | 4): string {
  return PLAYER_CHARGE_FRAMES[level]
}

function createEnemyDefinition(config: {
  id: string
  frame: string
  speed: number
  damage: number
  lifetimeMs: number
  gravityY?: number
  scale?: number
  tint?: number
  /** The saber can send it back: orbs, pellets and missiles yes; beams, lasers and flames no. */
  reflectable: boolean
}): ProjectileDefinition {
  const isLob = (config.gravityY ?? 0) > 0
  return {
    id: config.id,
    owner: 'enemy',
    pool: 'enemy',
    reflectable: config.reflectable,
    speed: config.speed,
    damage: config.damage,
    lifetimeMs: config.lifetimeMs,
    maxVelocityX: 640,
    maxVelocityY: 640,
    visual: {
      textureKey: PROJECTILES_ATLAS_KEY,
      frame: config.frame,
      depth: 1000,
      alpha: 1,
      scale: config.scale ?? 1.1,
      tint: config.tint,
      blendMode: 'ADD',
      flipXWithDirection: false
    },
    behavior: isLob
      ? {
          kind: 'lob',
          gravityY: config.gravityY ?? 0,
          initialVelocityY: -150
        }
      : { kind: 'standard' },
    hitPolicy: {
      hitsEnvironment: true,
      collidesWithWorldBounds: true,
      pierce: 0
    }
  }
}

function createEnemyBoomerangDefinition(): ProjectileDefinition {
  return {
    id: 'boss_mag_disc',
    owner: 'enemy',
    pool: 'enemy',
    // A boomerang steers itself home; a reflect would fight its behaviour.
    reflectable: false,
    speed: 250,
    damage: 2,
    lifetimeMs: 3200,
    maxVelocityX: 640,
    maxVelocityY: 640,
    visual: {
      textureKey: PROJECTILES_ATLAS_KEY,
      frame: 'projectiles_core/core/017',
      depth: 1000,
      scale: 1.45,
      tint: 0xc9e2ff,
      blendMode: 'ADD',
      flipXWithDirection: false
    },
    behavior: { kind: 'boomerang', returnAfterMs: 520, returnSpeed: 310, homeOffsetY: -8 },
    hitPolicy: { hitsEnvironment: false, collidesWithWorldBounds: false, pierce: 1 }
  }
}

/**
 * Buster art from projectiles_hero (pellet lv0, mid lv1-2, full lv3-4; heroCombatVisuals.ts). The body
 * is as wide as the drawing (frame width x scale); its height stays the tall combat sensor, in game px,
 * that the old 20x20 circles had (so short ground enemies are still met at muzzle height).
 */
const BUSTER_SENSOR_HEIGHT: Record<ChargeLevel, number> = {
  0: 54,
  1: (54 + 2) * PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[1].size,
  2: (54 + 4) * PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[2].size,
  3: (54 + 6) * PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[3].size,
  4: (54 + 8) * PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[4].size
}

function busterVisual(level: ChargeLevel, depth: number): ProjectileDefinition['visual'] {
  const art = BUSTER_SHOT_VISUALS[level]
  return {
    textureKey: HERO_PROJECTILES_ATLAS.key,
    frame: art.frames[0],
    animationFrames: art.frames,
    animationFrameMs: Math.round(1000 / art.frameRate),
    depth,
    scale: art.scale,
    flipXWithDirection: true
  }
}

/** Body in source px (Arcade scales it by the sprite scale): drawn width, and the sensor height in game px. */
function busterHitbox(level: ChargeLevel, sensorHeightPx: number): { width: number; height: number } {
  const art = BUSTER_SHOT_VISUALS[level]
  return { width: art.width, height: Math.ceil(sensorHeightPx / art.scale) }
}

/** A warden weapon's `weapons_v1` group: four frames cycled in flight, flipped with facing (prompt 07 phase 7.3). */
function weaponArtVisual(group: string, scale: number, depth: number, alpha?: number): ProjectileDefinition['visual'] {
  const frames = [0, 1, 2, 3].map((index) => weaponArtFrame(group, index))
  return { textureKey: WEAPONS_ATLAS.key, frame: frames[0], animationFrames: frames, animationFrameMs: 70, depth, scale, flipXWithDirection: true, ...(alpha != null ? { alpha } : {}) }
}

/**
 * Bodies sized to the art (source px; Arcade scales them with the sprite). Level shots keep the Buster's tall
 * combat sensor (46 game px) so a muzzle-height shot still meets short ground enemies; lobs, the disc and the
 * bouncing darts are exactly the drawing, so they land and bounce where they are drawn.
 */
export function weaponArtHitbox(weapon: Pick<WeaponRuntimeConfig, 'artGroup' | 'scale' | 'behavior' | 'projectile'>): { width: number; height: number } {
  const art = WEAPON_ART_FRAME_SIZE[weapon.artGroup ?? ''] ?? { width: 16, height: 16 }
  const levelShot = (weapon.projectile.style === 'standard' || weapon.projectile.style === 'wave') && weapon.behavior !== 'fan'
  return { width: art.width, height: levelShot ? Math.max(art.height, Math.ceil(46 / weapon.scale)) : art.height }
}

/** FlameSerpent's burn puddle and QuakeKnuckle's shockwave: stationary, short-lived, they hit what walks in. */
function createFollowUpDefinitions(): ProjectileDefinition[] {
  const burn = WEAPON_TUNING.burnPuddle
  const quake = WEAPON_TUNING.quake
  const flame = WEAPON_ART_FRAME_SIZE.flame_serpent
  const still = { speed: 0, maxVelocityX: 0, maxVelocityY: 0, owner: 'player', pool: 'player', behavior: { kind: 'standard' } } as const
  return [
    {
      ...still,
      id: BURN_PUDDLE_PROJECTILE_ID,
      damage: burn.damage,
      lifetimeMs: burn.lifetimeMs,
      visual: { ...weaponArtVisual('flame_serpent', burn.scale, 2, 0.9), animationFrameMs: 90 },
      hitbox: { width: flame.width, height: flame.height },
      hitPolicy: { hitsEnvironment: false, collidesWithWorldBounds: false, pierce: burn.pierce }
    },
    {
      ...still,
      id: QUAKE_WAVE_PROJECTILE_ID,
      damage: quake.damage,
      lifetimeMs: quake.lifetimeMs,
      // Drawn by ProjectileSystem as a dust ring and a camera shake; the body is the floor strip it hits.
      visual: { ...weaponArtVisual('quake_knuckle', 1, 2, 0), animationFrames: undefined, flipXWithDirection: false },
      hitbox: { width: quake.widthPx, height: quake.heightPx },
      hitPolicy: { hitsEnvironment: false, collidesWithWorldBounds: false, pierce: quake.pierce }
    }
  ]
}

function createPlayerWeaponDefinition(weaponId: string): ProjectileDefinition {
  const weapon = getWeaponConfig(weaponId)
  const style = weapon.projectile.style

  return {
    id: `player_weapon_${weapon.id}`,
    owner: 'player',
    pool: 'player',
    speed: weapon.speed,
    damage: weapon.damage,
    lifetimeMs: weapon.projectile.lifetimeMs,
    maxVelocityX: 640,
    maxVelocityY: 640,
    visual: weapon.id === 'Buster' ? busterVisual(0, 2) : weapon.artGroup ? weaponArtVisual(weapon.artGroup, weapon.scale, 2) : {
      textureKey: PROJECTILES_ATLAS_KEY, frame: resolvePlayerWeaponFrame(weapon.id), depth: 2, scale: weapon.scale, tint: weapon.tint, flipXWithDirection: true
    },
    hitbox: weapon.id === 'Buster' ? busterHitbox(0, BUSTER_SENSOR_HEIGHT[0]) : weaponArtHitbox(weapon),
    behavior:
      style === 'wave'
        ? {
            kind: 'wave',
            amplitude: weapon.projectile.waveAmplitude ?? 0,
            periodMs: weapon.projectile.wavePeriodMs ?? 160
          }
        : style === 'lob'
          ? {
              kind: 'lob',
              gravityY: weapon.projectile.gravityY ?? 0,
              initialVelocityY: -150
            }
          : style === 'boomerang'
            ? {
                kind: 'boomerang',
                returnAfterMs: weapon.projectile.returnAfterMs ?? 220,
                returnSpeed: weapon.projectile.returnSpeed ?? Math.abs(weapon.speed),
                homeOffsetY: -6
              }
            : { kind: 'standard' },
    hitPolicy: {
      hitsEnvironment: true,
      collidesWithWorldBounds: true,
      pierce: weapon.projectile.pierce
    }
  }
}

function createChargeDefinition(level: 1 | 2 | 3 | 4): ProjectileDefinition {
  const charge = PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[level]

  return {
    id: `player_buster_charge_lv${level}`,
    owner: 'player',
    pool: 'player',
    speed: charge.speed,
    damage: charge.damage,
    lifetimeMs: 840,
    maxVelocityX: 640,
    maxVelocityY: 640,
    visual: busterVisual(level, 2),
    hitbox: busterHitbox(level, BUSTER_SENSOR_HEIGHT[level]),
    behavior: { kind: 'standard' },
    hitPolicy: {
      hitsEnvironment: true,
      collidesWithWorldBounds: true,
      pierce: charge.pierce
    }
  }
}

export function resolvePlayerProjectileId(
  weaponId: string,
  chargeLevel: 0 | 1 | 2 | 3 | 4
): string {
  if (weaponId === 'Buster' && chargeLevel > 0) {
    return `player_buster_charge_lv${chargeLevel}`
  }
  if (weaponId === 'Buster') {
    return 'player_weapon_Buster'
  }
  return `player_weapon_${weaponId}`
}

export function createCoreProjectileDefinitions(): ProjectileDefinition[] {
  const weaponIds = Array.from(
    new Set<string>([
      'Buster',
      ...Object.values(BOSS_ROSTER)
        .map((boss) => boss.weaponReward?.id)
        .filter((id): id is NonNullable<typeof id> => Boolean(id))
    ])
  )

  return [
    ...weaponIds.map((weaponId) => createPlayerWeaponDefinition(weaponId)),
    createChargeDefinition(1),
    createChargeDefinition(2),
    createChargeDefinition(3),
    createChargeDefinition(4),
    createReflectedShotDefinition(),
    ...createFollowUpDefinitions(),
    createEnemyDefinition({
      id: 'enemy_basic_shot',
      reflectable: true,
      frame: ENEMY_BULLET_FRAME,
      speed: 220,
      damage: 1,
      lifetimeMs: 2500,
      tint: 0xff3b30
    }),
    createEnemyDefinition({
      id: 'boss_fire_orb',
      reflectable: true,
      frame: 'projectiles_core/core/003',
      speed: 170,
      damage: 2,
      lifetimeMs: 2800,
      gravityY: 330,
      scale: 1.7,
      tint: 0xff7a2f
    }),
    createEnemyDefinition({
      id: 'boss_water_lance',
      reflectable: false,
      frame: 'projectiles_core/core/001',
      speed: 285,
      damage: 1,
      lifetimeMs: 2400,
      scale: 1.45,
      tint: 0x75ddff
    }),
    createEnemyDefinition({
      id: 'boss_arc_shard',
      reflectable: true,
      frame: 'projectiles_core/core/004',
      speed: 245,
      damage: 1,
      lifetimeMs: 2200,
      scale: 1.25,
      tint: 0xffee78
    }),
    createEnemyDefinition({
      id: 'boss_acid_glob',
      reflectable: true,
      frame: 'projectiles_core/core/012',
      speed: 165,
      damage: 2,
      lifetimeMs: 2800,
      gravityY: 300,
      scale: 1.55,
      tint: 0x75f06c
    }),
    createEnemyDefinition({
      id: 'boss_static_orb',
      reflectable: true,
      frame: 'projectiles_core/core/015',
      speed: 205,
      damage: 1,
      lifetimeMs: 2800,
      scale: 1.45,
      tint: 0x8df5ff
    }),
    createEnemyBoomerangDefinition(),
    createEnemyDefinition({
      id: 'enemy_shot_basic',
      reflectable: true,
      frame: 'projectiles_core/core/009',
      speed: 200,
      damage: 1,
      lifetimeMs: 2500
    }),
    createEnemyDefinition({
      id: 'enemy_shot_frost',
      reflectable: true,
      frame: 'projectiles_core/core/014',
      speed: 180,
      damage: 1,
      lifetimeMs: 3000,
      tint: 0x89e2ff
    }),
    createEnemyDefinition({
      id: 'enemy_shot_shield',
      reflectable: true,
      frame: 'projectiles_core/core/015',
      speed: 220,
      damage: 1,
      lifetimeMs: 2000,
      tint: 0xdaf3ff
    }),
    createEnemyDefinition({
      id: 'enemy_rocket_lob',
      reflectable: true,
      frame: 'projectiles_core/core/003',
      speed: 160,
      damage: 2,
      lifetimeMs: 3600,
      gravityY: 320,
      scale: 1.15,
      tint: 0xffb36b
    }),
    createEnemyDefinition({
      id: 'enemy_mine_drop',
      reflectable: true,
      frame: 'projectiles_core/core/019',
      speed: 90,
      damage: 2,
      lifetimeMs: 5000,
      gravityY: 380,
      scale: 1.15,
      tint: 0xff6b6b
    }),
    createEnemyDefinition({
      id: 'enemy_beam_pulse',
      reflectable: false,
      frame: 'projectiles_core/core/021',
      speed: 280,
      damage: 2,
      lifetimeMs: 1200,
      tint: 0xf7ff87
    })
  ]
}
