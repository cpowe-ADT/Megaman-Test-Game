import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDistrictLabel, getHudLayout, type HudRect } from '../src/ui/hudLayout'

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

test('the lives readout sits in the HUD band under the boss panel, off the playfield', () => {
  const layout = getHudLayout(448)
  const label = layout.livesLabel
  assert.ok(label.y >= layout.bossPanel.y + layout.bossPanel.height + 2, 'below the boss panel')
  assert.ok(label.y + 12 <= layout.height, 'inside the 58px HUD band')
  assert.ok(label.x > 448 / 2, 'on the right, mirroring the weapon row')
})

test('the district label wraps to a second line only when the whole name does not fit one', () => {
  assert.equal(formatDistrictLabel('Drill Hangar'), 'DRILL\nHANGAR')
  assert.equal(formatDistrictLabel('Heat Works'), 'HEAT WORKS\n')
  assert.equal(formatDistrictLabel('Central Core'), 'CENTRAL\nCORE')
})

test('the district label always breaks into exactly two lines, matching the fixed label box', () => {
  for (const district of ['Drill Hangar', 'Heat Works', 'Medicine District', 'Central Core']) {
    assert.equal(formatDistrictLabel(district).split('\n').length, 2)
  }
})
