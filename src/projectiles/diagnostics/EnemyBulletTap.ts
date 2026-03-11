import Phaser from 'phaser'

export const ENEMY_BULLET_TEXTURE_KEY = 'atlas_projectiles_core'

export type BulletSpawnEvent = {
  x: number
  y: number
  t: number
  key: string
  via: 'factory' | 'group'
  hadBody: boolean
  active: boolean
  visible: boolean
}

export const onEnemyBulletSpawn = new Phaser.Events.EventEmitter()

export function ensureBulletPlaceholder(scene: Phaser.Scene): void {
  if (scene.textures.exists(ENEMY_BULLET_TEXTURE_KEY)) {
    return
  }
}

function isArcadeSprite(value: unknown): value is Phaser.Physics.Arcade.Sprite {
  return (
    value instanceof Phaser.Physics.Arcade.Sprite ||
    (!!value && typeof value === 'object' && 'body' in (value as Record<string, unknown>))
  )
}

export function wrapEnemyProjectileFactory<T extends (...args: any[]) => any>(
  factoryFn: T,
  scene: Phaser.Scene,
  group: Phaser.Physics.Arcade.Group
): T {
  const proxy = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const before = new Set(group.getChildren() as Phaser.GameObjects.GameObject[])
    const result = factoryFn.apply(this, args) as ReturnType<T>

    let detected: Phaser.GameObjects.GameObject | null = null
    let via: BulletSpawnEvent['via'] = 'factory'

    if (isArcadeSprite(result)) {
      detected = result
      via = 'factory'
    }

    if (!detected) {
      const after = group.getChildren() as Phaser.GameObjects.GameObject[]
      for (let i = after.length - 1; i >= 0; i -= 1) {
        const child = after[i]
        if (!before.has(child)) {
          detected = child
          via = 'group'
          break
        }
      }
    }

    if (!detected) {
      via = 'group'
    }

    const sprite = detected as Phaser.Physics.Arcade.Sprite | null
    const body = sprite?.body as Phaser.Physics.Arcade.Body | undefined
    const event: BulletSpawnEvent = {
      x: sprite?.x ?? Number.NaN,
      y: sprite?.y ?? Number.NaN,
      t: scene.time?.now ?? performance.now(),
      key: sprite?.texture?.key ?? ENEMY_BULLET_TEXTURE_KEY,
      via,
      hadBody: !!body,
      active: sprite?.active ?? false,
      visible: sprite?.visible ?? false
    }

    onEnemyBulletSpawn.emit('spawn', event)

    return result
  }

  return proxy as T
}
