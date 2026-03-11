import Phaser from 'phaser'
import { EnemyProjectileDefinition } from './types'
import { ProjectileSystem } from '../projectiles'

export const EnemyProjectileCatalog: Record<string, EnemyProjectileDefinition> = {
  enemy_shot_basic: { key: 'enemy_shot_basic', speed: 200, gravity: 0, lifetimeMs: 2500, damage: 1 },
  enemy_shot_frost: { key: 'enemy_shot_frost', speed: 180, gravity: 0, lifetimeMs: 3000, damage: 1 },
  enemy_shot_shield: { key: 'enemy_shot_shield', speed: 220, gravity: 0, lifetimeMs: 2000, damage: 1 },
  enemy_rocket_lob: { key: 'enemy_rocket_lob', speed: 160, gravity: 320, lifetimeMs: 3600, damage: 2, arc: -0.25 },
  enemy_mine_drop: { key: 'enemy_mine_drop', speed: 90, gravity: 380, lifetimeMs: 5000, damage: 2, arc: 0.12 },
  enemy_beam_pulse: { key: 'enemy_beam_pulse', speed: 280, gravity: 0, lifetimeMs: 1200, damage: 2 }
}

export function spawnEnemyProjectile(
  _scene: Phaser.Scene,
  _group: Phaser.Physics.Arcade.Group,
  projectileSystem: ProjectileSystem,
  definition: EnemyProjectileDefinition,
  origin: Phaser.Math.Vector2,
  direction: 1 | -1,
  aimAt?: Phaser.Math.Vector2
): Phaser.Physics.Arcade.Sprite | null {
  const velocity = new Phaser.Math.Vector2(direction * definition.speed, 0)
  if (aimAt) {
    velocity.set(aimAt.x - origin.x, aimAt.y - origin.y).normalize().scale(definition.speed)
  }
  if (definition.arc) {
    velocity.rotate(definition.arc)
  }
  return projectileSystem.spawn({
    id: definition.key,
    x: origin.x,
    y: origin.y,
    direction,
    speed: definition.speed,
    damage: definition.damage,
    velocity: {
      x: velocity.x,
      y: velocity.y
    },
    metadata: {
      enemyProjectileKey: definition.key
    }
  })
}
