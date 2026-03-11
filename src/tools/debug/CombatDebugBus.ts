export type CombatDebugHitSource = 'player' | 'enemy' | 'boss' | 'hazard' | 'system'
export type CombatDebugHitTarget = 'player' | 'enemy' | 'boss' | 'environment'

export type CombatDebugHitEvent = {
  timeMs: number
  source: CombatDebugHitSource
  target: CombatDebugHitTarget
  amount: number
  kind: string
  accepted: boolean
  note?: string
}

export type CombatDebugTotals = {
  total: number
  accepted: number
  rejected: number
  byTarget: Record<CombatDebugHitTarget, number>
}

export class CombatDebugBus {
  private readonly events: CombatDebugHitEvent[] = []

  constructor(private readonly capacity = 40) {}

  record(event: Omit<CombatDebugHitEvent, 'timeMs'> & { timeMs?: number }): void {
    const next: CombatDebugHitEvent = {
      ...event,
      timeMs: Number.isFinite(event.timeMs) ? Number(event.timeMs) : Date.now()
    }
    this.events.push(next)
    if (this.events.length > this.capacity) {
      this.events.splice(0, this.events.length - this.capacity)
    }
  }

  getRecentHits(limit = 8): CombatDebugHitEvent[] {
    const clamped = Math.max(1, Math.floor(limit))
    return this.events.slice(Math.max(0, this.events.length - clamped))
  }

  getTotals(): CombatDebugTotals {
    const totals: CombatDebugTotals = {
      total: this.events.length,
      accepted: 0,
      rejected: 0,
      byTarget: {
        player: 0,
        enemy: 0,
        boss: 0,
        environment: 0
      }
    }

    for (const event of this.events) {
      if (event.accepted) {
        totals.accepted += 1
      } else {
        totals.rejected += 1
      }
      totals.byTarget[event.target] += 1
    }

    return totals
  }

  clear(): void {
    this.events.length = 0
  }
}
