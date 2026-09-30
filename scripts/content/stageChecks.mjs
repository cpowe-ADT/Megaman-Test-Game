// Pure content-lint rules over the compiled campaign stages (13h: prompt 06 §6.9, EVAL-P6-013,
// EVAL-P6-002, EVAL-P6-003, part of prompt 13's item 13h.1). No Phaser, no browser: every function here
// takes plain data already returned by `getCampaignStage` / `getStageContentRetentionReport`
// (`src/content/campaign.ts`) plus the same pure geometry helpers the renderer itself uses
// (`src/stage/stageGeometry.ts`, `src/mechanics/hazards.ts`), so a rule here can never disagree with
// what the game actually draws. `audit-levels.mjs` (report-only) and `lint-levels.mjs` (enforcing) both
// call `runAllChecks` and `summarizeStage`.
import {
  backdropCoverageTop,
  backdropLayerSpans,
  mainGroundPlatforms,
  stageVerticalTop
} from '../../src/stage/stageGeometry.ts'
import { resolveHazard } from '../../src/mechanics/hazards.ts'
import fs from 'node:fs'
import { auditPickupPlacements } from '../../src/content/pickupPlacementRule.ts'
import { PICKUPS_ATLAS, PICKUP_ART_GROUPS } from '../../src/ui/pickups/pickupArt.ts'
import { GAME_HEIGHT, GAME_WIDTH } from '../../src/config/renderPolicy.ts'
import { GAMEPLAY_VIEWPORT_TOP } from '../../src/config/gameplayLayout.ts'

// Measured on the real build and repeated verbatim in every rebuilt stage file's header comment
// (heatWorks.ts, basaltTitan.ts, omegaFortress.ts, glacierRonin.ts, mireWraith.ts, ferroBlade.ts,
// voltHopper.ts, tideReaver.ts; 2026-09-24): a held running jump rises about 124px and covers about
// 246px; a held dash jump covers about 336px. Reused here rather than re-derived from the motor's
// gravity/velocity constants, which would risk drifting from what those stages were actually built and
// measured against.
export const RUN_JUMP_RISE_PX = 124
export const RUN_JUMP_DISTANCE_PX = 246
export const DASH_JUMP_DISTANCE_PX = 336

const HAZARD_SURFACE_TOLERANCE_PX = 6
/** `GROUNDED_PLAYER_SPAWN_Y` (`src/content/campaign.ts`): every checkpoint drops the hero from here, so
 *  a checkpoint's own `y` (always this constant post-patch) carries no per-checkpoint height information. */
const CHECKPOINT_DROP_Y = 214

export const MECHANIC_ARRAY_KEYS = [
  'roomLocks',
  'verticalSegments',
  'risingLiquids',
  'crumbleGroups',
  'breakableWalls',
  'conveyors',
  'iceFloors',
  'currentZones',
  'waterLevelGates',
  'windZones',
  'timedRailGroups',
  'laneSwaps',
  'rockfalls',
  'icicles'
]

function isStandableType(type) {
  return type == null || type === 'solid' || type === 'oneWay'
}

/** A platform's walking surface, centre y minus half height; a one-way ledge without a height is already
 *  authored at its surface (plus a small fudge every stage file's `ledge()` helper bakes in). */
function surfaceTop(platform) {
  return typeof platform.height === 'number' ? platform.y - platform.height / 2 : platform.y
}

function surfaceLeft(platform) {
  return platform.x - platform.width / 2
}

function surfaceRight(platform) {
  return platform.x + platform.width / 2
}

/**
 * Ground spans (the main strip minus pits) plus every standable hand-placed platform, world px, over
 * `routeWidth` only: the boss room is its own sealed arena (checked separately by
 * `checkBossRoomInsideStage`), never part of the main ground's pits.
 */
export function collectStandableSurfaces(stageId, arena, routeWidth) {
  const ground = mainGroundPlatforms(stageId, routeWidth, GAME_HEIGHT, arena.floorGaps ?? [])
  const platforms = (arena.midPlatforms ?? []).filter((platform) => isStandableType(platform.type))
  // Conveyors (`ConveyorDefinition`, same centre x/y convention, default height 12) are grounded, ridable
  // belts, not decoration: a hazard or pickup can legitimately rest on one (Ferro's hall housings).
  const conveyors = (arena.conveyors ?? []).map((conveyor) => ({ ...conveyor, height: conveyor.height ?? 12 }))
  return [...ground, ...platforms, ...conveyors].map((platform) => ({
    left: surfaceLeft(platform),
    right: surfaceRight(platform),
    top: surfaceTop(platform),
    id: platform.id
  }))
}

function coveringSurfaces(surfaces, x) {
  return surfaces.filter((surface) => x >= surface.left && x <= surface.right)
}

/**
 * A gap a flat dash-jump cannot be expected to cross is still fine when a wall face lets the hero
 * wall-kick across or up it (06 §6.1's shaft boss rooms and the tutorial climb), or when it falls inside
 * a vertical segment or a room lock's own room: both are camera-bounded set pieces with their own
 * traversal rule (wall-jumping, a gate, a wind zone), not a flat walk the dash-jump budget governs.
 */
function gapHasAlternateCrossing(arena, gapLeft, gapRight) {
  const overlapsRange = (left, width) => left < gapRight && left + width > gapLeft
  const walls = (arena.midPlatforms ?? []).filter((platform) => platform.type === 'wall')
  if (walls.some((wall) => overlapsRange(surfaceLeft(wall), wall.width))) return true
  if ((arena.verticalSegments ?? []).some((segment) => overlapsRange(segment.x, segment.width))) return true
  if ((arena.roomLocks ?? []).some((lock) => overlapsRange(lock.room.x, lock.room.width))) return true
  return false
}

/**
 * Every stage is reachable: segments in order, no gap between two consecutive standable surfaces
 * (ground or a platform bridging a pit) wider than a dash-jump, unless a wall, vertical segment or room
 * lock offers another way across (`gapHasAlternateCrossing`). Horizontal only otherwise (prompt 02's
 * fuller rise/wall-jump reach model, `src/content/levels/reach.ts`, was never built against the rebuilt
 * stage registry; wind-assisted jumps beyond a wind zone's own x-range are still out of scope, open item).
 */
export function checkReachability(stageId, arena, routeWidth) {
  const surfaces = collectStandableSurfaces(stageId, arena, routeWidth)
  const sorted = [...surfaces].sort((a, b) => a.left - b.left)
  // A platform standing on top of (or nested inside) the main ground's own span must not read as a gap
  // against whichever surface happens to sort next by left edge: merge overlapping/nested surfaces into
  // contiguous coverage first, then only the gaps between that merged coverage are real.
  const merged = []
  for (const surface of sorted) {
    const last = merged[merged.length - 1]
    if (last && surface.left <= last.right) {
      last.right = Math.max(last.right, surface.right)
    } else {
      merged.push({ left: surface.left, right: surface.right })
    }
  }
  const offenders = []
  for (let i = 0; i < merged.length - 1; i += 1) {
    const gapLeft = merged[i].right
    const gapRight = merged[i + 1].left
    const gap = gapRight - gapLeft
    if (gap > DASH_JUMP_DISTANCE_PX && !gapHasAlternateCrossing(arena, gapLeft, gapRight)) {
      offenders.push({ atX: Math.round(gapLeft), widthPx: Math.round(gap) })
    }
  }
  return { ok: offenders.length === 0, offenders }
}

/**
 * Every checkpoint sits on floor: the drop from `GROUNDED_PLAYER_SPAWN_Y` (214, `CHECKPOINT_DROP_Y`
 * here) lands on ground or a platform, not open pit. Existence-only (not a tight y match): every
 * checkpoint's own `y` is the same constant regardless of what is actually beneath it, so only "is there
 * really a surface under this x" is meaningful.
 */
export function checkCheckpointsOnFloor(stageId, arena, routeWidth) {
  const surfaces = collectStandableSurfaces(stageId, arena, routeWidth)
  const offenders = (arena.checkpoints ?? [])
    .filter((checkpoint) => !coveringSurfaces(surfaces, checkpoint.x).some((surface) => surface.top >= CHECKPOINT_DROP_Y))
    .map((checkpoint) => ({ id: checkpoint.id, x: checkpoint.x }))
  return { ok: offenders.length === 0, offenders }
}

/**
 * Every pickup is grounded (its art's bottom within 2 px of the surface under it) or marked `rest: 'float'`,
 * and none sits inside a solid or over a pit. This reuses the 13e rule (`src/content/pickupPlacementRule.ts`,
 * the one `tests/pickup-placement.test.ts` proves) with the pickup atlas's real frame sizes.
 */
export function checkPickupsGroundedOrFloat(stageId) {
  const offenders = pickupPlacementRows()
    .filter((row) => row.stage === stageId && row.verdict !== 'grounded' && row.verdict !== 'floating_ok')
    .map((row) => ({ id: row.id, category: row.category, x: row.x, y: row.y, verdict: row.verdict, gap: row.gap }))
  return { ok: offenders.length === 0, offenders }
}

let placementRowsCache = null
function pickupPlacementRows() {
  if (placementRowsCache) return placementRowsCache
  const atlas = JSON.parse(fs.readFileSync(PICKUPS_ATLAS.data, 'utf8'))
  const atlasKey = PICKUPS_ATLAS.key.replace('atlas_', '')
  const sizes = {}
  for (const group of PICKUP_ART_GROUPS) {
    const frame = atlas.frames[`${atlasKey}/${group}/000`]
    if (frame) sizes[group] = { width: frame.frame.w, height: frame.frame.h }
  }
  placementRowsCache = auditPickupPlacements(sizes)
  return placementRowsCache
}

/** Every hazard anchor sits on solid: its resolved damage box's bottom edge lands on a ground or platform
 *  top. `direction: 'down'` (ceiling vents) are skipped: none exist in the campaign today (grep-verified,
 *  2026-09-30), and checking a ceiling mount needs a "ceiling surfaces" list this module does not build.
 *  A hazard at or past `routeWidth` (Heat Works' `pyro_boss_vent_*`) is inside the boss room, added by
 *  `applyBossRoomFeatures` after the route is compiled: that room's own floor (flat, or one of the
 *  `flat | pillars | pits | rails | shaft` variants) is a different geometry this module does not model,
 *  so it is out of scope here too, open item. */
export function checkHazardsOnSolid(stageId, arena, routeWidth) {
  const surfaces = collectStandableSurfaces(stageId, arena, routeWidth)
  const offenders = (arena.hazards ?? [])
    .filter((definition) => definition.x < routeWidth)
    .map((definition) => resolveHazard(definition))
    .filter((hazard) => hazard.direction !== 'down')
    .filter((hazard) => {
      const covering = coveringSurfaces(surfaces, hazard.x)
      const bottom = hazard.y + hazard.height / 2
      return !covering.some((surface) => Math.abs(surface.top - bottom) <= HAZARD_SURFACE_TOLERANCE_PX)
    })
    .map((hazard) => ({ id: hazard.id, x: hazard.x, bottom: Math.round(hazard.y + hazard.height / 2) }))
  return { ok: offenders.length === 0, offenders }
}

/** The backdrop covers every vertical segment: `backdropLayerSpans` (reused from `StageBackdrop`'s own
 *  render call, not reimplemented) must reach the stage's highest point for every parallax layer. */
export function checkBackdropCoversVertical(arena) {
  const top = stageVerticalTop(arena, GAME_HEIGHT)
  if (top >= 0) return { ok: true, offenders: [] }
  const layers = arena.background?.layers ?? []
  if (layers.length === 0) {
    return { ok: false, offenders: [{ reason: 'no background layers for a stage with a vertical segment or room lock' }] }
  }
  const offenders = layers
    .filter((layer) => backdropCoverageTop(backdropLayerSpans(layer.y, top, GAME_HEIGHT, GAMEPLAY_VIEWPORT_TOP)) > top)
    .map((layer) => ({ key: layer.key, reason: 'layer spans stop short of the stage top' }))
  return { ok: offenders.length === 0, offenders }
}

/** Every boss room lies inside the stage. */
export function checkBossRoomInsideStage(arena, worldWidth) {
  const room = arena.bossRoom
  const ok = room != null && room.x >= 0 && room.x + room.width <= worldWidth
  return { ok, offenders: ok ? [] : [{ x: room?.x ?? null, width: room?.width ?? null, worldWidth }] }
}

/** Table row (screens, secrets, checkpoints, mechanics, enemies) for `content:audit`'s report. */
export function summarizeStage(stage, report) {
  const arena = stage.arena
  const mechanicsTypes = MECHANIC_ARRAY_KEYS.filter((key) => (arena[key]?.length ?? 0) > 0)
  return {
    stageId: stage.id,
    screens: Math.round(report.routeWidth / GAME_WIDTH),
    secrets: arena.breakableWalls?.length ?? 0,
    checkpoints: arena.checkpoints?.length ?? 0,
    mechanicsCount: mechanicsTypes.length,
    mechanicsTypes,
    enemies: stage.enemyMarkers?.length ?? 0
  }
}

/** Every rule, run together: the shape both `audit-levels.mjs` and `lint-levels.mjs` iterate. */
export function runAllChecks(stage, report) {
  const arena = stage.arena
  const routeWidth = report.routeWidth
  const worldWidth = report.worldWidth
  return {
    reachability: checkReachability(stage.id, arena, routeWidth),
    checkpointsOnFloor: checkCheckpointsOnFloor(stage.id, arena, routeWidth),
    pickupsGroundedOrFloat: checkPickupsGroundedOrFloat(stage.id),
    hazardsOnSolid: checkHazardsOnSolid(stage.id, arena, routeWidth),
    backdropCoversVertical: checkBackdropCoversVertical(arena),
    bossRoomInsideStage: checkBossRoomInsideStage(arena, worldWidth)
  }
}
