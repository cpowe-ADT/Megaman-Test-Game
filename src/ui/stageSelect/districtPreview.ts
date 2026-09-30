import { getCampaignStage } from '../../content/campaign'

/**
 * Part 12i (EVAL-P8-003): Stage Select's district preview, composed from the selected stage's own parallax layers the
 * way the stage itself composes them (no new art). Pure: the presenter draws the plan and asks which textures to drop.
 */
export type DistrictPreviewLayer = { key: string; y: number; tint?: number; alpha: number; driftPxPerS: number }
export type DistrictPreviewPlan = { stageId: string; baseColor: string; layers: DistrictPreviewLayer[] }

/** Drift pace: the layer's in-game scroll factor times this, so far layers crawl and near ones slide. */
export const DISTRICT_DRIFT_PX_PER_S = 60

export function districtPreviewPlan(stageId: string): DistrictPreviewPlan {
  const background = getCampaignStage(stageId).arena.background
  return {
    stageId,
    baseColor: background?.baseColor ?? '#0a1428',
    layers: (background?.layers ?? []).map((layer) => ({
      key: layer.key,
      y: layer.y ?? 0,
      tint: layer.tint,
      alpha: layer.alpha ?? 1,
      driftPxPerS: (layer.scrollFactorX ?? 0) * DISTRICT_DRIFT_PX_PER_S
    }))
  }
}

/**
 * Textures the preview loaded that neither the district on screen nor the stage being launched draws. Only keys the
 * preview itself loaded are candidates, so a resident layer (the Preload set) is never dropped.
 */
export function previewKeysToEvict(loadedByPreview: readonly string[], keepStageIds: readonly (string | null | undefined)[]): string[] {
  const keep = new Set(keepStageIds.flatMap((id) => (id ? districtPreviewPlan(id).layers.map((layer) => layer.key) : [])))
  return loadedByPreview.filter((key) => !keep.has(key))
}

/** `tint` moved `amount` of the way to white: menus show a district brighter than a stage does behind its tiles. */
export function liftTint(tint: number | undefined, amount: number): number {
  const base = tint ?? 0xffffff
  const lift = (channel: number) => Math.round(channel + (255 - channel) * amount)
  return (lift((base >> 16) & 0xff) << 16) | (lift((base >> 8) & 0xff) << 8) | lift(base & 0xff)
}

/** The restored-district tile flip: the tile folds shut, swaps to its cleared face at the midpoint, and opens again. */
export const TILE_FLIP_MS = 360

export function tileFlipScaleX(elapsedMs: number): number {
  const half = TILE_FLIP_MS / 2
  const t = Math.max(0, Math.min(TILE_FLIP_MS, elapsedMs))
  return t < half ? 1 - t / half : (t - half) / half
}
