/**
 * Plain counters for `render_game_to_text().runtime` (prompt 08 8.5, smoke `63-restart-leak`): a
 * restarted stage that fails to remove a listener or clear a timer grows one of these. `src/main.ts`
 * wires the increment/decrement calls to `EventTarget.prototype.addEventListener`/`removeEventListener`
 * and the timer globals (gated on `AUTOMATION.enabled`, the same gate `window.__phaserGame` uses); this
 * module holds only the bookkeeping, so it is unit-tested without a DOM.
 */
export type RuntimeCounts = { listeners: number; timers: number }

export type RuntimeLeakCounters = {
  addListener: () => void
  removeListener: () => void
  startTimer: () => void
  endTimer: () => void
  snapshot: () => RuntimeCounts
}

export function createRuntimeLeakCounters(): RuntimeLeakCounters {
  const counts: RuntimeCounts = { listeners: 0, timers: 0 }
  return {
    addListener: () => {
      counts.listeners += 1
    },
    // A removeEventListener for a listener that was never added (a stale reference, a double
    // removal) must not push the count negative and hide a real leak behind it.
    removeListener: () => {
      counts.listeners = Math.max(0, counts.listeners - 1)
    },
    startTimer: () => {
      counts.timers += 1
    },
    endTimer: () => {
      counts.timers = Math.max(0, counts.timers - 1)
    },
    snapshot: () => ({ ...counts })
  }
}
