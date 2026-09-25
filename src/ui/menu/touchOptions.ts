/** The Options row `TOUCH CONTROLS: AUTO / ON / OFF` (part 12i, D-020). Pure; `OptionsScene` stores the change. */
import { TOUCH_CONTROLS_MODES, type TouchControlsMode } from '../../systems/Settings'

export type TouchOptionsRow = { id: 'touchControls'; label: string; value: string; kind: 'cycle' }

export const TOUCH_CONTROLS_HINT = 'AUTO SHOWS THEM ON TOUCH SCREENS   LEFT / RIGHT CHANGE'

export function touchOptionsRow(mode: TouchControlsMode): TouchOptionsRow {
  return { id: 'touchControls', label: 'Touch Controls', value: mode.toUpperCase(), kind: 'cycle' }
}

/** Right steps AUTO, ON, OFF and wraps; left steps back. */
export function cycleTouchControls(mode: TouchControlsMode, delta: number): TouchControlsMode {
  const count = TOUCH_CONTROLS_MODES.length
  const at = Math.max(0, TOUCH_CONTROLS_MODES.indexOf(mode))
  return TOUCH_CONTROLS_MODES[(at + (delta < 0 ? -1 : 1) + count) % count]!
}

/** The touch row joins the device rows just before Controls, so Controls, Delete and Back stay last. */
export function withTouchRow<T extends { id: string }>(rows: readonly T[], row: TouchOptionsRow): Array<T | TouchOptionsRow> {
  const at = rows.findIndex((entry) => entry.id === 'controls')
  const index = at < 0 ? rows.length : at
  return [...rows.slice(0, index), row, ...rows.slice(index)]
}
