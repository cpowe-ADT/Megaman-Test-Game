import type { EnemyLevelMarker } from '../enemy/types'

export const BOSS_ROOM_VIEWPORT_WIDTH = 448

export type StageBackgroundLayerDefinition = {
  key: string
  scrollFactorX: number
  y: number
  alpha?: number
  tint?: number
}

export type StageBackgroundDefinition = {
  baseColor: string
  layers: StageBackgroundLayerDefinition[]
}

export type StageBossRoomDefinition = {
  x: number
  width: number
  leftInset: number
  rightInset: number
  playerIntroX: number
  bossSpawnX: number
  lockCamera: true
}

export type MovementBounds = {
  minX: number
  maxX: number
}

export function clampBossXToBounds(x: number, bounds: MovementBounds): number {
  return Math.max(bounds.minX, Math.min(bounds.maxX, x))
}

export function buildDefaultBossRoom(
  worldWidth: number,
  options?: { viewportWidth?: number; bossSpawnX?: number }
): StageBossRoomDefinition {
  const width = Math.min(Math.max(160, options?.viewportWidth ?? BOSS_ROOM_VIEWPORT_WIDTH), worldWidth)
  const x = Math.max(0, worldWidth - width)
  const leftInset = 24
  const rightInset = 24
  const minBossX = x + leftInset + 84
  const maxBossX = x + width - rightInset - 40
  const requestedBossX = options?.bossSpawnX ?? x + width - rightInset - 88

  return {
    x,
    width,
    leftInset,
    rightInset,
    playerIntroX: x + 72,
    bossSpawnX: clampBossXToBounds(requestedBossX, { minX: minBossX, maxX: maxBossX }),
    lockCamera: true
  }
}

export function filterBossRoomHazards<T extends { x: number }>(hazards: T[], bossRoom: StageBossRoomDefinition): T[] {
  return hazards.filter((hazard) => hazard.x < bossRoom.x - 24)
}

export function filterBossRoomPlatforms<T extends { x: number; width: number }>(
  platforms: T[],
  bossRoom: StageBossRoomDefinition
): T[] {
  return platforms.filter((platform) => platform.x + platform.width / 2 < bossRoom.x - 12)
}

export function filterBossRoomEnemies<T extends Pick<EnemyLevelMarker, 'x'>>(
  enemyMarkers: T[],
  bossRoom: StageBossRoomDefinition
): T[] {
  return enemyMarkers.filter((marker) => marker.x < bossRoom.x - 20)
}

export function getBossRoomMovementBounds(bossRoom: StageBossRoomDefinition): MovementBounds {
  return {
    minX: bossRoom.x + bossRoom.leftInset,
    maxX: bossRoom.x + bossRoom.width - bossRoom.rightInset
  }
}

export function getBossRoomGateX(bossRoom: StageBossRoomDefinition): number {
  return Math.max(8, bossRoom.x - 8)
}

export function getBossRoomActivationX(bossRoom: StageBossRoomDefinition): number {
  return bossRoom.x + 24
}

export function getBossRoomCameraBounds(bossRoom: StageBossRoomDefinition, height: number) {
  return {
    x: bossRoom.x,
    y: 0,
    width: bossRoom.width,
    height
  }
}
