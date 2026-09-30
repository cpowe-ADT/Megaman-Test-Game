import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { auditPickupPlacements, classifyPlacement, type SurfaceRect } from '../src/content/pickupPlacementRule'
import { PICKUPS_ATLAS, PICKUP_ART_GROUPS, type PickupArtGroup } from '../src/ui/pickups/pickupArt'

// Part 13e (EVAL-P13-010): the probe at output/probes/13a/placement-audit.ts, promoted. Every placed pickup
// (the eight warden stages' four anchors, the tutorial's two defaults) must sit grounded within 2px of its
// real surface or be explicitly marked float; none may sit inside a solid or over a pit.

function readAtlasFrameSizes(): Partial<Record<PickupArtGroup, { width: number; height: number }>> {
  const atlas = JSON.parse(fs.readFileSync(PICKUPS_ATLAS.data, 'utf8')) as {
    frames: Record<string, { frame: { w: number; h: number } }>
  }
  const sizes: Partial<Record<PickupArtGroup, { width: number; height: number }>> = {}
  for (const group of PICKUP_ART_GROUPS) {
    const frame = atlas.frames[`${PICKUPS_ATLAS.key.replace('atlas_', '')}/${group}/000`]
    if (frame) {
      sizes[group] = { width: frame.frame.w, height: frame.frame.h }
    }
  }
  return sizes
}

test('every glow frame (001) is exactly the same size as its base frame (000): no width jump at 4fps', () => {
  const atlas = JSON.parse(fs.readFileSync(PICKUPS_ATLAS.data, 'utf8')) as {
    frames: Record<string, { frame: { w: number; h: number } }>
  }
  const atlasKey = PICKUPS_ATLAS.key.replace('atlas_', '')
  for (const group of PICKUP_ART_GROUPS) {
    const base = atlas.frames[`${atlasKey}/${group}/000`]
    const glow = atlas.frames[`${atlasKey}/${group}/001`]
    assert.ok(base, `${group} frame 000`)
    assert.ok(glow, `${group} frame 001`)
    assert.equal(glow.frame.w, base.frame.w, `${group} glow width`)
    assert.equal(glow.frame.h, base.frame.h, `${group} glow height`)
  }
})

test('every campaign pickup placement is grounded within 2px or marked float, never inside a solid or over a pit', () => {
  const rows = auditPickupPlacements(readAtlasFrameSizes())
  // 2 tutorial defaults + 8 warden stages x 4 anchors = 34 (13a's count; omega_fortress's hub refills are a
  // separate hand-rolled mechanism and never reach getStageLocationDefinitions).
  assert.equal(rows.length, 34, 'every placed pickup the probe counted')
  for (const row of rows) {
    assert.notEqual(row.verdict, 'inside_solid', `${row.id}: ${JSON.stringify(row)}`)
    assert.notEqual(row.verdict, 'over_pit', `${row.id}: ${JSON.stringify(row)}`)
    assert.ok(
      row.verdict === 'grounded' || row.verdict === 'floating_ok',
      `${row.id} should be grounded or a marked float, was ${row.verdict}: ${JSON.stringify(row)}`
    )
  }
  // 13e's fix grounds every one of them (none is a designed float today).
  assert.equal(rows.filter((r) => r.verdict === 'grounded').length, 34)
})

// --- classifyPlacement in isolation: fabricated surfaces, so the rule's own branches are proven regardless
// of what the campaign currently contains. ---

const FLOOR: SurfaceRect = { id: 'floor', left: 0, right: 200, top: 100, bottom: 108, type: 'solid', moving: false }
const LEDGE: SurfaceRect = { id: 'ledge', left: 40, right: 80, top: 60, bottom: 68, type: 'oneWay', moving: false }
const WALL: SurfaceRect = { id: 'wall', left: 90, right: 106, top: 20, bottom: 100, type: 'wall', moving: false }

test('classifyPlacement: sitting exactly on a surface is grounded', () => {
  const art = { left: 45, right: 55, top: 50, bottom: 60 } // bottom at the ledge's top (60): gap 0
  const result = classifyPlacement(art, 50, [FLOOR, LEDGE, WALL], 'ground')
  assert.deepEqual(result, { verdict: 'grounded', gap: 0, surfaceTop: 60 })
})

test('classifyPlacement: a 1px sink still counts as grounded (the probe\'s own tolerance)', () => {
  const art = { left: 45, right: 55, top: 51, bottom: 61 }
  const result = classifyPlacement(art, 50, [FLOOR, LEDGE, WALL], 'ground')
  assert.equal(result.verdict, 'grounded')
  assert.equal(result.gap, -1)
})

test('classifyPlacement: hovering more than 2px above a real surface is floating_wrong when marked ground', () => {
  const art = { left: 45, right: 55, top: 30, bottom: 40 } // 20px above the ledge
  const result = classifyPlacement(art, 50, [FLOOR, LEDGE, WALL], 'ground')
  assert.deepEqual(result, { verdict: 'floating_wrong', gap: 20, surfaceTop: 60 })
})

test('classifyPlacement: the same hover is floating_ok when marked float', () => {
  const art = { left: 45, right: 55, top: 30, bottom: 40 }
  const result = classifyPlacement(art, 50, [FLOOR, LEDGE, WALL], 'float')
  assert.deepEqual(result, { verdict: 'floating_ok', gap: 20, surfaceTop: 60 })
})

test('classifyPlacement: nothing at all underneath is over_pit regardless of rest', () => {
  const art = { left: 250, right: 260, top: 40, bottom: 50 } // past every surface's x range
  assert.equal(classifyPlacement(art, 255, [FLOOR, LEDGE, WALL], 'ground').verdict, 'over_pit')
  assert.equal(classifyPlacement(art, 255, [FLOOR, LEDGE, WALL], 'float').verdict, 'over_pit')
})

test('classifyPlacement: overlapping a solid/wall by more than the tolerance is inside_solid, even over a real surface', () => {
  const art = { left: 95, right: 105, top: 50, bottom: 70 } // deep inside WALL (20..100), also over FLOOR
  const result = classifyPlacement(art, 100, [FLOOR, LEDGE, WALL], 'ground')
  assert.equal(result.verdict, 'inside_solid')
})

test('classifyPlacement: a one-way platform never blocks (only solid/wall types can)', () => {
  const art = { left: 45, right: 55, top: 55, bottom: 65 } // overlaps the one-way LEDGE by 5px
  const result = classifyPlacement(art, 50, [FLOOR, LEDGE, WALL], 'ground')
  assert.notEqual(result.verdict, 'inside_solid')
})
