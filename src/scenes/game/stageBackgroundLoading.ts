import type Phaser from 'phaser'
import { getCampaignStage } from '../../content/campaign'
import { STAGE_BACKGROUND_ASSETS, type StageBackgroundAsset } from '../../content/stageBackgroundCatalog'
import { queueStageTileAtlas } from './stageTileLoading'

/**
 * Stage backgrounds load per stage, not per game. Each 384x216 layer is 0.33MB decoded whatever its
 * PNG weighs, and Preload used to hold all 30 catalog layers (9.2MB) for a stage that draws four or five.
 */

/** Layers a scene outside a stage draws: the prologue drifts the dock skyline. Preload keeps these. */
export const RESIDENT_BACKGROUND_KEYS: readonly string[] = ['bg_dock_0']

export type GameStartData = { stageId?: string; bossId?: string; loadFromSave?: boolean } | undefined | null

/** The stage the Game scene will build from its start data: a resumed run wins, then the stage, then the boss id. */
export function resolveGameStageId(data: GameStartData, activeRun: { stageId?: string } | null | undefined): string {
  return activeRun?.stageId ?? data?.stageId ?? data?.bossId ?? 'pyro_maw'
}

export function stageBackgroundKeys(stageId: string): string[] {
  return (getCampaignStage(stageId).arena.background?.layers ?? []).map((layer) => layer.key)
}

export function stageBackgroundAssets(stageId: string): StageBackgroundAsset[] {
  const keys = new Set(stageBackgroundKeys(stageId))
  return STAGE_BACKGROUND_ASSETS.filter((asset) => keys.has(asset.key))
}

export function residentBackgroundAssets(): StageBackgroundAsset[] {
  return STAGE_BACKGROUND_ASSETS.filter((asset) => RESIDENT_BACKGROUND_KEYS.includes(asset.key))
}

/** Background textures to drop before building `stageId`: everything but its own layers and the resident set. */
export function backgroundKeysToEvict(loadedKeys: readonly string[], stageId: string): string[] {
  const keep = new Set([...RESIDENT_BACKGROUND_KEYS, ...stageBackgroundKeys(stageId)])
  const catalog = new Set(STAGE_BACKGROUND_ASSETS.map((asset) => asset.key))
  return loadedKeys.filter((key) => catalog.has(key) && !keep.has(key))
}

/**
 * Called from Game.preload(): drops the previous stage's layers (its objects were destroyed at
 * shutdown) and queues this stage's. Keys already loaded are skipped, so a restart loads nothing
 * and Phaser runs create() in the same step.
 */
export function queueStageBackgrounds(scene: Phaser.Scene, stageId: string): void {
  backgroundKeysToEvict(scene.textures.getTextureKeys(), stageId).forEach((key) => scene.textures.remove(key))
  stageBackgroundAssets(stageId).forEach((asset) => {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.path)
    }
  })
}

/** Everything Game.preload() queues for a stage: its background layers and its biome tile atlas. */
export function queueStageAssets(scene: Phaser.Scene, stageId: string): void {
  queueStageBackgrounds(scene, stageId)
  queueStageTileAtlas(scene, stageId)
}
