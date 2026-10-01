export type HudRect = { x: number; y: number; width: number; height: number }

export type HudLayout = {
  height: number
  playerPanel: HudRect
  centerPanel: HudRect
  bossPanel: HudRect
  playerBar: HudRect
  weaponBar: HudRect
  bossBar: HudRect
  playerLabel: { x: number; y: number }
  weaponLabel: { x: number; y: number }
  bossLabel: { x: number; y: number }
  /** Right-aligned under the boss panel, inside the HUD band (it used to sit on the playfield floor). */
  livesLabel: { x: number; y: number }
}

/** The phase label's fixed box (64x24 at 7px font) fit two short lines comfortably; wider strings need to wrap. */
const DISTRICT_LABEL_MAX_CHARS_PER_LINE = 10

/**
 * Formats a stage district for the centre HUD label: upper case, wrapped onto its own line only when
 * the whole name does not fit one. Always returns exactly one line break (a second, possibly empty,
 * line), matching the fixed two-line box the label was laid out for.
 */
export function formatDistrictLabel(district: string): string {
  const words = district.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return '\n'
  }

  let line1 = ''
  let index = 0
  while (index < words.length) {
    const candidate = line1 ? `${line1} ${words[index]}` : words[index]
    if (line1 === '' || candidate.length <= DISTRICT_LABEL_MAX_CHARS_PER_LINE) {
      line1 = candidate
      index += 1
    } else {
      break
    }
  }

  const line2 = words.slice(index).join(' ')
  return `${line1.toUpperCase()}\n${line2.toUpperCase()}`
}

export function getHudLayout(viewWidth: number): HudLayout {
  const panelWidth = 176
  const panelX = 10
  const barX = 19
  const barWidth = 158
  const bossPanelX = viewWidth - panelX - panelWidth

  return {
    height: 58,
    playerPanel: { x: panelX, y: 4, width: panelWidth, height: 51 },
    centerPanel: { x: viewWidth / 2 - 34, y: 4, width: 68, height: 31 },
    bossPanel: { x: bossPanelX, y: 4, width: panelWidth, height: 31 },
    playerBar: { x: barX, y: 20, width: barWidth, height: 10 },
    weaponBar: { x: barX, y: 43, width: barWidth, height: 9 },
    bossBar: { x: bossPanelX + 9, y: 20, width: barWidth, height: 10 },
    playerLabel: { x: barX, y: 8 },
    weaponLabel: { x: barX, y: 31 },
    bossLabel: { x: viewWidth - barX, y: 8 },
    livesLabel: { x: viewWidth - barX, y: 40 }
  }
}
