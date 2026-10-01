/**
 * The two touch button sets and which one shows (post-v1.0 touch mode task card, replacing part
 * 12i's `src/ui/touchControlsModel.ts`). Pure: `TouchOverlay` draws these specs over the canvas as
 * DOM buttons, and `tests/touch-overlay.test.ts` checks them without a scene or a DOM.
 */
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import type { ActionName } from '../ActionState'
import type { TouchControlsMode } from '../../systems/Settings'

export type TouchSet = 'play' | 'menu'
export type TouchButtonSpec = Readonly<{
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

/** The HUD band (`getHudLayout(...).height`) ends at y 58; the toggle and the system row sit under it. */
export const TOUCH_SYSTEM_ROW_Y = 74
/** Scenes with no input of their own (loading screens); the overlay hides outright. */
const SCENES_WITHOUT_INPUT = new Set(['Boot', 'Preload'])

function dpad(action: ActionName, pad: { x: number; y: number }, dx: number, dy: number, w: number, h: number, label: string, alpha = 0.18): TouchButtonSpec {
  return { action, label, x: pad.x + dx, y: pad.y + dy, width: w, height: h, round: false, alpha, fontScale: 2 }
}
function round(action: ActionName, face: { x: number; y: number }, dx: number, dy: number, size: number, label: string, alpha = 0.18): TouchButtonSpec {
  return { action, label, x: face.x + dx, y: face.y + dy, width: size, height: size, round: true, alpha, fontScale: 2 }
}
function system(action: ActionName, x: number, w: number, label: string, fontScale: 1 | 2, alpha = 0.34): TouchButtonSpec {
  return { action, label, x, y: TOUCH_SYSTEM_ROW_Y, width: w, height: 24, round: false, alpha, fontScale }
}

/** The shared d-pad: movement in `Game`, menu navigation everywhere else (both read `moveLeft` etc). */
function dpadButtons(width: number, height: number): TouchButtonSpec[] {
  const pad = { x: 24, y: height - 66 }
  return [
    dpad('moveLeft', pad, 26, -4, 56, 44, 'L'),
    dpad('moveRight', pad, 94, -4, 56, 44, 'R'),
    dpad('aimUp', pad, 60, -46, 52, 40, 'U', 0.24),
    dpad('aimDown', pad, 60, 38, 52, 40, 'D', 0.24)
  ]
}

/** `Game` in direct control: d-pad, jump, shoot (hold to charge), dash, saber, weapon previous/next, pause. */
function playButtons(width: number, height: number): TouchButtonSpec[] {
  const face = { x: width - 92, y: height - 70 }
  return [
    ...dpadButtons(width, height),
    round('jump', face, -168, -18, 64, 'JUMP'),
    round('dash', face, -102, 22, 60, 'DASH'),
    round('shoot', face, -34, -18, 70, 'SHOT'),
    round('saber', face, 42, 22, 62, 'SABER'),
    system('weaponPrev', width - 115, 42, '< WPN', 1),
    system('weaponNext', width - 69, 42, 'WPN >', 1),
    system('pause', width - 26, 36, '||', 2)
  ]
}

/** Every other scene, and `Game` while a dialogue, the pause menu, a card or results is open: d-pad, OK, BACK. */
function menuButtons(width: number, height: number): TouchButtonSpec[] {
  const face = { x: width - 92, y: height - 70 }
  return [
    ...dpadButtons(width, height),
    round('confirm', face, -34, -18, 70, 'OK', 0.26),
    round('cancel', face, -168, -18, 64, 'BACK', 0.26)
  ]
}

export function touchButtonsFor(set: TouchSet, width = GAME_WIDTH, height = GAME_HEIGHT): TouchButtonSpec[] {
  return set === 'play' ? playButtons(width, height) : menuButtons(width, height)
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
