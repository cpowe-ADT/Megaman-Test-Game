import { portraitForSpeaker } from './dialoguePortraits'
import type { HudLayout } from './hudLayout'

/** Part 12i (EVAL-P8-003): the boss portrait beside the boss bar. Pure. */
export const HUD_BOSS_PORTRAIT_SIZE = 24

/** The HUD's boss label ('PYRO MAW', 'Sentinel ROOK') names the speaker id; returns its portrait frame, or null. */
export function bossPortraitFrameForLabel(label: string | null | undefined): string | null {
  const id = String(label ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return id ? portraitForSpeaker(id) : null
}

/**
 * A 24px badge (the 48px portrait at exactly half scale) hanging from the boss panel's lower-left corner into the HUD
 * band, under the start of the bar and clear of the LIVES readout on the right. The bar keeps the player bar's width.
 */
export function hudBossPortraitPlacement(layout: Pick<HudLayout, 'bossPanel' | 'height'>): { x: number; y: number; size: number } {
  return { x: layout.bossPanel.x + 4, y: layout.height - HUD_BOSS_PORTRAIT_SIZE, size: HUD_BOSS_PORTRAIT_SIZE }
}
