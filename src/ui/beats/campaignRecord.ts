import { ALL_UPGRADE_IDS } from '../../progression/catalog'

// The ending's CAMPAIGN RECORD card and credits speed (prompt 04 phase 4.2 item 9, part 12i, EVAL-P8-004).

export type CampaignRecordSave = {
  stats: { playTimeMs: number; deaths: number }
  heartTanks: number
  subTanks: number
  upgradeUnlocks: readonly string[]
  difficulty: string
}

export type CampaignRecordRow = { label: string; value: string }

export const RECORD_HEARTS_MAX = 8
export const RECORD_SUB_TANKS_MAX = 4
export const RECORD_CAPSULES_MAX = ALL_UPGRADE_IDS.length

/** The rank rule: no deaths FLAWLESS, up to nine STEADY, ten or more RELENTLESS (from `SaveData.stats.deaths`). */
export function campaignRank(stats: { deaths: number }): 'FLAWLESS' | 'STEADY' | 'RELENTLESS' {
  const deaths = Math.max(0, Math.floor(Number(stats.deaths) || 0))
  return deaths === 0 ? 'FLAWLESS' : deaths < 10 ? 'STEADY' : 'RELENTLESS'
}

/** `3H 07M`, from whole minutes. */
export function formatPlayTime(ms: number): string {
  const minutes = Math.floor(Math.max(0, Number(ms) || 0) / 60000)
  return `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`
}

/** The card's rows, top to bottom; capsules are the armor parts and chips held. */
export function campaignRecordRows(save: CampaignRecordSave): CampaignRecordRow[] {
  const capsules = save.upgradeUnlocks.filter((id) => (ALL_UPGRADE_IDS as readonly string[]).includes(id)).length
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)))
  return [
    { label: 'PLAY TIME', value: formatPlayTime(save.stats.playTimeMs) },
    { label: 'HEARTS', value: `${clamp(save.heartTanks, RECORD_HEARTS_MAX)}/${RECORD_HEARTS_MAX}` },
    { label: 'SUB TANKS', value: `${clamp(save.subTanks, RECORD_SUB_TANKS_MAX)}/${RECORD_SUB_TANKS_MAX}` },
    { label: 'CAPSULES', value: `${capsules}/${RECORD_CAPSULES_MAX}` },
    { label: 'DEATHS', value: String(Math.max(0, Math.floor(Number(save.stats.deaths) || 0))) },
    { label: 'DIFFICULTY', value: String(save.difficulty || 'normal').toUpperCase() },
    { label: 'RANK', value: campaignRank(save.stats) }
  ]
}

/** Each credits line stays fully on screen at least this long. */
export const CREDITS_MIN_LINE_MS = 2500
/** The scroll's pace when the view is tall enough: about 36 px a second. */
export const CREDITS_BASE_MS_PER_PX = 28

/**
 * Milliseconds per pixel of scroll. A line `lineHeightPx` tall is whole on screen while it crosses the visible band
 * (`visibleSpanPx`, the view less the footer band), so the pace is never faster than that band allows for
 * CREDITS_MIN_LINE_MS; the default pace is slower still.
 */
export function creditsMsPerPx(visibleSpanPx: number, lineHeightPx: number): number {
  const travel = Math.max(1, visibleSpanPx - Math.max(0, lineHeightPx))
  return Math.max(CREDITS_BASE_MS_PER_PX, Math.ceil(CREDITS_MIN_LINE_MS / travel))
}

/** How long one line stays whole on screen at `msPerPx`. */
export function creditsLineOnScreenMs(visibleSpanPx: number, lineHeightPx: number, msPerPx: number): number {
  return Math.max(0, visibleSpanPx - Math.max(0, lineHeightPx)) * msPerPx
}

/** The final OMEGA RELAY title card holds this long before the ending returns to Title (Enter leaves at once). */
export const TITLE_CARD_MS = 3200
