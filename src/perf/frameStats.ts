/**
 * Pure frame-timing math for `window.perfDebug()` (prompt 08 8.5): no Phaser or DOM import, so it is
 * unit-tested without a scene. The caller (`src/main.ts`) owns the rolling sample buffer collected
 * from `game.events` 'prestep'/'postrender' and passes it in; this module only sorts and picks ranks,
 * the same technique `scripts/perf/footprint.mjs`'s `stepTimes` already uses for its own step-time
 * percentiles, so the two measurements read the same way.
 */
export type FrameTimeStats = {
  frames: number
  p50: number
  p95: number
  p99: number
  longFrames: number
}

/**
 * A frame at or above this misses the 60Hz budget (16.7ms) by a full frame's worth, not just jitter,
 * so normal variance under the p95/p99 budget (8.5: p95 <= 16.7ms, p99 <= 25ms) cannot count as "long".
 */
export const LONG_FRAME_THRESHOLD_MS = 33

export function computeFrameTimeStats(
  samplesMs: readonly number[],
  longFrameThresholdMs: number = LONG_FRAME_THRESHOLD_MS
): FrameTimeStats {
  if (samplesMs.length === 0) {
    return { frames: 0, p50: 0, p95: 0, p99: 0, longFrames: 0 }
  }
  const sorted = samplesMs.slice().sort((a, b) => a - b)
  const pick = (quantile: number): number => sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))]
  const longFrames = sorted.reduce((count, sample) => (sample >= longFrameThresholdMs ? count + 1 : count), 0)
  return { frames: sorted.length, p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), longFrames }
}
