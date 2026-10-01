import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMPAIGN_STAGES } from '../src/content/campaign.ts'
import {
  backdropCoverageTop,
  backdropLayerSpans,
  bandWorldRows,
  blendOpaqueColor,
  cameraScrollRange,
  hudMaskBand,
  stageVerticalTop
} from '../src/stage/stageGeometry.ts'
import { initialCameraFollowState, snapScrollToGamePixel, stepCameraFollow } from '../src/scenes/game/cameraFollow.ts'
import { verticalSegmentRoom } from '../src/mechanics/roomLock.ts'
import { GAMEPLAY_VIEWPORT_TOP } from '../src/config/gameplayLayout.ts'
import { GAME_HEIGHT, GAME_WIDTH } from '../src/config/renderPolicy.ts'

// 13b.2 (EVAL-P13-003): "graphics disappear at the top of the stage" was a gap between each parallax
// layer's upward copy and its first-screen copy. For every campaign stage (tutorial included, now that
// its wall-kick shaft has a verticalSegments entry), every background layer's tiled spans must reach at
// least as high as the camera can scroll, with no gap between the two copies.
test('every stage backdrop layer covers the camera\'s full vertical bounds', () => {
  for (const [stageId, stage] of Object.entries(CAMPAIGN_STAGES)) {
    const top = stageVerticalTop(stage.arena, GAME_HEIGHT)
    const layers = stage.arena.background?.layers ?? []
    for (const layer of layers) {
      const spans = backdropLayerSpans(layer.y, top, GAME_HEIGHT, GAMEPLAY_VIEWPORT_TOP)
      assert.ok(
        backdropCoverageTop(spans) <= top,
        `${stageId} layer '${layer.key}': spans reach ${backdropCoverageTop(spans)}, camera can scroll to ${top}`
      )
      if (top < 0) {
        const upward = spans.find((span) => span.y === top)
        assert.ok(upward, `${stageId} layer '${layer.key}': missing its upward copy`)
        const joinY = upward.y + upward.height
        const firstScreenTop = Math.min(layer.y, GAMEPLAY_VIEWPORT_TOP)
        assert.equal(
          joinY,
          firstScreenTop,
          `${stageId} layer '${layer.key}': upward copy ends at ${joinY}, first-screen copy starts at ${firstScreenTop}`
        )
      }
    }
  }
})

test('the tutorial wall-kick shaft is wired into stageVerticalTop', () => {
  const top = stageVerticalTop(CAMPAIGN_STAGES.tutorial_sentinel.arena, GAME_HEIGHT)
  assert.equal(top, -252, 'the tutorial shaft is a 2-screen verticalSegments room, so the world top is -252')
})

// EVAL-P13-003 fix: StageBackdrop.drawBand pre-blends its fill instead of a live alpha fill, so the
// strip under the HUD (now covered once a tall room's upward band joins at the viewport top) renders
// the same opaque bytes on every renderer, matching between 1x and 2x (40-hd-render).
test('blendOpaqueColor composites like a live alpha fill, opaquely', () => {
  assert.equal(blendOpaqueColor(0x000000, 0xffffff, 0), 0x000000, 'alpha 0 is pure base')
  assert.equal(blendOpaqueColor(0x000000, 0xffffff, 1), 0xffffff, 'alpha 1 is pure overlay')
  assert.equal(blendOpaqueColor(0x102030, 0x4a8cff, 0.1), 0x162b45, '10% overlay rounds per channel')
})

// Final fixes (2026-10-01), "the screen disappears when jumping": the strip under the HUD was painted in
// world rows 0 to 58, so any camera scroll above 0 (a jump in a tall room scrolls ~20px; a climb up to
// 252) slid a flat, layer-less band down the playfield. The reachable camera range must show only
// backdrop the stage drew, and the HUD strip must be screen-fixed so it never lands in the playfield.
test('the HUD mask is screen-fixed and exactly the HUD band wide and tall', () => {
  const band = hudMaskBand(GAME_WIDTH, GAMEPLAY_VIEWPORT_TOP)
  assert.equal(band.scrollFactor, 0, 'a world-space strip slides through the playfield once the camera scrolls up')
  assert.equal(band.y, 0)
  assert.equal(band.height, GAMEPLAY_VIEWPORT_TOP)
  assert.ok(band.x <= 0 && band.x + band.width >= GAME_WIDTH, 'covers the whole view, with margin for a shake')
})

test('at every camera scroll the playfield is covered by the backdrop and never by the HUD mask', () => {
  const band = hudMaskBand(GAME_WIDTH, GAMEPLAY_VIEWPORT_TOP)
  for (const [stageId, stage] of Object.entries(CAMPAIGN_STAGES)) {
    const top = stageVerticalTop(stage.arena, GAME_HEIGHT)
    const range = cameraScrollRange(top)
    const layers = stage.arena.background?.layers ?? []
    for (let scrollY = range.min; scrollY <= range.max; scrollY += 1) {
      const playTop = scrollY + GAMEPLAY_VIEWPORT_TOP
      const playBottom = scrollY + GAME_HEIGHT
      assert.ok(scrollY >= top && playBottom <= GAME_HEIGHT, `${stageId}: scroll ${scrollY} shows rows past the drawn backdrop [${top}, ${GAME_HEIGHT}]`)
      const hidden = bandWorldRows(band, scrollY)
      assert.ok(hidden.bottom <= playTop, `${stageId}: at scroll ${scrollY} the HUD mask hides world rows ${hidden.top}..${hidden.bottom}, into the playfield from ${playTop}`)
    }
    // Every layer keeps a copy above the first screen's, down to the camera's highest row (13b.2).
    for (const layer of layers) {
      const spans = backdropLayerSpans(layer.y, top, GAME_HEIGHT, GAMEPLAY_VIEWPORT_TOP)
      const covered = (row: number) => spans.some((span) => row >= span.y && row < span.y + span.height)
      for (let row = top; row < Math.min(layer.y, GAMEPLAY_VIEWPORT_TOP); row += 1) {
        assert.ok(covered(row), `${stageId} layer '${layer.key}': row ${row} above the first screen has no layer copy`)
      }
    }
  }
})

test('the camera follow never leaves the covered range through a jump, a dash-jump arc or a full climb', () => {
  const FRAME_MS = 1000 / 60
  for (const [stageId, stage] of Object.entries(CAMPAIGN_STAGES)) {
    const top = stageVerticalTop(stage.arena, GAME_HEIGHT)
    const range = cameraScrollRange(top)
    const rooms = [
      ...(stage.arena.verticalSegments ?? []).map((segment) => verticalSegmentRoom(segment, GAME_HEIGHT)),
      ...(stage.arena.roomLocks ?? []).map((lock) => lock.room)
    ].filter((room) => room.height > GAME_HEIGHT)
    for (const room of rooms) {
      // RoomLockAdapter.syncBounds: the camera holds the room at its full height.
      const bounds = { x: room.x, y: room.y, width: room.width, height: room.height }
      // Hero paths in the room, game px: a plain jump (floor to about 100 up and down), then a climb to the
      // raised ceiling (room top + 8 for the body) and back, the extremes of any dash-jump or wall kick.
      const floorY = GAME_HEIGHT - 38
      const paths = [
        (t: number) => floorY - 100 * Math.sin(Math.PI * Math.min(1, t / 40)),
        (t: number) => floorY - (floorY - (room.y + 8)) * Math.sin(Math.PI * Math.min(1, t / 240))
      ]
      for (const heroY of paths) {
        let state = initialCameraFollowState(room.x + room.width / 2, floorY, 1, room.x, 0, bounds)
        for (let frame = 0; frame <= 260; frame += 1) {
          state = stepCameraFollow(state, { heroX: room.x + room.width / 2, heroY: heroY(frame), facing: 1, dtMs: FRAME_MS, viewWidth: GAME_WIDTH, viewHeight: GAME_HEIGHT, bounds })
          const scrollY = snapScrollToGamePixel(state.scrollY, bounds.y, bounds.height, GAME_HEIGHT)
          assert.ok(scrollY >= range.min && scrollY <= range.max, `${stageId} room at ${room.x}: scroll ${scrollY} outside the covered range [${range.min}, ${range.max}] at frame ${frame}`)
        }
      }
    }
  }
})
