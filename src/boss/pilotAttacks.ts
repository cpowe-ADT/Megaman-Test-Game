/**
 * The Pyro Maw and Tide Reaver pilot attacks (prompt 07 phase 7.1 item 4, EVAL-P7-001). Pure schedules the boss
 * projectile controller fires from: Serpent Stream sweeps a flame cone over its active time instead of one fan,
 * and Lance Volley fires two lances in phase one and three after, one after another ("two to three piercing
 * lances in sequence", `src/bosses/roster.ts`). Blaze Lob's landing burst is the `blaze_lob` hazard spawner and
 * Riptide Crash's ceiling drop is the `dropToPlayerColumn` dive in `src/bosses/BossMotionController.ts`.
 */

/** One flame every 90ms, sweeping from the floor ahead of the boss (+0.3 rad) up through the cone (-0.34 rad). */
export const SERPENT_STREAM = { intervalMs: 90, fromAngle: 0.3, toAngle: -0.34, speed: 190, scale: 1.35 } as const

/**
 * The flames of one Serpent Stream: when each leaves (ms after the attack executes) and its angle off the facing
 * line, for a boss facing right (positive is down; the controller mirrors it for a boss facing left).
 */
export function serpentStreamSweep(activeMs: number): Array<{ atMs: number; angle: number }> {
  const count = Math.max(2, Math.floor(Math.max(0, activeMs) / SERPENT_STREAM.intervalMs))
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1)
    return {
      atMs: index * SERPENT_STREAM.intervalMs,
      angle: SERPENT_STREAM.fromAngle + (SERPENT_STREAM.toAngle - SERPENT_STREAM.fromAngle) * t
    }
  })
}

export const LANCE_VOLLEY = { intervalMs: 150 } as const

/** Lances in one Lance Volley: two in phase one, three from phase two on. */
export function lanceVolleyCount(phaseIndex: number): number {
  return phaseIndex >= 1 ? 3 : 2
}
