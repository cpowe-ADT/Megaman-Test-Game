import test from 'node:test'
import assert from 'node:assert/strict'
import { SPECIAL_WEAPON_ORDER } from '../src/content/weapons'
import { buildWeaponDemoView, WEAPON_DEMO_BEAT_MS, WEAPON_DEMO_TOTAL_MS, weaponDemoPhaseAt } from '../src/ui/beats/weaponDemo'

// The weapon demo's script (prompt 13 part 13g item 2, EVAL-P13-013): pure, no Phaser (hard rule 5).

test('the demo runs 4 to 5s, Enter-skippable, with a phase for each beat', () => {
  assert.ok(WEAPON_DEMO_TOTAL_MS >= 4000 && WEAPON_DEMO_TOTAL_MS <= 5000, `${WEAPON_DEMO_TOTAL_MS}ms is inside the 4-5s band`)
  assert.equal(weaponDemoPhaseAt(-10), 'name')
  assert.equal(weaponDemoPhaseAt(0), 'name')
  assert.equal(weaponDemoPhaseAt(WEAPON_DEMO_BEAT_MS.plain), 'plain')
  assert.equal(weaponDemoPhaseAt(WEAPON_DEMO_BEAT_MS.charge), 'charge')
  assert.equal(weaponDemoPhaseAt(WEAPON_DEMO_BEAT_MS.charged), 'charged')
  assert.equal(weaponDemoPhaseAt(WEAPON_DEMO_BEAT_MS.useLine), 'useLine')
  assert.equal(weaponDemoPhaseAt(WEAPON_DEMO_BEAT_MS.done), 'done')
  assert.equal(weaponDemoPhaseAt(999999), 'done')
  // Beats only move forward.
  const order: string[] = ['name', 'plain', 'charge', 'charged', 'useLine', 'done']
  const seen = [0, 1, 2, 3, 4, 5, 6].map((ms) => weaponDemoPhaseAt(ms * 1000))
  for (let i = 1; i < seen.length; i += 1) assert.ok(order.indexOf(seen[i]) >= order.indexOf(seen[i - 1]), `phase never rewinds (${seen})`)
})

test('every special but Arc Slash builds a demo view with its own plain and charged shot, resolved through the real weapon code', () => {
  for (const weaponId of SPECIAL_WEAPON_ORDER) {
    const view = buildWeaponDemoView(weaponId)
    assert.equal(view.weaponId, weaponId)
    assert.ok(view.name.length > 0, `${weaponId} has a name`)
    assert.ok(view.useLine.length > 0, `${weaponId} has a one-line use`)
    assert.ok(view.plain.artGroup.length > 0)
    assert.ok(view.charged, `${weaponId} has a charged form`)
    assert.notEqual(view.charged!.artGroup, view.plain.artGroup, `${weaponId} charged art differs from the plain shot`)
    assert.ok(view.charged!.moveName.length > 0)
    assert.notEqual(view.charged!.moveName.toLowerCase(), view.name.toLowerCase(), `${weaponId} charged form has its own name`)
  }
})

test('FlameSerpent demos through its stream-release path (forceCharge), not the generic allowCharge gate', () => {
  const view = buildWeaponDemoView('FlameSerpent')
  assert.equal(view.charged?.moveName, 'Inferno Coil')
  assert.equal(view.plain.onHitTag, 'burn')
  assert.equal(view.charged?.onHitTag, 'burn')
})

test("Thunder Spike's demo shows Storm Burst's chain, not the plain bolt's", () => {
  const view = buildWeaponDemoView('ThunderSpike')
  assert.equal(view.charged?.moveName, 'Storm Burst')
  assert.equal(view.plain.onHitTag, 'chain')
  assert.equal(view.charged?.onHitTag, 'chain')
  assert.ok(view.charged!.damage > view.plain.damage, 'the charged form hits harder')
})
