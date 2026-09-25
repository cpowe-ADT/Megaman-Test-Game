/**
 * Presentation rules for the stage mechanics art (`mechanics_v1`, Higgsfield gpt_image_2, cut by
 * scripts/sprites/cut_vfx_sheet.py; provenance in assets/sprites/source/free-source-attribution.v1.json).
 * Pure: which frame each mechanic shows for its state, and where the gate sign sits. The adapters
 * (`adapters/StageMechanicsAdapter.ts`, `adapters/RoomLockAdapter.ts`) draw them; the Game scene loads
 * the atlas with its resident atlases (`src/scenes/game/stageBackgroundLoading.ts`, manifest loadScope 'game').
 */
import type { InputBindings } from '../input/ActionState'
import { breakableWallCrackStage, type BreakableWallState } from './breakableWall'
import type { CrumbleState } from './crumbleGroup'
import type { VentPhase } from './hazards'
import { formatKeyCode, type RoomLockInput, type RoomLockPhase, type RoomRect } from './roomLock'

export const MECHANICS_ATLAS = {
  key: 'atlas_mechanics_v1',
  image: 'assets/sprites/mechanics/mechanics_v1/mechanics_v1.png',
  data: 'assets/sprites/mechanics/mechanics_v1/mechanics_v1.atlas.json'
} as const

export type MechanicsGroup = 'vent_nozzle' | 'vent_flame' | 'breakable_wall' | 'crumble' | 'slag_surface' | 'slag_fill' | 'energy_gate' | 'scrap_gate'
export type FrameIndex = 0 | 1 | 2 | 3

/** Frame size per group (every group has four frames, 000-003). */
export const MECHANICS_FRAME_SIZE: Record<MechanicsGroup, { width: number; height: number }> = {
  vent_nozzle: { width: 20, height: 16 },
  vent_flame: { width: 28, height: 52 },
  breakable_wall: { width: 42, height: 52 },
  crumble: { width: 58, height: 34 },
  slag_surface: { width: 30, height: 16 },
  slag_fill: { width: 30, height: 29 },
  energy_gate: { width: 32, height: 64 },
  scrap_gate: { width: 58, height: 60 }
}

export function mechanicsFrame(group: MechanicsGroup, index: FrameIndex): string {
  return `mechanics_v1/${group}/${String(index).padStart(3, '0')}`
}

/** Frame `index` of a looping strip at `frameMs` per frame. */
function loop(clockMs: number, frameMs: number, count: number): number {
  return Math.floor(Math.max(0, clockMs) / frameMs) % count
}

// ---------------------------------------------------------------------------------------------- vents

/** Arming blinks dull/bright at this period (the old 60ms tint blink). */
export const VENT_ARM_BLINK_MS = 60
export const VENT_FLAME_FRAME_MS = 70
/** Nozzle body rows 5-9 of 16: the frame's row 10 sits on the vent box's floor edge (row 6 when flipped for a ceiling vent). */
export const VENT_NOZZLE_ORIGIN_Y = { up: 10 / 16, down: 6 / 16 } as const

/** Cold 000; arming alternates dull 001 and bright 002; firing 003. */
export function ventNozzleFrameIndex(phase: VentPhase, clockMs: number): FrameIndex {
  if (phase === 'firing') return 3
  if (phase === 'arming') return loop(clockMs, VENT_ARM_BLINK_MS, 2) === 0 ? 2 : 1
  return 0
}

/** The jet shows only while firing (the body is live), flickering through its four frames. */
export function ventFlameFrameIndex(phase: VentPhase, clockMs: number): FrameIndex | null {
  return phase === 'firing' ? (loop(clockMs, VENT_FLAME_FRAME_MS, 4) as FrameIndex) : null
}

// ----------------------------------------------------------------------------------------------- slag

export const SLAG_FRAME_MS = 280
/**
 * Surface frames 001-003 share the liquid's top edge (rows 7-8) and run to the frame bottom; 000 sits
 * 4px higher and ends at row 11, so it would jump and leave a seam over the fill. It is not used.
 */
export const SLAG_SURFACE_FRAMES: readonly FrameIndex[] = [1, 2, 3]
/** Row of the surface frame that is the liquid's top edge: it sits on the kill line. */
export const SLAG_SURFACE_TOP_ROW = 8
/** The fill starts this far below the kill line, under the surface strip, so no seam shows. */
export const SLAG_FILL_OFFSET_PX = 4

export function slagFrameIndices(clockMs: number): { surface: FrameIndex; fill: FrameIndex } {
  const step = loop(clockMs, SLAG_FRAME_MS, 12)
  return { surface: SLAG_SURFACE_FRAMES[step % SLAG_SURFACE_FRAMES.length], fill: (step % 4) as FrameIndex }
}

// ---------------------------------------------------------------------------------- breakable walls

/** Intact 000, cracked 001, heavily cracked 002 (by hits over hitsRequired), collapsing 003 once broken. */
export function breakableWallFrameIndex(state: BreakableWallState): FrameIndex {
  return breakableWallCrackStage(state) as FrameIndex
}

/**
 * Wall art is drawn at least this wide (centred on the body): a 16px wall squeezed from the 42px
 * frame would lose its plates. Tiles are stacked to the wall's height (see `wallTileLayout`).
 */
export const WALL_MIN_DRAW_WIDTH = 28

/** The wall frame scaled to the draw width, stretched so a whole number of tiles fills the height. */
export function wallTileLayout(width: number, height: number): { drawWidth: number; tileScaleX: number; tileScaleY: number; tiles: number } {
  const size = MECHANICS_FRAME_SIZE.breakable_wall
  const drawWidth = Math.max(width, WALL_MIN_DRAW_WIDTH)
  const tileScaleX = drawWidth / size.width
  const tiles = Math.max(1, Math.round(height / (size.height * tileScaleX)))
  return { drawWidth, tileScaleX, tileScaleY: height / (size.height * tiles), tiles }
}

// ------------------------------------------------------------------------------------------ crumbles

/** Top row of the slab in each crumble frame (the slab sits lower in the cracked frames). */
export const CRUMBLE_SLAB_TOP_ROW: Record<FrameIndex, number> = { 0: 8, 1: 15, 2: 12, 3: 9 }
/** Slab columns 2-54 of the 58px frame. */
export const CRUMBLE_SLAB = { left: 2, width: 53 } as const
/** Share of the shake shown cracked before it shows breaking. */
export const CRUMBLE_CRACKED_SHARE = 0.6

/** Intact while solid, cracked then breaking through the shake, falling once it drops. */
export function crumbleFrameIndex(state: Pick<CrumbleState, 'phase' | 'timerMs'>, shakeMs: number): FrameIndex {
  if (state.phase === 'fallen') return 3
  if (state.phase === 'shaking') return state.timerMs < shakeMs * CRUMBLE_CRACKED_SHARE ? 1 : 2
  return 0
}

// --------------------------------------------------------------------------------------------- gates

export const ENERGY_GATE_FRAME_MS = 110
/** The scrap gate tiles at 2/3 size (39x40) so its pillars stay near the 12px gate body. */
export const SCRAP_GATE_TILE_SCALE = 2 / 3

export function energyGateFrameIndex(clockMs: number): FrameIndex {
  return loop(clockMs, ENERGY_GATE_FRAME_MS, 4) as FrameIndex
}

/** Intact 000, cut once 001, cut twice 002 (by progress over hitsRequired), falling apart 003 once open. */
export function scrapGateFrameIndex(state: { phase: RoomLockPhase; progress: number; hitsRequired: number }): FrameIndex {
  if (state.phase === 'open') return 3
  return Math.min(2, Math.ceil((state.progress / Math.max(1, state.hitsRequired)) * 2)) as FrameIndex
}

/** tilePositionY that ends a column of `tileHeight` tiles exactly on its bottom edge. */
export function bottomAlignedTileOffset(height: number, tileHeight: number): number {
  return (((tileHeight - (height % tileHeight)) % tileHeight) + tileHeight) % tileHeight
}

// ---------------------------------------------------------------------------------------- gate signs

/** The sign shows while the hero is within this many px (horizontally) of a closed gate. */
export const GATE_SIGN_RANGE_PX = 160
/** Sign centre above the room's floor edge: over the hero's head. */
export const GATE_SIGN_RISE_PX = 80
export const GATE_SIGN_MARGIN_PX = 4

/** `C  SLASH`, `HOLD X  CHARGE`, `Z  DASH`, `SPACE  JUMP`, `WALL  KICK`, from the live bindings. */
export function gateSignText(input: RoomLockInput, bindings: InputBindings): string {
  const key = (action: keyof InputBindings) => formatKeyCode(bindings[action]?.[0] ?? '?')
  switch (input) {
    case 'saber':
      return `${key('saber')}  SLASH`
    case 'charge':
      return `HOLD ${key('shoot')}  CHARGE`
    case 'dash':
      return `${key('dash')}  DASH`
    case 'jump':
      return `${key('jump')}  JUMP`
    case 'wall_jump':
      return 'WALL  KICK'
  }
}

/** A verb gate (not a defeat gate) still closed, with the hero near it. */
export function isGateSignShown(lock: { phase: RoomLockPhase; requiredInput: RoomLockInput | null }, heroX: number, gateX: number): boolean {
  return lock.phase !== 'open' && lock.requiredInput !== null && Math.abs(heroX - gateX) <= GATE_SIGN_RANGE_PX
}

/**
 * Sign centre, world px: over the gate, above the hero's head, clamped inside the camera's view and
 * below the HUD band (`hudBandPx` from the view's top), so a gate on the room's edge keeps its sign on screen.
 */
export function gateSignPosition(input: {
  gateX: number
  floorY: number
  signWidth: number
  signHeight: number
  view: RoomRect
  hudBandPx: number
}): { x: number; y: number } {
  const { gateX, floorY, signWidth, signHeight, view, hudBandPx } = input
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))
  const x = clamp(gateX, view.x + signWidth / 2 + GATE_SIGN_MARGIN_PX, view.x + view.width - signWidth / 2 - GATE_SIGN_MARGIN_PX)
  const y = clamp(
    floorY - GATE_SIGN_RISE_PX,
    view.y + hudBandPx + signHeight / 2 + GATE_SIGN_MARGIN_PX,
    view.y + view.height - signHeight / 2 - GATE_SIGN_MARGIN_PX
  )
  return { x: Math.round(x), y: Math.round(y) }
}
