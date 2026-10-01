import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, getStageContentRetentionReport, type StagePlatformDefinition } from '../src/content/campaign.ts'
import { DIALOGUE_REGISTRY } from '../src/content/dialogue/index.ts'
import {
  OMEGA_ACT1_END,
  OMEGA_ACT3_START,
  OMEGA_CHECKPOINT_ACTS,
  OMEGA_HUB,
  OMEGA_HUB_GATE,
  OMEGA_ROUTE_WIDTH
} from '../src/content/stages/omegaFortress.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'

// EVAL-P6-011 / EVAL-P2-007 (12e): the Central Core in three acts. Measured on this build (Heat Works, 2026-09-24):
// held running jump 246px across, about 124px up; dash jump 336px; run 220px/s.
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 124
const RUN_PX_PER_S = 220
const FLOOR = 236
const SCREEN = 448

const stage = () => getCampaignStage('omega_fortress')
const box = (platform: StagePlatformDefinition) => {
  const half = (platform.height ?? 8) / 2
  return { left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - half, bottom: platform.y + half }
}
const inRange = (x: number, [from, to]: [number, number]) => x >= from && x < to
const ACT1: [number, number] = [0, OMEGA_ACT1_END]
const HUB: [number, number] = [OMEGA_HUB.x, OMEGA_HUB.x + OMEGA_HUB.width]
const ACT3: [number, number] = [OMEGA_ACT3_START, OMEGA_ROUTE_WIDTH]

test('central core: three acts in one route, 10 + 2 + 4 screens, then the Core room unchanged', () => {
  const { arena, bossId, runtimeBossConfigId } = stage()
  assert.equal(OMEGA_ACT1_END, 10 * SCREEN)
  assert.deepEqual(HUB, [10 * SCREEN, 12 * SCREEN])
  assert.equal(OMEGA_ROUTE_WIDTH - OMEGA_ACT3_START, 4 * SCREEN)
  assert.equal(arena.bossRoom.x, OMEGA_ROUTE_WIDTH)
  assert.equal(bossId, 'omega_core')
  assert.equal(runtimeBossConfigId, 'omega_core')
  const retention = getStageContentRetentionReport('omega_fortress')
  assert.deepEqual(retention?.authored, retention?.retained, 'nothing is cut by the boss room')
})

test('central core: checkpoints at the start, the radio (checkpoint 2), and each act boundary', () => {
  const checkpoints = stage().arena.checkpoints
  assert.deepEqual(checkpoints.map((entry) => entry.id), ['omega_start', 'omega_spire_mid', 'omega_archive', 'omega_core', 'omega_core_gate'])
  assert.deepEqual(checkpoints.map((entry) => OMEGA_CHECKPOINT_ACTS[entry.id]), [1, 1, 2, 3, 3])
  const archive = checkpoints[2]
  assert.ok(archive.triggerX >= OMEGA_ACT1_END && archive.x < OMEGA_DOOR_ZONE_LEFT(), 'act 1 ends at the archive door, before the first door')
  assert.ok(checkpoints[3].triggerX > OMEGA_HUB_GATE.x + OMEGA_HUB_GATE.width, 'act 3 starts past the sealed exit')
  assert.equal(checkpoints[1].radioSequenceId, 'omega_fortress_radio')
  const radio = DIALOGUE_REGISTRY.getSequenceById('omega_fortress_radio')
  assert.deepEqual(radio?.lines.map((line) => line.speakerId), ['director_iona', 'omega_core'], 'Iona, then the OMEGA intrusion')
  for (let index = 1; index < checkpoints.length; index += 1) assert.ok(checkpoints[index].triggerX > checkpoints[index - 1].triggerX)
})

function OMEGA_DOOR_ZONE_LEFT(): number {
  return 4600 - 14
}

test('central core act 1: four district mechanics, first met in ascending order, and two tall segments', () => {
  const { arena } = stage()
  const first = (xs: number[]) => Math.min(...xs.filter((x) => inRange(x, ACT1)))
  const belts = first((arena.conveyors ?? []).map((entry) => entry.x - entry.width / 2))
  const rails = first((arena.timedRailGroups ?? []).flatMap((group) => group.rails.map((rail) => rail.x)))
  const gusts = first((arena.windZones ?? []).map((zone) => zone.x))
  const liquid = first((arena.risingLiquids ?? []).map((entry) => entry.x))
  assert.ok([belts, rails, gusts, liquid].every(Number.isFinite), 'belts, rails, gusts and rising coolant all appear in act 1')
  assert.ok(belts < rails && rails < gusts && gusts < liquid, `teach order ${[belts, rails, gusts, liquid]}`)
  const segments = (arena.verticalSegments ?? []).filter((segment) => inRange(segment.x, ACT1))
  assert.equal(segments.length, 2)
  assert.ok(segments.every((segment) => segment.verticalScreens === 2 && segment.width === SCREEN))
  // The last screen remixes two (the flood run with a live rail on its middle block): the hardest screen is last.
  const flood = (arena.risingLiquids ?? []).find((entry) => entry.id === 'omega_coolant_flood')
  const floodRail = (arena.timedRailGroups ?? []).find((group) => group.id === 'omega_rails_flood')
  assert.ok(flood && floodRail && inRange(flood.x, [9 * SCREEN, 10 * SCREEN]))
})

test('central core act 3: four screens with the finale mechanics (rails and gusts)', () => {
  const { arena } = stage()
  assert.ok((arena.timedRailGroups ?? []).some((group) => group.rails.some((rail) => inRange(rail.x, ACT3))))
  assert.ok((arena.windZones ?? []).some((zone) => inRange(zone.x, ACT3)))
})

test('central core: the route budget (30 placements of 8 types, 12 hazards, 4+ pits, 4+ carriers, no secrets)', () => {
  const { arena, enemyMarkers } = stage()
  assert.equal(enemyMarkers.length, 30)
  assert.equal(new Set(enemyMarkers.map((marker) => marker.typeKey)).size, 8)
  assert.ok(arena.hazards.length >= 12)
  assert.ok((arena.floorGaps ?? []).length >= 4)
  assert.ok(arena.allowFallOff)
  assert.ok(arena.midPlatforms.filter((platform) => platform.motion).length >= 4)
  assert.equal(arena.locationAnchors, undefined)
  assert.deepEqual(getStageLocationDefinitions('omega_fortress').filter((location) => location.category === 'heart_tank' || location.category === 'sub_tank'), [])
  assert.equal(arena.roomLocks, undefined, 'no mini-boss: the gauntlet is the mini-boss')
})

test('central core: the archive is quiet (no enemies, hazards, pits or mechanics between its doors)', () => {
  const { arena, enemyMarkers } = stage()
  assert.deepEqual(enemyMarkers.filter((marker) => inRange(marker.x, HUB)).map((marker) => marker.id), [])
  assert.deepEqual(arena.hazards.filter((hazard) => inRange(hazard.x, HUB)).map((hazard) => hazard.id), [])
  assert.deepEqual((arena.floorGaps ?? []).filter((gap) => inRange(gap.x, HUB) || inRange(gap.x + gap.width, HUB)), [])
  const mechanics = [...(arena.conveyors ?? []), ...(arena.windZones ?? []), ...(arena.risingLiquids ?? [])]
  assert.deepEqual(mechanics.filter((entry) => inRange(entry.x, HUB)).map((entry) => entry.id), [])
})

test('central core: every pit is crossable (a plain jump, or a carrier and a dash jump for the chasm)', () => {
  const { arena } = stage()
  for (const gap of arena.floorGaps ?? []) {
    assert.ok(gap.width < DASH_JUMP_PX - 24, `${gap.x}: ${gap.width}px`)
    if (gap.width < PLAIN_JUMP_PX - 40) continue
    const carriers = arena.midPlatforms.filter((platform) => platform.motion && platform.x > gap.x && platform.x < gap.x + gap.width)
    assert.ok(carriers.length > 0, `the ${gap.width}px pit at ${gap.x} has a carrier`)
  }
})

test('central core: no spike hides in a block or waits on a pit landing', () => {
  const { arena } = stage()
  const solids = arena.midPlatforms.filter((platform) => platform.type === 'solid').map(box)
  for (const hazard of arena.hazards) {
    const left = hazard.x - 14
    const right = hazard.x + 14
    const top = hazard.y - 5
    const buried = solids.find((solid) => right > solid.left && left < solid.right && top > solid.top + 1 && top < solid.bottom)
    assert.equal(buried, undefined, `${hazard.id} is inside a block`)
    for (const gap of arena.floorGaps ?? []) {
      const landing = gap.x + gap.width
      assert.ok(!(left < landing + 40 && right > landing), `${hazard.id} sits on the landing of the pit at ${gap.x}`)
    }
  }
})

test('central core: the climb steps within a jump, and the floor rails cross in one quiet window', () => {
  const ledges = stage().arena.midPlatforms.filter((platform) => /^omega_climb_\d$/.test(platform.id)).map(box)
  assert.equal(ledges.length, 9)
  let previous = { left: 2240, right: 2328, top: FLOOR, bottom: FLOOR }
  for (const ledge of ledges) {
    assert.ok(previous.top - ledge.top <= MAX_RISE_PX - 40, `rise to ${ledge.top}`)
    const gap = Math.max(ledge.left - previous.right, previous.left - ledge.right, 0)
    assert.ok(gap <= 64, `gap ${gap}px`)
    previous = ledge
  }
  for (const group of stage().arena.timedRailGroups ?? []) {
    const offMs = group.timing?.offMs ?? 1800
    const floorRails = group.rails.filter((rail) => rail.y === FLOOR).map((rail) => rail.x).sort((a, b) => a - b)
    const runs: number[][] = []
    for (const x of floorRails) {
      const last = runs[runs.length - 1]
      if (last && x - last[last.length - 1] <= 128) last.push(x)
      else runs.push([x])
    }
    for (const run of runs) {
      const span = run[run.length - 1] - run[0] + 56
      assert.ok((span / RUN_PX_PER_S) * 1000 <= offMs * 0.7, `${group.id}: ${span}px in ${offMs}ms`)
    }
  }
  for (const zone of stage().arena.windZones ?? []) assert.ok((zone.timing?.offMs ?? 1800) >= 1200, `${zone.id} leaves a lull`)
})

test('central core: placements stream in ahead, and none is alive at the Core door where rematches start', () => {
  const { enemyMarkers, arena } = stage()
  const gate = arena.checkpoints[arena.checkpoints.length - 1]
  for (const marker of enemyMarkers) {
    assert.ok((marker.spawnTriggerX ?? 0) <= marker.x - SCREEN, `${marker.id} spawns off screen`)
    assert.ok((marker.retireTriggerX ?? Infinity) <= gate.triggerX, `${marker.id} retires before the Core door`)
  }
  const liquids = arena.risingLiquids ?? []
  assert.ok(liquids.every((entry) => entry.topY < FLOOR), 'the coolant rises over the floor')
})
