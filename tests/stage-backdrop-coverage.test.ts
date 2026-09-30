import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMPAIGN_STAGES } from '../src/content/campaign.ts'
import { backdropCoverageTop, backdropLayerSpans, stageVerticalTop } from '../src/stage/stageGeometry.ts'
import { GAMEPLAY_VIEWPORT_TOP } from '../src/config/gameplayLayout.ts'
import { GAME_HEIGHT } from '../src/config/renderPolicy.ts'

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
