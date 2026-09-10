import test from 'node:test'
import assert from 'node:assert/strict'
import { getHudLayout, type HudRect } from '../src/ui/hudLayout'

function assertContained(inner: HudRect, outer: HudRect, minimumInset: number): void {
  assert.ok(inner.x >= outer.x + minimumInset)
  assert.ok(inner.y >= outer.y + minimumInset)
  assert.ok(inner.x + inner.width <= outer.x + outer.width - minimumInset)
  assert.ok(inner.y + inner.height <= outer.y + outer.height - minimumInset)
}

test('player meters are seated inside the HUD panel with frame clearance', () => {
  const layout = getHudLayout(448)

  assertContained(layout.playerBar, layout.playerPanel, 3)
  assertContained(layout.weaponBar, layout.playerPanel, 3)
  assert.ok(layout.weaponBar.y > layout.weaponLabel.y + 9)
})

test('boss meter mirrors the player meter inside the opposite panel', () => {
  const layout = getHudLayout(448)

  assertContained(layout.bossBar, layout.bossPanel, 3)
  assert.equal(layout.playerBar.width, layout.bossBar.width)
  assert.equal(layout.playerBar.height, layout.bossBar.height)
  assert.equal(layout.playerPanel.x + layout.playerPanel.width, 448 - layout.bossPanel.x)
})
