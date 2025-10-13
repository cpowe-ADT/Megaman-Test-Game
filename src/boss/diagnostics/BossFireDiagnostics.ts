import Phaser from 'phaser'
import { DIAGNOSTICS_ENABLED } from '../../config/diagnostics'
import { EVENTS, emitBossEvent, BossProjectileSpawnedEvent } from '../../events'

export interface BossProjectileDiagnosticsState {
  placeholderTextureKey: string
  usedPlaceholder: boolean
  totalSpawns: number
  lastSpawnAt?: number
  groupFullHits: number
}

export interface ProjectileFactoryDetails {
  id: string
  attackName?: string
  mode: 'controller' | 'legacy'
  group?: Phaser.Physics.Arcade.Group
  sprite?: Phaser.GameObjects.GameObject | null
}

export type ProjectileDetailsProvider<T extends (...args: any[]) => any> = (
  result: ReturnType<T>,
  ...args: Parameters<T>
) => ProjectileFactoryDetails

export function ensurePlaceholderTexture(scene: Phaser.Scene): BossProjectileDiagnosticsState {
  const key = 'pixel'
  let usedPlaceholder = false
  if (!scene.textures.exists(key)) {
    const gfx = scene.add.graphics()
    gfx.fillStyle(0xffffff, 1).fillRect(0, 0, 1, 1)
    gfx.generateTexture(key, 1, 1)
    gfx.destroy()
    usedPlaceholder = true
  }
  return {
    placeholderTextureKey: key,
    usedPlaceholder,
    totalSpawns: 0,
    groupFullHits: 0
  }
}

export function wrapBossProjectileFactory<T extends (...args: any[]) => any>(
  state: BossProjectileDiagnosticsState,
  factory: T,
  detailsProvider: ProjectileDetailsProvider<T>,
  scene: Phaser.Scene
): T {
  if (!DIAGNOSTICS_ENABLED) {
    return factory
  }

  return ((...args: Parameters<T>) => {
    const result = factory(...args)
    const details = detailsProvider(result, ...args)
    state.totalSpawns += 1
    state.lastSpawnAt = scene.time.now

    const sprite = details.sprite as { texture?: { key: string } } | undefined
    const payload: BossProjectileSpawnedEvent = {
      id: details.id,
      attackName: details.attackName,
      timestamp: scene.time.now,
      mode: details.mode,
      texture: sprite?.texture?.key,
      groupSize: details.group
        ? { used: details.group.getTotalUsed(), total: details.group.getLength() }
        : undefined
    }
    emitBossEvent(EVENTS.BOSS_PROJECTILE_SPAWNED, payload)

    return result
  }) as T
}

export function noteGroupFull(
  state: BossProjectileDiagnosticsState,
  group: Phaser.Physics.Arcade.Group,
  mode: 'controller' | 'legacy'
): void {
  if (!DIAGNOSTICS_ENABLED) {
    return
  }
  state.groupFullHits += 1
  const payload: BossProjectileSpawnedEvent = {
    id: 'group-full',
    attackName: 'capacity',
    timestamp: group.scene.time.now,
    mode,
    groupSize: { used: group.getTotalUsed(), total: group.getLength() },
    texture: undefined
  }
  emitBossEvent(EVENTS.BOSS_PROJECTILE_SPAWNED, payload)
}

export function hasCapacity(group: Phaser.Physics.Arcade.Group): boolean {
  if (!group) {
    return false
  }
  const max = group.maxSize <= 0 ? group.getLength() : group.maxSize
  const used = group.getTotalUsed()
  if (max > 0 && used >= max) {
    return false
  }
  return true
}
