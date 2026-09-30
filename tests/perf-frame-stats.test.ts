import test from 'node:test'
import assert from 'node:assert/strict'
import { computeFrameTimeStats, LONG_FRAME_THRESHOLD_MS } from '../src/perf/frameStats'

test('an empty sample buffer reports zeroed stats instead of NaN', () => {
  assert.deepEqual(computeFrameTimeStats([]), { frames: 0, p50: 0, p95: 0, p99: 0, longFrames: 0 })
})

test('percentiles sort samples and pick by rank, independent of input order', () => {
  // sorted: 10 11 12 13 14 15 16 17 40 100 (length 10)
  const samples = [17, 12, 11, 40, 13, 100, 15, 16, 10, 14]
  const stats = computeFrameTimeStats(samples)
  assert.equal(stats.frames, 10)
  assert.equal(stats.p50, 15) // floor(0.5*10)=5 -> sorted[5]
  assert.equal(stats.p95, 100) // floor(0.95*10)=9 -> sorted[9]
  assert.equal(stats.p99, 100) // floor(0.99*10)=9 -> sorted[9]
})

test('a single sample is every percentile, not a division by zero', () => {
  assert.deepEqual(computeFrameTimeStats([16.7]), { frames: 1, p50: 16.7, p95: 16.7, p99: 16.7, longFrames: 0 })
})

test('long frames count samples at or above the threshold, not a fraction of it', () => {
  assert.equal(LONG_FRAME_THRESHOLD_MS, 33)
  const stats = computeFrameTimeStats([16, 16, 32.9, 33, 50], 33)
  assert.equal(stats.longFrames, 2)
  assert.equal(computeFrameTimeStats([16, 16, 32.9, 33, 50]).longFrames, 2) // default threshold matches
})
