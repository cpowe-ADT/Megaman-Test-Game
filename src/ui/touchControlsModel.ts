/**
 * The touch layer's buttons and when it shows (prompt 04 §4.3 touch, part 12i). Pure: `GameplayTouchControls`
 * draws these specs and `tests/touch-controls.test.ts` checks them without a scene.
 */
import { GAME_HEIGHT, GAME_WIDTH } from '../config/renderPolicy'
import type { DigitalButtonName } from '../input/DigitalButtonPad'
import type { TouchControlsMode } from '../systems/Settings'

/** Buttons that pulse one action instead of holding a pad button. */
export type TouchSystemAction = 'pause' | 'weaponPrev' | 'weaponNext'
export type TouchButtonId = DigitalButtonName | TouchSystemAction
export type TouchButtonSpec = Readonly<{
  id: TouchButtonId
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

/** The HUD band (`getHudLayout(...).height`) ends at y 58; the system row (weapon previous, next, pause) sits under it. */
export const TOUCH_SYSTEM_ROW_Y = 74

export function isTouchSystemAction(id: TouchButtonId): id is TouchSystemAction {
  return id === 'pause' || id === 'weaponPrev' || id === 'weaponNext'
}

export function touchControlsLayout(width = GAME_WIDTH, height = GAME_HEIGHT): TouchButtonSpec[] {
  const pad = { x: 24, y: height - 66 }
  const face = { x: width - 92, y: height - 70 }
  const dpad = (id: DigitalButtonName, dx: number, dy: number, w: number, h: number, label: string, alpha = 0.18): TouchButtonSpec =>
    ({ id, label, x: pad.x + dx, y: pad.y + dy, width: w, height: h, round: false, alpha, fontScale: 2 })
  const round = (id: DigitalButtonName, dx: number, dy: number, size: number, label: string): TouchButtonSpec =>
    ({ id, label, x: face.x + dx, y: face.y + dy, width: size, height: size, round: true, alpha: 0.18, fontScale: 2 })
  const system = (id: TouchSystemAction, x: number, w: number, label: string, fontScale: 1 | 2): TouchButtonSpec =>
    ({ id, label, x, y: TOUCH_SYSTEM_ROW_Y, width: w, height: 24, round: false, alpha: 0.34, fontScale })
  // The pad sat 40px further right until part 12i, where JUMP's circle covered the right 25px of RIGHT.
  return [
    dpad('left', 26, -4, 56, 44, 'L'),
    dpad('right', 94, -4, 56, 44, 'R'),
    dpad('up', 60, -46, 52, 40, 'U', 0.24),
    dpad('down', 60, 38, 52, 40, 'D', 0.24),
    round('jump', -168, -18, 64, 'JUMP'),
    round('dash', -102, 22, 60, 'DASH'),
    round('shoot', -34, -18, 70, 'SHOT'),
    round('saber', 42, 22, 62, 'SABER'),
    system('weaponPrev', width - 115, 42, '< WPN', 1),
    system('weaponNext', width - 69, 42, 'WPN >', 1),
    system('pause', width - 26, 36, '||', 2)
  ]
}

/** `off` always hides and `on` always shows; `auto` shows on a touch screen or when automation forces it (`?touchControls=1`). */
export function touchControlsVisible(input: Readonly<{ mode: TouchControlsMode; touchScreen: boolean; forced: boolean }>): boolean {
  if (input.mode === 'off') return false
  return input.mode === 'on' || input.forced || input.touchScreen
}
