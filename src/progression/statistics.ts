import { CAMPAIGN_STAGES } from '../content/campaign'

export type CampaignStatistics = { playTimeMs: number; deaths: number; clearTimeMsByStage: Record<string, number>; secretsFoundByStage: Record<string, number> }
export const freshStatistics = (): CampaignStatistics => ({ playTimeMs: 0, deaths: 0, clearTimeMsByStage: {}, secretsFoundByStage: {} })
const nonnegative = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
export function normalizeStatistics(raw: Partial<CampaignStatistics> | null | undefined): CampaignStatistics {
  const stageNumbers = (values: unknown, max: number) => Object.fromEntries(Object.entries(values && typeof values === 'object' ? values : {}).filter(([id]) => id in CAMPAIGN_STAGES).map(([id,n]) => [id, Math.min(max, nonnegative(n))]))
  return { playTimeMs: nonnegative(raw?.playTimeMs), deaths: Math.floor(nonnegative(raw?.deaths)), clearTimeMsByStage: stageNumbers(raw?.clearTimeMsByStage, Number.MAX_SAFE_INTEGER), secretsFoundByStage: stageNumbers(raw?.secretsFoundByStage, 2) }
}

/** In-memory clock: callers flush only at save boundaries, never once per frame. */
export class CampaignSessionStatistics {
  private unflushedMs = 0
  stageElapsedMs = 0
  private deaths = 0
  private defeated = false
  constructor(elapsedMs = 0) { this.stageElapsedMs = nonnegative(elapsedMs) }
  tick(deltaMs: number, active: boolean): void {
    if (!active) return
    const ms = nonnegative(deltaMs); this.unflushedMs += ms; this.stageElapsedMs += ms
  }
  defeat(): void { if (!this.defeated) { this.deaths++; this.defeated = true } }
  respawn(): void { this.defeated = false }
  flush<T extends { stats: CampaignStatistics }>(save: T): T {
    const stats = normalizeStatistics(save.stats)
    stats.playTimeMs += this.unflushedMs; stats.deaths += this.deaths
    this.unflushedMs = 0; this.deaths = 0
    return { ...save, stats }
  }
  claim<T extends { stats: CampaignStatistics }>(save: T, locationId: string, duplicate: boolean): T {
    const next = this.flush(save)
    if (duplicate) return next
    const [stageId, kind] = locationId.split(':')
    if (kind === 'boss_clear') next.stats.clearTimeMsByStage[stageId] ??= this.stageElapsedMs
    if (kind === 'heart_tank' || kind === 'sub_tank') next.stats.secretsFoundByStage[stageId] = Math.min(2, (next.stats.secretsFoundByStage[stageId] ?? 0) + 1)
    return next
  }
}
