import { BOSS_ROSTER } from '../../bosses/roster'
import { getWeaponConfig } from '../../content/weapons'
import { PLAYER_GAMEPLAY_CONFIG } from '../../player/config'
import type { ProjectileDefinition } from '../types'

export const PROJECTILES_ATLAS_KEY = 'atlas_projectiles_core'
export const PLAYER_BULLET_FRAME = 'projectiles_core/core/000'
export const ENEMY_BULLET_FRAME = 'projectiles_core/core/009'

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
      frame: PLAYER_BULLET_FRAME,
      depth: 2,
      scale: weapon.scale,
      tint: weapon.tint,
      flipXWithDirection: true
    },
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
      frame: PLAYER_BULLET_FRAME,
      depth: 2,
      scale: charge.size,
      flipXWithDirection: true
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
    new Set<string>(['Buster', ...Object.values(BOSS_ROSTER).map((boss) => boss.weaponReward.id)])
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
