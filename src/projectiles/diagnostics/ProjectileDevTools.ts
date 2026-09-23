import Phaser from 'phaser'

export function getLatestActiveProjectile(
  group?: Phaser.Physics.Arcade.Group
): Phaser.Physics.Arcade.Sprite | null {
  if (!group) {
    return null
  }

  let latest: Phaser.Physics.Arcade.Sprite | null = null
  group.children.iterate((child) => {
    const sprite = child as Phaser.Physics.Arcade.Sprite | null
    if (sprite?.active) {
      latest = sprite
    }
    return false
  })
  return latest
}

export function summarizeProjectilePool(
  group?: Phaser.Physics.Arcade.Group
): { active: number; size: number } | null {
  if (!group) {
    return null
  }

  return {
    active: group.countActive(true),
    size: group.getLength()
  }
}

type SpawnProjectileClashOptions = {
  playerGroup?: Phaser.Physics.Arcade.Group
  enemyGroup?: Phaser.Physics.Arcade.Group
  spawnPlayerProjectile: () => void
  spawnEnemyProjectile: () => void
  clashX: number
  clashY: number
  speed?: number
}

export function spawnDebugProjectileClash(options: SpawnProjectileClashOptions): { playerBullets: number; enemyBullets: number } | null {
  const { playerGroup, enemyGroup, clashX, clashY } = options
  if (!playerGroup || !enemyGroup) {
    return null
  }

  const speed = options.speed ?? 220
  options.spawnPlayerProjectile()
  const playerBullet = getLatestActiveProjectile(playerGroup)
  if (playerBullet?.active) {
    playerBullet.setPosition(clashX - 22, clashY)
    const body = playerBullet.body as Phaser.Physics.Arcade.Body | undefined
    body?.reset?.(playerBullet.x, playerBullet.y)
    body?.setVelocityX?.(speed)
    body?.setVelocityY?.(0)
  }

  options.spawnEnemyProjectile()
  const enemyBullet = getLatestActiveProjectile(enemyGroup)
  if (enemyBullet?.active) {
    enemyBullet.setPosition(clashX + 22, clashY)
    const body = enemyBullet.body as Phaser.Physics.Arcade.Body | undefined
    body?.reset?.(enemyBullet.x, enemyBullet.y)
    body?.setVelocityX?.(-speed)
    body?.setVelocityY?.(0)
  }

  return {
    playerBullets: playerGroup.countActive(true),
    enemyBullets: enemyGroup.countActive(true)
  }
}
