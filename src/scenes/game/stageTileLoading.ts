import type Phaser from 'phaser'
import { getStageBiome, stageTileAtlasKey, tileAtlasKeyForBiome } from '../../stage/stageBiome'

/**
 * Biome tile atlases load per stage, the same rule as backgrounds (stageBackgroundLoading.ts): only
 * the active biome stays resident, so a stage with no biome yet never pays for one it does not use.
 */
const TILE_ATLAS_BASE_PATH = 'assets/sprites/tiles'

export { stageTileAtlasKey }

function stageTileAtlasPaths(biome: string): { png: string; json: string } {
  const base = `${TILE_ATLAS_BASE_PATH}/${biome}/tiles_${biome}`
  return { png: `${base}.png`, json: `${base}.atlas.json` }
}

/** Loaded tile-atlas keys to drop before building `stageId`: every biome atlas but this stage's own. */
export function tileAtlasKeysToEvict(loadedKeys: readonly string[], stageId: string): string[] {
  const keep = stageTileAtlasKey(stageId)
  return loadedKeys.filter((key) => key.startsWith('tiles_') && key !== keep)
}

/**
 * Called from Game.preload(): drops any other stage's biome atlas and queues this stage's, if it has
 * one. A key already loaded (or a stage with no biome) is a no-op.
 */
export function queueStageTileAtlas(scene: Phaser.Scene, stageId: string): void {
  tileAtlasKeysToEvict(scene.textures.getTextureKeys(), stageId).forEach((key) => scene.textures.remove(key))
  const biome = getStageBiome(stageId)
  if (!biome) {
    return
  }
  const key = tileAtlasKeyForBiome(biome)
  if (scene.textures.exists(key)) {
    return
  }
  const { png, json } = stageTileAtlasPaths(biome)
  scene.load.atlas(key, png, json)
}
