/**
 * Presentation rules for the prompt 12 part 12b mechanics art (`mechanics_v2`, Higgsfield gpt_image_2,
 * cut and attributed in cbdac1e; loaded with the Game scene's resident atlases as `MECHANICS_V2_ATLAS`).
 * Pure: which frame each mechanic shows for its state, and each frame's anchor row (the cut frames are
 * not aligned: rails, magnet plates and lift columns sit at different rows per frame). The adapters
 * (`adapters/MotionMechanicsAdapter.ts`, `adapters/HazardMechanicsAdapter.ts`) draw them.
 */
import type { FrameIndex } from './mechanicsVisuals'
import type { IciclePhase } from './icicle'
import type { RockfallPhase } from './rockfall'
import type { RailPhase } from './timedRailGroup'
import type { WindPhase } from './windZone'

export type MechanicsV2Group = 'conveyor' | 'ice_tile' | 'icicle' | 'rockfall' | 'power_rail' | 'wind_gust' | 'wind_lift' | 'current' | 'magnet_lift'

export const MECHANICS_V2_FRAME_SIZE: Record<MechanicsV2Group, { width: number; height: number; frames: number }> = {
  conveyor: { width: 56, height: 18, frames: 4 },
  ice_tile: { width: 16, height: 16, frames: 2 },
  icicle: { width: 28, height: 36, frames: 2 },
  rockfall: { width: 38, height: 26, frames: 4 },
  power_rail: { width: 56, height: 28, frames: 4 },
  wind_gust: { width: 50, height: 30, frames: 4 },
  wind_lift: { width: 34, height: 46, frames: 4 },
  current: { width: 48, height: 26, frames: 4 },
  magnet_lift: { width: 36, height: 38, frames: 4 }
}

export function mechanicsV2Frame(group: MechanicsV2Group, index: FrameIndex): string {
  return `mechanics_v2/${group}/${String(index).padStart(3, '0')}`
}

function loop(clockMs: number, frameMs: number, count: number): number {
  return Math.floor(Math.max(0, clockMs) / frameMs) % count
}

function wrap(value: number, period: number): number {
  return period > 0 ? ((value % period) + period) % period : 0
}

// ------------------------------------------------------------------------------------------ conveyor

/** Row 1 is the belt's top in every frame: it sits on the belt body's top edge. */
export const CONVEYOR_BELT_TOP_ROW = 1

/** The chevrons step faster on a faster belt: 4800/|speed| ms per frame, 40 to 240 (60 px/s: 80 ms). */
export function conveyorFrameMs(speed: number): number {
  return Math.min(240, Math.max(40, Math.round(4800 / Math.max(1, Math.abs(speed)))))
}

/** A stopped belt holds frame 000; a moving one steps its chevrons (flipped for a leftward belt). */
export function conveyorFrameIndex(speed: number, clockMs: number): FrameIndex {
  return speed === 0 ? 0 : (loop(clockMs, conveyorFrameMs(speed), 4) as FrameIndex)
}

/** Whole 56px segments stretched to the belt's length. */
export function conveyorTileLayout(width: number): { tiles: number; scaleX: number } {
  const tileWidth = MECHANICS_V2_FRAME_SIZE.conveyor.width
  const tiles = Math.max(1, Math.round(width / tileWidth))
  return { tiles, scaleX: width / (tiles * tileWidth) }
}

// ----------------------------------------------------------------------------------------------- ice

/** The two ice tiles alternate slowly: a shimmer on the surface. */
export const ICE_SHIMMER_MS = 900

export function iceTileFrameIndex(clockMs: number): FrameIndex {
  return loop(clockMs, ICE_SHIMMER_MS, 2) as FrameIndex
}

// -------------------------------------------------------------------------------- current and wind

export const FLOW_FRAME_MS = 120
/** How fast the tiled art drifts with the flow, px/s (the direction tell). */
export const FLOW_SCROLL_PX_PER_S = { current: 36, gust: 150, lift: 90 } as const

export function flowFrameIndex(clockMs: number): FrameIndex {
  return loop(clockMs, FLOW_FRAME_MS, 4) as FrameIndex
}

/**
 * tilePositionX for a flow drawn flipped when it runs left: the offset always decreases, which moves the
 * texture right in the sprite's own space, and so along the flow on screen once the flip mirrors it.
 */
export function flowTileOffsetX(clockMs: number, pxPerS: number, tileWidth: number): number {
  const offset = wrap((Math.max(0, clockMs) / 1000) * pxPerS, tileWidth)
  return offset === 0 ? 0 : -offset
}

/** tilePositionY for a lift: the offset grows, so the texture climbs. */
export function liftTileOffsetY(clockMs: number, pxPerS: number, tileHeight: number): number {
  return wrap((Math.max(0, clockMs) / 1000) * pxPerS, tileHeight)
}

/** A gust's art is hidden while calm, faint while building (the tell) and full while blowing. */
export function windArtAlpha(phase: WindPhase): number {
  return phase === 'blowing' ? 0.9 : phase === 'building' ? 0.45 : 0
}

/** The lift column tiles the three full-height frames (000 is the short start of the jet). */
export const WIND_LIFT_FRAMES: readonly FrameIndex[] = [1, 2, 3]

export function windLiftFrameIndex(clockMs: number): FrameIndex {
  return WIND_LIFT_FRAMES[loop(clockMs, FLOW_FRAME_MS, WIND_LIFT_FRAMES.length)]
}

/** Magnet plate's top row per frame (000 and 003 at 15, 001 at 24, 002 at 29); the plate is 8 rows tall. */
export const MAGNET_PLATE_TOP_ROW: Record<FrameIndex, number> = { 0: 15, 1: 24, 2: 29, 3: 15 }
export const MAGNET_PLATE_HEIGHT = 8
export const MAGNET_FRAME_MS = 140
/** The magnet lift's field reuses the lift column, tinted. */
export const MAGNET_FIELD_TINT = 0xa99bff

/** A pulling magnet cycles its glow; an idle one holds 000. */
export function magnetFrameIndex(active: boolean, clockMs: number): FrameIndex {
  return active ? (loop(clockMs, MAGNET_FRAME_MS, 4) as FrameIndex) : 0
}

// --------------------------------------------------------------------------------------------- rails

/** The posts' last row per frame: it sits on the rail line. */
export const RAIL_FOOT_ROW: Record<FrameIndex, number> = { 0: 20, 1: 23, 2: 26, 3: 24 }
export const RAIL_SPARK_MS = 60
export const RAIL_ARC_FLICKER_MS = 50

/** Off 000; arming blinks the insulator sparks 001/003; arcing 002, mirrored every other flicker step. */
export function railFrame(phase: RailPhase, clockMs: number): { index: FrameIndex; flipX: boolean } {
  if (phase === 'arcing') return { index: 2, flipX: loop(clockMs, RAIL_ARC_FLICKER_MS, 2) === 1 }
  if (phase === 'arming') return { index: loop(clockMs, RAIL_SPARK_MS, 2) === 0 ? 1 : 3, flipX: false }
  return { index: 0, flipX: false }
}

// ------------------------------------------------------------------------------------------ rockfall

export const ROCKFALL_TUMBLE_MS = 90
/** The rubble pile's last row sits on the floor; the boulder is drawn centred on its box (row 12.5). */
export const ROCKFALL_RUBBLE_FOOT_ROW = 23
export const ROCKFALL_BOULDER_CENTRE_ROW = 12.5

/** Waiting: nothing; warning: the dust puff 000 under the ceiling; falling: the boulder 001/002 tumbling; rubble 003. */
export function rockfallFrameIndex(phase: RockfallPhase, clockMs: number): FrameIndex | null {
  if (phase === 'warning') return 0
  if (phase === 'falling') return loop(clockMs, ROCKFALL_TUMBLE_MS, 2) === 0 ? 1 : 2
  if (phase === 'rubble') return 3
  return null
}

// -------------------------------------------------------------------------------------------- icicle

/** Row 9 of the icicle frames is the ceiling line: the rock mount is above it, the spike or shards below. */
export const ICICLE_SPIKE_TOP_ROW = 9
/** The shards show this long after the shatter; then only the empty mount is left. */
export const ICICLE_SHARDS_MS = 450

/** The spike 000 while hanging, shaking and falling; the shards 001 once shattered. */
export function icicleFrameIndex(phase: IciclePhase): FrameIndex {
  return phase === 'shattered' ? 1 : 0
}
