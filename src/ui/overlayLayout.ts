import { GAME_HEIGHT, GAME_WIDTH } from '../config/renderPolicy'
import { GAMEPLAY_VIEWPORT_TOP } from '../config/gameplayLayout'

/**
 * Where the blocking dialogue panel and the toast lane sit (05c playtest fix, 2026-09-24).
 *
 * Both used to hug the bottom of the frame. The 112px briefing panel hid the hero standing on the floor at
 * the start of the tutorial, and the lane covered the floor row, hero and boss feet included. In play both
 * now hang from the HUD band, where stages keep sky and background, and stop above `PLAY_OVERLAY_MAX_BOTTOM`
 * so the floor row (feet on about y 214 to 230) stays visible. Stage Select keeps the bottom panel.
 */
export const OVERLAY_TOP = GAMEPLAY_VIEWPORT_TOP + 3

/** Nothing a play overlay draws may reach below this row: a hero standing on the floor is drawn from about y 190. */
export const PLAY_OVERLAY_MAX_BOTTOM = 160

export type DialoguePlacement = 'top' | 'bottom'

export type DialoguePanelLayout = {
  centerX: number
  centerY: number
  width: number
  height: number
  top: number
  bottom: number
  speakerY: number
  bodyY: number
  /** `fixedHeight` of the body text: four wrapped lines at 11px, which covers the 180-character line rule. */
  bodyHeight: number
  /** The progress readout (`1/3 ENTER / CLICK • ESC SKIP`); `progressOriginY` 0 hangs it, 1 stands it. */
  progressY: number
  progressOriginY: 0 | 1
}

export function dialoguePanelLayout(placement: DialoguePlacement): DialoguePanelLayout {
  const width = GAME_WIDTH - 18
  const centerX = GAME_WIDTH / 2
  if (placement === 'bottom') {
    const height = 112
    const centerY = GAME_HEIGHT - height / 2 - 7
    return {
      centerX, centerY, width, height,
      top: centerY - height / 2,
      bottom: centerY + height / 2,
      speakerY: centerY - 45,
      bodyY: centerY - 25,
      bodyHeight: 62,
      progressY: centerY + 47,
      progressOriginY: 1
    }
  }
  // Top: the progress readout shares the speaker row (right-aligned), which saves the row the bottom
  // panel spends on it.
  const height = 88
  const top = OVERLAY_TOP
  return {
    centerX, centerY: top + height / 2, width, height,
    top,
    bottom: top + height,
    speakerY: top + 6,
    bodyY: top + 22,
    bodyHeight: 60,
    progressY: top + 8,
    progressOriginY: 0
  }
}

/** The toast lane's top edge in play; it grows downward to fit wrapped lines. */
export function toastLaneTop(): number {
  return OVERLAY_TOP
}
