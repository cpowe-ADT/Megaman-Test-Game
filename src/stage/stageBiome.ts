/**
 * Which per-biome 16px tileset atlas a stage draws its platforms from. Stages absent here keep the
 * flat-rectangle look (PlatformCollisionSystem falls back automatically when the key has no texture).
 * Kept out of content/campaign.ts: that file is owned by the level lane.
 */
const STAGE_BIOME: Readonly<Record<string, string>> = {
  tutorial_sentinel: 'relay'
}

export function getStageBiome(stageId: string): string | undefined {
  return STAGE_BIOME[stageId]
}

export function tileAtlasKeyForBiome(biome: string): string {
  return `tiles_${biome}`
}

/** The atlas key this stage draws from, or undefined when it has no biome tileset yet. */
export function stageTileAtlasKey(stageId: string): string | undefined {
  const biome = getStageBiome(stageId)
  return biome ? tileAtlasKeyForBiome(biome) : undefined
}
