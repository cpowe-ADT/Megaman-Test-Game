/**
 * Part 13c (EVAL-P6-012): prompt 06 phase 6.8's balance-from-data telemetry -- "accumulates per-segment
 * deaths, damage taken, time, and which enemy or hazard killed, for automated runs and for Craig's play".
 * Pure accumulator, no Phaser: `GameDebugHooks.ts` owns the one live instance per Game scene and is the
 * only adapter edge that feeds it real events (`docs/design/difficulty-curve.md` and `TESTING.md` record
 * which events are wired today).
 */

export type DeathCause = 'pit' | 'debug' | 'damage'

export interface SegmentDeathRecord {
  segmentId: string
  cause: DeathCause
  /** `sourceId` off the `PlayerDamageRequest` that killed the hero, when the caller has one (an enemy or hazard id). */
  killedBy: string | null
  atMs: number
  /** Where the hero died, in game pixels (`scripts/content/heatmap.mjs` plots this over the stage contact sheet). */
  x: number
  y: number
}

export interface SegmentTelemetrySnapshot {
  totalDeaths: number
  deathsBySegment: Record<string, number>
  deathsByCause: Record<DeathCause, number>
  killedByCounts: Record<string, number>
  damageTakenBySegment: Record<string, number>
  /** The most recent deaths, oldest first, bounded so a long run's snapshot stays small. */
  recentDeaths: SegmentDeathRecord[]
}

const RECENT_DEATHS_LIMIT = 20

function increment<K extends string>(bucket: Record<K, number>, key: K, amount = 1): void {
  bucket[key] = (bucket[key] ?? 0) + amount
}

export class SegmentTelemetry {
  private deaths: SegmentDeathRecord[] = []
  private damageTakenBySegment: Record<string, number> = {}

  recordDeath(segmentId: string, cause: DeathCause, atMs: number, position: { x: number; y: number }, killedBy: string | null = null): void {
    this.deaths.push({ segmentId, cause, killedBy, atMs, x: position.x, y: position.y })
  }

  /** Non-lethal or lethal damage taken, credited to the segment it happened in. Not wired to a live source yet (13c). */
  recordDamage(segmentId: string, amount: number): void {
    if (amount <= 0) return
    increment(this.damageTakenBySegment, segmentId, amount)
  }

  snapshot(): SegmentTelemetrySnapshot {
    const deathsBySegment: Record<string, number> = {}
    const deathsByCause: Record<DeathCause, number> = { pit: 0, debug: 0, damage: 0 }
    const killedByCounts: Record<string, number> = {}
    this.deaths.forEach((death) => {
      increment(deathsBySegment, death.segmentId)
      increment(deathsByCause, death.cause)
      if (death.killedBy) increment(killedByCounts, death.killedBy)
    })
    return {
      totalDeaths: this.deaths.length,
      deathsBySegment,
      deathsByCause,
      killedByCounts,
      damageTakenBySegment: { ...this.damageTakenBySegment },
      recentDeaths: this.deaths.slice(-RECENT_DEATHS_LIMIT)
    }
  }

  /** A segment over this many deaths on Normal is retuned or its tell strengthened (prompt 06 phase 6.8). */
  segmentsOverDeathBudget(budget: number): string[] {
    const snapshot = this.snapshot()
    return Object.entries(snapshot.deathsBySegment)
      .filter(([, count]) => count > budget)
      .map(([segmentId]) => segmentId)
  }
}

/** The stage and checkpoint a death or damage event happened in ("per segment" in the 6.8 sense: between checkpoints). */
export function segmentIdFor(stageId: string, checkpointIndex: number): string {
  return `${stageId}:${checkpointIndex}`
}

/** What `stageDebug.telemetry()` returns before any death or damage event has been recorded this scene. */
export function emptySegmentTelemetrySnapshot(): SegmentTelemetrySnapshot {
  return new SegmentTelemetry().snapshot()
}
