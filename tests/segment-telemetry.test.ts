import test from 'node:test'
import assert from 'node:assert/strict'
import { SegmentTelemetry, emptySegmentTelemetrySnapshot, segmentIdFor } from '../src/telemetry/segmentTelemetry'

test('an empty telemetry snapshot has zero deaths and no segments', () => {
  const telemetry = new SegmentTelemetry()
  const snapshot = telemetry.snapshot()
  assert.equal(snapshot.totalDeaths, 0)
  assert.deepEqual(snapshot.deathsBySegment, {})
  assert.deepEqual(snapshot.deathsByCause, { pit: 0, debug: 0, damage: 0 })
  assert.deepEqual(snapshot.killedByCounts, {})
  assert.deepEqual(snapshot.recentDeaths, [])
})

test('deaths accumulate per segment and per cause, with the killer counted when named', () => {
  const telemetry = new SegmentTelemetry()
  telemetry.recordDeath('tutorial_sentinel:0', 'damage', 1000, { x: 80, y: 120 }, 'enemy_basic_shot')
  telemetry.recordDeath('tutorial_sentinel:0', 'pit', 2000, { x: 90, y: 200 })
  telemetry.recordDeath('tutorial_sentinel:1', 'damage', 3000, { x: 300, y: 140 }, 'sentinel_rook')
  const snapshot = telemetry.snapshot()
  assert.equal(snapshot.totalDeaths, 3)
  assert.deepEqual(snapshot.deathsBySegment, { 'tutorial_sentinel:0': 2, 'tutorial_sentinel:1': 1 })
  assert.deepEqual(snapshot.deathsByCause, { pit: 1, debug: 0, damage: 2 })
  assert.deepEqual(snapshot.killedByCounts, { enemy_basic_shot: 1, sentinel_rook: 1 })
  assert.deepEqual(snapshot.recentDeaths[0], { segmentId: 'tutorial_sentinel:0', cause: 'damage', killedBy: 'enemy_basic_shot', atMs: 1000, x: 80, y: 120 })
})

test('damage taken credits its segment and ignores non-positive amounts', () => {
  const telemetry = new SegmentTelemetry()
  telemetry.recordDamage('tutorial_sentinel:0', 1)
  telemetry.recordDamage('tutorial_sentinel:0', 2)
  telemetry.recordDamage('tutorial_sentinel:1', 0)
  telemetry.recordDamage('tutorial_sentinel:1', -5)
  const snapshot = telemetry.snapshot()
  assert.deepEqual(snapshot.damageTakenBySegment, { 'tutorial_sentinel:0': 3 })
})

test('recentDeaths is bounded so a long run does not grow the snapshot without limit', () => {
  const telemetry = new SegmentTelemetry()
  for (let i = 0; i < 25; i += 1) telemetry.recordDeath('s', 'damage', i, { x: i, y: 0 })
  const snapshot = telemetry.snapshot()
  assert.equal(snapshot.totalDeaths, 25)
  assert.equal(snapshot.recentDeaths.length, 20)
  assert.equal(snapshot.recentDeaths[0].atMs, 5, 'keeps the most recent 20, oldest first')
  assert.equal(snapshot.recentDeaths[19].atMs, 24)
})

test('segmentsOverDeathBudget names only the segments over the given count (prompt 06 phase 6.8)', () => {
  const telemetry = new SegmentTelemetry()
  for (let i = 0; i < 4; i += 1) telemetry.recordDeath('hot_segment', 'damage', i, { x: 0, y: 0 })
  telemetry.recordDeath('cool_segment', 'damage', 0, { x: 0, y: 0 })
  assert.deepEqual(telemetry.segmentsOverDeathBudget(3), ['hot_segment'])
  assert.deepEqual(telemetry.segmentsOverDeathBudget(4), [])
})

test('segmentIdFor pairs a stage with a checkpoint index', () => {
  assert.equal(segmentIdFor('tutorial_sentinel', 0), 'tutorial_sentinel:0')
  assert.equal(segmentIdFor('pyro_maw_stage', 3), 'pyro_maw_stage:3')
})

test('emptySegmentTelemetrySnapshot matches a freshly constructed accumulator (stageDebug.telemetry() before any event)', () => {
  assert.deepEqual(emptySegmentTelemetrySnapshot(), new SegmentTelemetry().snapshot())
})
