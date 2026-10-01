/**
 * The Options screen's display rows (prompt 04 §4.3, prompt 08 §8.4): Fullscreen, Pixel scaling and
 * Reduced flashing. Pure; `OptionsScene` inserts them before Controls and applies the change.
 */
import type { PixelScaling } from '../../config/renderPolicy'

export type DisplayOptionsRowId = 'fullscreen' | 'pixelScaling' | 'reducedFlashing'
export type DisplayOptionsRow = { id: DisplayOptionsRowId; label: string; value: string; kind: 'cycle' }
export type FullscreenState = 'on' | 'off' | 'unavailable'
export type DisplayOptionsState = Readonly<{ fullscreen: FullscreenState; pixelScaling: PixelScaling; reducedFlashing: boolean }>
export type DisplayOptionsChange = Readonly<{
  settings?: Readonly<{ pixelScaling?: PixelScaling; reducedFlashing?: boolean }>
  /** Enter (true) or leave (false) fullscreen; the browser owns this state, so it is not stored. */
  fullscreen?: boolean
}>

export const DISPLAY_OPTION_IDS: readonly DisplayOptionsRowId[] = Object.freeze(['fullscreen', 'pixelScaling', 'reducedFlashing'])

export function isDisplayOptionId(id: string): id is DisplayOptionsRowId {
  return (DISPLAY_OPTION_IDS as readonly string[]).includes(id)
}

export function displayOptionsRows(state: DisplayOptionsState): DisplayOptionsRow[] {
  return [
    { id: 'fullscreen', label: 'Fullscreen', value: state.fullscreen === 'unavailable' ? 'N/A' : state.fullscreen.toUpperCase(), kind: 'cycle' },
    { id: 'pixelScaling', label: 'Pixel Scaling', value: state.pixelScaling.toUpperCase(), kind: 'cycle' },
    { id: 'reducedFlashing', label: 'Reduced Flashing', value: state.reducedFlashing ? 'ON' : 'OFF', kind: 'cycle' }
  ]
}

/** Every row has two values, so left and right both toggle. */
export function applyDisplayOptionChange(state: DisplayOptionsState, id: DisplayOptionsRowId): DisplayOptionsChange {
  switch (id) {
    case 'fullscreen':
      return state.fullscreen === 'unavailable' ? {} : { fullscreen: state.fullscreen !== 'on' }
    case 'pixelScaling':
      return { settings: { pixelScaling: state.pixelScaling === 'integer' ? 'smooth' : 'integer' } }
    case 'reducedFlashing':
      return { settings: { reducedFlashing: !state.reducedFlashing } }
  }
}

/** The display rows go before Controls, so the action rows (Controls, Delete, Back) stay last. */
export function withDisplayRows<T extends { id: string }>(rows: readonly T[], display: readonly DisplayOptionsRow[]): Array<T | DisplayOptionsRow> {
  const at = rows.findIndex(row => row.id === 'controls')
  const index = at < 0 ? rows.length : at
  return [...rows.slice(0, index), ...display, ...rows.slice(index)]
}

export const DISPLAY_OPTION_HINTS: Readonly<Record<DisplayOptionsRowId, string>> = Object.freeze({
  fullscreen: 'LEFT / RIGHT FULLSCREEN     ESC BACK',
  pixelScaling: 'SMOOTH FILLS WINDOWS UNDER 2X   INTEGER KEEPS WHOLE PIXELS',
  reducedFlashing: 'DIMS THE CHARGE RING AND EXPLOSION BURSTS'
})
