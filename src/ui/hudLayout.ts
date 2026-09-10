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
    bossLabel: { x: viewWidth - barX, y: 8 }
  }
}
