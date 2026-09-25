import test from 'node:test'
import assert from 'node:assert/strict'
import { alphaBoundingBox, auditFrameAlphaBox, auditAtlasFrames, MIN_ALPHA_BOX_HEIGHT } from '../src/assets/playerFrameAudit'
import type { DecodedPng } from '../src/assets/pngDecode'

function getterFromGrid(grid: number[][]): (x: number, y: number) => number {
  return (x, y) => grid[y]?.[x] ?? 0
}

test('alphaBoundingBox finds the tight box of opaque pixels', () => {
  const grid = [
    [0, 0, 0, 0],
    [0, 255, 255, 0],
    [0, 255, 255, 0],
    [0, 0, 0, 0]
  ]
  const box = alphaBoundingBox(getterFromGrid(grid), 4, 4)
  assert.deepEqual(box, { minX: 1, minY: 1, maxX: 2, maxY: 2 })
})

test('alphaBoundingBox returns null for a fully transparent region', () => {
  const box = alphaBoundingBox(() => 0, 3, 3)
  assert.equal(box, null)
})

test('auditFrameAlphaBox flags an empty frame', () => {
  const issue = auditFrameAlphaBox('player_main/idle/000', null, 48, 48)
  assert.deepEqual(issue, { frame: 'player_main/idle/000', reason: 'empty (no opaque pixels)' })
})

test('auditFrameAlphaBox flags a box under the minimum height', () => {
  const box = { minX: 10, minY: 10, maxX: 20, maxY: 10 + MIN_ALPHA_BOX_HEIGHT - 2 } // height under the minimum
  const issue = auditFrameAlphaBox('player_main/turn/000', box, 48, 48)
  assert.ok(issue)
  assert.match(issue!.reason, /alpha box \d+px tall, under 22px/)
})

test('auditFrameAlphaBox flags a box that touches the cell edge', () => {
  const box = { minX: 0, minY: 5, maxX: 20, maxY: 30 }
  const issue = auditFrameAlphaBox('player_main/run/000', box, 48, 48)
  assert.ok(issue)
  assert.match(issue!.reason, /touches the 48x48 cell edge/)
})

test('auditFrameAlphaBox passes a well-formed frame', () => {
  const box = { minX: 5, minY: 2, maxX: 40, maxY: 43 } // 42px tall, margins on every side
  const issue = auditFrameAlphaBox('player_main/land/000', box, 48, 48)
  assert.equal(issue, null)
})

function makeAtlas(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): DecodedPng {
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = fill(x, y)
      const offset = (y * width + x) * 4
      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = a
    }
  }
  return { width, height, pixels }
}

test('auditAtlasFrames finds a bad frame among good ones in a two-cell atlas', () => {
  const cell = 48
  // Left cell (x 0-47): a tall opaque column with margin (good). Right cell (x 48-95): opaque pixels
  // reach the top row of its own cell (bad, touches the edge).
  const atlas = makeAtlas(cell * 2, cell, (x, y) => {
    if (x < cell) {
      const inBody = x >= 15 && x <= 32 && y >= 2 && y <= 45
      return inBody ? [200, 100, 50, 255] : [0, 0, 0, 0]
    }
    const localX = x - cell
    const inBody = localX >= 15 && localX <= 32 && y >= 0 && y <= 30
    return inBody ? [200, 100, 50, 255] : [0, 0, 0, 0]
  })

  const issues = auditAtlasFrames(atlas, {
    'player_main/idle/000': { x: 0, y: 0, w: cell, h: cell },
    'player_main/turn/000': { x: cell, y: 0, w: cell, h: cell }
  })

  assert.equal(issues.length, 1)
  assert.equal(issues[0].frame, 'player_main/turn/000')
  assert.match(issues[0].reason, /touches/)
})

test('effect groups are exempt only from the rule their effect breaks (05c hero cut)', () => {
  const edge = { minX: 0, minY: 0, maxX: 30, maxY: 43 }
  const tiny = { minX: 10, minY: 30, maxX: 20, maxY: 43 }
  assert.equal(auditFrameAlphaBox('player_main/slash_ground_n/001', edge, 48, 48), null, 'a raised blade may reach the top edge')
  assert.equal(auditFrameAlphaBox('player_main/respawn/000', edge, 48, 48), null)
  assert.equal(auditFrameAlphaBox('player_main/death/003', tiny, 48, 48), null, 'the last death frame is fragments')
  assert.match(auditFrameAlphaBox('player_main/idle/000', edge, 48, 48)?.reason ?? '', /cell edge/)
  assert.match(auditFrameAlphaBox('player_main/slash_ground_n/001', tiny, 48, 48)?.reason ?? '', /under 22px/, 'slash frames still need a body')
  assert.match(auditFrameAlphaBox('player_main/run/000', tiny, 48, 48)?.reason ?? '', /under 22px/)
})

