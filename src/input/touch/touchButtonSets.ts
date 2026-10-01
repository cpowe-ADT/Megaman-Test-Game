/**
 * The two touch button sets and which one shows (v2, Craig's playtest note). An emulator-style pad:
 * a d-pad cross (arrow glyphs) at the left, a diamond of round face buttons at the right (bottom is
 * the largest, the "A" position), shoulder pills (L/R) under the HUD band, and SELECT/START pills at
 * bottom-centre. Pure: `TouchOverlay` draws these specs over the canvas as DOM buttons, and
 * `tests/touch-overlay.test.ts` checks them (no overlaps, minimum sizes) at three phone viewports.
 */
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import type { ActionName } from '../ActionState'
import type { TouchControlsMode } from '../../systems/Settings'

export type TouchSet = 'play' | 'menu'
export type TouchButtonSpec = Readonly<{
  /** Unique within a set even when two buttons dispatch the same action (SELECT and BACK both cancel). */
  id: string
  action: ActionName
  label: string
  /** Centre, in game pixels. */
  x: number
  y: number
  width: number
  height: number
  round: boolean
  alpha: number
  /** Pixel-font scale: 1 is 8px, 2 is 16px. */
  fontScale: 1 | 2
}>

/** Scenes with no input of their own (loading screens); the overlay hides outright. */
const SCENES_WITHOUT_INPUT = new Set(['Boot', 'Preload'])

function btn(id: string, action: ActionName, label: string, x: number, y: number, width: number, height: number, round: boolean, alpha: number, fontScale: 1 | 2 = 2): TouchButtonSpec {
  return { id, action, label, x, y, width, height, round, alpha, fontScale }
}

/** The cross: arrow glyphs, not letters (Craig's v2 note). Shared by both sets (menu navigation and
 * movement/aim read the same `moveLeft` etc). Arms sit 44 game px from centre so the diagonal gap
 * between adjacent arms clears 8 CSS px even at the smallest of the three reference phone viewports. */
function dpadButtons(height: number): TouchButtonSpec[] {
  const cx = 80
  const cy = height - 74
  const arm = 34
  const offset = 44
  return [
    btn('aimUp', 'aimUp', '▲', cx, cy - offset, arm, arm, false, 0.2),
    btn('aimDown', 'aimDown', '▼', cx, cy + offset, arm, arm, false, 0.2),
    btn('moveLeft', 'moveLeft', '◀', cx - offset, cy, arm, arm, false, 0.2),
    btn('moveRight', 'moveRight', '▶', cx + offset, cy, arm, arm, false, 0.2)
  ]
}

/** The diamond's four slots, sized/positioned once; `play` fills all four, `menu` only bottom and
 * right (the "A"/"B" positions Craig named: bottom is OK in menu, JUMP -- the largest -- in play). */
function diamond(height: number) {
  const cx = GAME_WIDTH - 80
  const cy = height - 82
  const radius = 54
  return {
    top: { x: cx, y: cy - radius, size: 36 },
    bottom: { x: cx, y: cy + radius, size: 46 },
    left: { x: cx - radius, y: cy, size: 38 },
    right: { x: cx + radius, y: cy, size: 38 }
  }
}

function shoulderButtons(): TouchButtonSpec[] {
  return [
    btn('shoulderL', 'weaponPrev', 'L', 50, 84, 56, 34, false, 0.3, 1),
    btn('shoulderR', 'weaponNext', 'R', 420, 84, 48, 34, false, 0.3, 1)
  ]
}

/** START = pause in play, confirm in menu; SELECT = cancel (back) in both (Craig's v2 note). */
function systemPills(startAction: ActionName): TouchButtonSpec[] {
  return [
    btn('select', 'cancel', 'SELECT', 175, 226, 70, 34, false, 0.3, 1),
    btn('start', startAction, 'START', 273, 226, 70, 34, false, 0.3, 1)
  ]
}

/** `Game` in direct control: cross, JUMP/SHOT/DASH/SABER, L/R weapon cycle, SELECT (back) and START (pause). */
function playButtons(height: number): TouchButtonSpec[] {
  const d = diamond(height)
  return [
    ...dpadButtons(height),
    btn('faceBottom', 'jump', 'JUMP', d.bottom.x, d.bottom.y, d.bottom.size, d.bottom.size, true, 0.2),
    btn('faceRight', 'shoot', 'SHOT', d.right.x, d.right.y, d.right.size, d.right.size, true, 0.2),
    btn('faceLeft', 'dash', 'DASH', d.left.x, d.left.y, d.left.size, d.left.size, true, 0.2),
    btn('faceTop', 'saber', 'SABER', d.top.x, d.top.y, d.top.size, d.top.size, true, 0.2),
    ...shoulderButtons(),
    ...systemPills('pause')
  ]
}

/** Every other scene, and `Game` while a dialogue, the pause menu, a card or results is open: cross,
 * A (OK, bottom/largest slot), B (BACK, right slot), SELECT (back) and START (confirm). */
function menuButtons(height: number): TouchButtonSpec[] {
  const d = diamond(height)
  return [
    ...dpadButtons(height),
    btn('faceBottom', 'confirm', 'OK', d.bottom.x, d.bottom.y, d.bottom.size, d.bottom.size, true, 0.26),
    btn('faceRight', 'cancel', 'BACK', d.right.x, d.right.y, d.right.size, d.right.size, true, 0.26),
    ...systemPills('confirm')
  ]
}

export function touchButtonsFor(set: TouchSet, width = GAME_WIDTH, height = GAME_HEIGHT): TouchButtonSpec[] {
  void width
  return set === 'play' ? playButtons(height) : menuButtons(height)
}

/** Which set shows, from the topmost active scene and (for `Game`) whether play is in direct control
 * (`Game.isPlayInputActive`); `null` hides the overlay outright (`Boot`, `Preload`). */
export function touchSetForScene(input: Readonly<{ sceneKey: string; playInputActive: boolean }>): TouchSet | null {
  if (SCENES_WITHOUT_INPUT.has(input.sceneKey)) return null
  if (input.sceneKey === 'Game') return input.playInputActive ? 'play' : 'menu'
  return 'menu'
}

/** `off` always hides and `on` always shows; `auto` shows on a touch screen or when automation forces it. */
export function touchControlsVisible(input: Readonly<{ mode: TouchControlsMode; touchScreen: boolean; forced: boolean }>): boolean {
  if (input.mode === 'off') return false
  return input.mode === 'on' || input.forced || input.touchScreen
}

/** A button's CSS box over the canvas, from its game-pixel centre and the canvas's CSS-px-per-game-px scale. */
export function cssBoxForSpec(spec: TouchButtonSpec, scale: number): { left: number; top: number; width: number; height: number } {
  return {
    left: (spec.x - spec.width / 2) * scale,
    top: (spec.y - spec.height / 2) * scale,
    width: spec.width * scale,
    height: spec.height * scale
  }
}
