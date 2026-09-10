import { BOSS_ROSTER } from '../../bosses/roster'
import { getWeaponConfig } from '../../content/weapons'
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
}): ProjectileDefinition {
  const isLob = (config.gravityY ?? 0) > 0
  return {
    id: config.id,
    owner: 'enemy',
    pool: 'enemy',
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
    visual: {
      textureKey: PROJECTILES_ATLAS_KEY,
      frame: resolvePlayerWeaponFrame(weapon.id),
      depth: 2,
      scale: weapon.scale,
      tint: weapon.tint,
      flipXWithDirection: true
    },
    // Enemy movement colliders hug their feet. Keep a generous, centered combat
    // sensor so a muzzle-height pellet cannot pass over short ground enemies.
    hitbox: weapon.id === 'Buster' ? { width: 14, height: 54 } : { width: 16, height: 46 },
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
    visual: {
      textureKey: PROJECTILES_ATLAS_KEY,
      frame: resolvePlayerChargeFrame(level),
      depth: 2,
      scale: charge.size,
      flipXWithDirection: true
    },
    hitbox: {
      width: 14 + level * 4,
      height: 54 + level * 2
    },
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
    createEnemyDefinition({
      id: 'enemy_basic_shot',
      frame: ENEMY_BULLET_FRAME,
      speed: 220,
      damage: 1,
      lifetimeMs: 2500,
      tint: 0xff3b30
    }),
    createEnemyDefinition({
      id: 'boss_fire_orb',
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
      frame: 'projectiles_core/core/001',
      speed: 285,
      damage: 1,
      lifetimeMs: 2400,
      scale: 1.45,
      tint: 0x75ddff
    }),
    createEnemyDefinition({
      id: 'boss_arc_shard',
      frame: 'projectiles_core/core/004',
      speed: 245,
      damage: 1,
      lifetimeMs: 2200,
      scale: 1.25,
      tint: 0xffee78
    }),
    createEnemyDefinition({
      id: 'boss_acid_glob',
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
      frame: 'projectiles_core/core/009',
      speed: 200,
      damage: 1,
      lifetimeMs: 2500
    }),
    createEnemyDefinition({
      id: 'enemy_shot_frost',
      frame: 'projectiles_core/core/014',
      speed: 180,
      damage: 1,
      lifetimeMs: 3000,
      tint: 0x89e2ff
    }),
    createEnemyDefinition({
      id: 'enemy_shot_shield',
      frame: 'projectiles_core/core/015',
      speed: 220,
      damage: 1,
      lifetimeMs: 2000,
      tint: 0xdaf3ff
    }),
    createEnemyDefinition({
      id: 'enemy_rocket_lob',
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
      frame: 'projectiles_core/core/021',
      speed: 280,
      damage: 2,
      lifetimeMs: 1200,
      tint: 0xf7ff87
    })
  ]
}
