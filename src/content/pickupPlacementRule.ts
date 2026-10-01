import { CAMPAIGN_STAGES, getCampaignStage } from './campaign'
import { getStageLocationDefinitions } from '../progression/catalog'
import type { LocationCheckCategory } from '../progression/types'
import { mainGroundPlatforms } from '../stage/stageGeometry'
import { stageMechanicPlatforms } from '../mechanics/stageMechanics'
import { GAME_HEIGHT } from '../config/renderPolicy'
import { LOCATION_ART, PICKUP_ART_SCALE, type PickupArtGroup } from '../ui/pickups/pickupArt'

/**
 * Part 13e (`EVAL-P13-010`): the `content:lint`-ready pickup placement rule, promoted from the probe at
 * `output/probes/13a/placement-audit.ts` (13a item 1's placement audit). Pure: no Phaser, no fs, so it runs
 * as a plain unit test (`tests/pickup-placement.test.ts`) without a scene; the caller supplies each pickup art
 * group's real cut frame size (read from the atlas JSON, the way `tests/pickup-art.test.ts` already reads it)
 * rather than this module touching the filesystem itself, so it stays usable from a future `content:lint`
 * script or from a browser-side check equally.
 */

export type SurfaceRect = { id: string; left: number; right: number; top: number; bottom: number; type: string; moving: boolean }

export type PlacementVerdict = 'grounded' | 'floating_ok' | 'floating_wrong' | 'over_pit' | 'inside_solid'

export type PickupFrameSize = { width: number; height: number }

export type PlacementRow = {
  stage: string
  id: string
  category: LocationCheckCategory
  x: number
  y: number
  rest: 'ground' | 'float'
  artBottom: number
  surfaceTop: number | null
  gap: number | null
  verdict: PlacementVerdict
}

/** A sink of up to this many px still counts as grounded (matches the original probe's tolerance). */
export const GROUND_TOLERANCE_PX = 2

/**
 * Every surface a pickup can rest on for one stage: the floor, its mid platforms and its mechanic platforms
 * (mirrors what `Game.ts` hands `PlatformCollisionSystem.rebuild`).
 */
export function buildStageSurfaces(stageId: string): SurfaceRect[] {
  const stage = getCampaignStage(stageId)
  const arena = stage.arena
  const width = Number(arena.width ?? 448)
  const defs = [
    ...mainGroundPlatforms(stage.id, width, GAME_HEIGHT, arena.floorGaps),
    ...arena.midPlatforms.map((p) => ({ ...p, height: p.height ?? 8, type: p.type ?? 'oneWay' })),
    ...stageMechanicPlatforms(arena)
  ] as Array<{ id: string; x: number; y: number; width: number; height?: number; type?: string; motion?: { toX: number } }>
  return defs.map((p) => {
    const h = p.height ?? 8
    const x0 = Math.min(p.x, p.motion?.toX ?? p.x)
    const x1 = Math.max(p.x, p.motion?.toX ?? p.x)
    return {
      id: p.id,
      left: x0 - p.width / 2,
      right: x1 + p.width / 2,
      top: p.y - h / 2,
      bottom: p.y + h / 2,
      type: p.type ?? 'oneWay',
      moving: Boolean(p.motion)
    }
  })
}

/**
 * Classifies one art box against a stage's surfaces: `inside_solid` wins over everything (a solid, wall or
 * belt overlapping the art by more than the tolerance), then `over_pit` (nothing at all underneath), then a
 * float only needs a real surface below; a ground needs to sit within `tolerancePx` of it.
 */
export function classifyPlacement(
  art: { left: number; right: number; top: number; bottom: number },
  x: number,
  surfaces: SurfaceRect[],
  rest: 'ground' | 'float',
  tolerancePx = GROUND_TOLERANCE_PX
): { verdict: PlacementVerdict; gap: number | null; surfaceTop: number | null } {
  const blocking = surfaces.find(
    (r) =>
      r.type !== 'oneWay' &&
      r.type !== 'passThrough' &&
      art.right > r.left &&
      art.left < r.right &&
      art.bottom - tolerancePx > r.top &&
      art.top < r.bottom
  )
  if (blocking) {
    return { verdict: 'inside_solid', gap: null, surfaceTop: null }
  }
  const below = surfaces
    .filter((r) => x >= r.left && x <= r.right && r.top >= art.bottom - tolerancePx)
    .sort((a, b) => a.top - b.top)
  const surface = below[0]
  if (!surface) {
    return { verdict: 'over_pit', gap: null, surfaceTop: null }
  }
  const gap = Math.round((surface.top - art.bottom) * 10) / 10
  if (rest === 'float') {
    return { verdict: 'floating_ok', gap, surfaceTop: surface.top }
  }
  return { verdict: gap <= tolerancePx ? 'grounded' : 'floating_wrong', gap, surfaceTop: surface.top }
}

/**
 * Every campaign placement (every warden stage's four anchors, the tutorial's two defaults), classified
 * against its stage's real surfaces and the art group's real cut frame size. A category whose group is
 * missing from `frameSizes` is skipped rather than guessed, so a caller can audit a subset while art is
 * mid-generation.
 */
export function auditPickupPlacements(
  frameSizes: Partial<Record<PickupArtGroup, PickupFrameSize>>,
  scale = PICKUP_ART_SCALE
): PlacementRow[] {
  const rows: PlacementRow[] = []
  for (const stageId of Object.keys(CAMPAIGN_STAGES)) {
    const surfaces = buildStageSurfaces(stageId)
    const locations = getStageLocationDefinitions(stageId).filter(
      (location) => location.category !== 'boss_clear' && location.x != null && location.y != null
    )
    for (const location of locations) {
      const category = location.category as Exclude<LocationCheckCategory, 'boss_clear'>
      const group = LOCATION_ART[category]
      const size = frameSizes[group]
      if (!size) {
        continue
      }
      const x = Number(location.x)
      const y = Number(location.y)
      const art = {
        left: x - (size.width / 2) * scale,
        right: x + (size.width / 2) * scale,
        top: y - (size.height / 2) * scale,
        bottom: y + (size.height / 2) * scale
      }
      const { verdict, gap, surfaceTop } = classifyPlacement(art, x, surfaces, location.rest)
      rows.push({
        stage: stageId,
        id: location.id,
        category: location.category,
        x,
        y,
        rest: location.rest,
        artBottom: Math.round(art.bottom * 10) / 10,
        surfaceTop,
        gap,
        verdict
      })
    }
  }
  return rows
}
