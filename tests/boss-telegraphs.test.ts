import test from 'node:test'
import assert from 'node:assert/strict'
import { getBossDefinitionById, validateBossDefinition } from '../src/boss/config/index'
import { toAttackPatternFromDefinition, toBossDefinition } from '../src/boss/framework/bossDefinitionMapper'
import { BOSS_ROSTER } from '../src/bosses/roster'
import {
  describeTelegraph,
  FAN_LINE_COUNT,
  planBossTelegraph,
  telegraphFrameIndex,
  WAVE_MARKER_COUNT,
  WAVE_MARKER_SPACING_PX,
  type TelegraphAttack,
  type TelegraphGeometry
} from '../src/boss/telegraphPlan'
import { telegraphFrame } from '../src/boss/telegraphArt'
import {
  bossHazardRingCount,
  bossHitFeedbackLabel,
  combatSourceForDamage,
  passiveRechargeTicks,
  scaleBossHitDamage,
  wrapWeaponIndex
} from '../src/scenes/game/combatRules'

// Boss at x 300 (body 280-320 tall from 200 to 240), facing west at a hero standing at x 180.
const geometry: TelegraphGeometry = {
  boss: { x: 300, top: 200, bottom: 240 },
  muzzle: { x: 288, y: 224 },
  facing: -1,
  hero: { x: 180, y: 228 },
  floorY: 240
}

const attack = (state: string, warningFx: TelegraphAttack['telegraph']['warningFx'], anchor: TelegraphAttack['telegraph']['anchor'] = 'self', kind?: string): TelegraphAttack => ({
  state: state as TelegraphAttack['state'],
  telegraph: { telegraphMs: 320, warningFx, anchor },
  kind
})

test('reticle telegraphs lock on the hero and follow it; without a hero they sit ahead of the boss', () => {
  const plan = planBossTelegraph(attack('shoot', 'reticle', 'projectile'), geometry)
  assert.deepEqual(plan.marks, [{ group: 'reticle', x: 180, y: 228, follow: 'hero' }])
  assert.equal(plan.lines.length, 0)
  const blind = planBossTelegraph(attack('shoot', 'reticle', 'target'), { ...geometry, hero: null })
  assert.deepEqual(blind.marks, [{ group: 'reticle', x: 236, y: 224, follow: 'none' }])
})

test('glow flashes over the boss for dashes and melee, and glows at the muzzle for shots and charges', () => {
  assert.deepEqual(planBossTelegraph(attack('dash', 'glow'), geometry).marks, [{ group: 'warning_flash', x: 300, y: 198, follow: 'boss' }])
  assert.equal(planBossTelegraph(attack('special', 'glow', 'self', 'melee'), geometry).marks[0].group, 'warning_flash')
  assert.deepEqual(planBossTelegraph(attack('shoot', 'glow'), geometry).marks, [{ group: 'charge_glow', x: 288, y: 224, follow: 'boss' }])
  assert.equal(planBossTelegraph(attack('jump', 'glow'), geometry).marks[0].group, 'charge_glow')
})

test('wave lays a row of floor markers: ahead of the boss for self anchors, centred on the hero for target anchors', () => {
  const ahead = planBossTelegraph(attack('jump', 'wave', 'self'), geometry)
  assert.equal(ahead.marks.length, WAVE_MARKER_COUNT)
  assert.deepEqual(ahead.marks.map((mark) => mark.x), [252, 204, 156])
  assert.ok(ahead.marks.every((mark) => mark.group === 'floor_marker' && mark.y === 240 && mark.follow === 'none'))
  const centred = planBossTelegraph(attack('summon', 'wave', 'target'), geometry)
  assert.deepEqual(centred.marks.map((mark) => mark.x), [180, 180 - WAVE_MARKER_SPACING_PX, 180 + WAVE_MARKER_SPACING_PX])
})

test('fan-lines glow at the muzzle and fan lines out along the facing, or at the hero for target anchors', () => {
  const along = planBossTelegraph(attack('shoot', 'fan-lines', 'self'), geometry)
  assert.equal(along.marks[0].group, 'charge_glow')
  assert.equal(along.lines.length, FAN_LINE_COUNT)
  assert.ok(along.lines.every((line) => line.x1 === 288 && line.y1 === 224 && line.x2 < line.x1), 'lines run west, the facing')
  const aimed = planBossTelegraph(attack('shoot', 'fan-lines', 'target'), { ...geometry, hero: { x: 180, y: 170 } })
  const middle = aimed.lines[1]
  const toHero = Math.atan2(170 - 224, 180 - 288)
  assert.ok(Math.abs(Math.atan2(middle.y2 - middle.y1, middle.x2 - middle.x1) - toHero) < 1e-9, 'the middle line points at the hero')
})

test('the four frames play once over the wind-up; describeTelegraph reports the drawn frame and time left', () => {
  assert.equal(telegraphFrameIndex(0, 320), 0)
  assert.equal(telegraphFrameIndex(79, 320), 0)
  assert.equal(telegraphFrameIndex(80, 320), 1)
  assert.equal(telegraphFrameIndex(250, 320), 3)
  assert.equal(telegraphFrameIndex(900, 320), 3)
  assert.equal(telegraphFrameIndex(-50, 320), 0)
  assert.equal(telegraphFrameIndex(0, 0), 3)
  const plan = planBossTelegraph(attack('shoot', 'reticle', 'target'), geometry)
  assert.deepEqual(describeTelegraph('Riptide Crash', plan, 170, { x: 180.4, y: 227.6 }), {
    attack: 'Riptide Crash',
    fx: 'reticle',
    anchor: 'target',
    group: 'reticle',
    frame: telegraphFrame('reticle', 2),
    x: 180,
    y: 228,
    remainingMs: 150,
    marks: 1,
    lines: 0
  })
})

test('every roster attack keeps its authored warningFx and anchor through the runtime definition (no glow fallback)', () => {
  let checked = 0
  Object.values(BOSS_ROSTER).forEach((blueprint) => {
    const definition = getBossDefinitionById(blueprint.id) ?? toBossDefinition(blueprint)
    blueprint.attacks.forEach((authored) => {
      const runtime = definition.attacks.find((entry) => entry.displayName === authored.name)
      assert.ok(runtime, `${blueprint.id}: ${authored.name} has a runtime attack`)
      const pattern = toAttackPatternFromDefinition(runtime)
      assert.equal(pattern.telegraph.warningFx, authored.telegraph.warningFx, `${blueprint.id}: ${authored.name} warningFx`)
      assert.equal(pattern.telegraph.anchor, authored.telegraph.anchor, `${blueprint.id}: ${authored.name} anchor`)
      assert.equal(pattern.telegraph.telegraphMs, authored.telegraph.telegraphMs)
      const plan = planBossTelegraph({ ...pattern, kind: runtime.type }, geometry)
      assert.ok(plan.marks.length >= 1, `${blueprint.id}: ${authored.name} draws a mark`)
      checked += 1
    })
  })
  assert.ok(checked >= 30, `checked ${checked} roster attacks`)
  const volt = getBossDefinitionById('volt_golem')!
  volt.attacks.forEach((entry) => assert.ok(toAttackPatternFromDefinition(entry).telegraph.warningFx))
})

test('an attack without an authored telegraph fails validation and never maps to a default', () => {
  const definition = structuredClone(getBossDefinitionById('pyro_maw')!)
  delete definition.attacks[0].telegraph
  assert.ok(validateBossDefinition(definition).some((error) => error.includes('telegraph')))
  assert.throws(() => toAttackPatternFromDefinition(definition.attacks[0]), /names no telegraph/)
})

test('extracted Game seams keep their rules: damage lanes, weapon wrap, passive recharge, boss hit scaling, hazard rings', () => {
  assert.equal(combatSourceForDamage('boss_projectile'), 'boss')
  assert.equal(combatSourceForDamage('enemy_contact'), 'enemy')
  assert.equal(combatSourceForDamage('hazard'), 'hazard')
  assert.equal(combatSourceForDamage('pit'), 'system')
  assert.equal(wrapWeaponIndex(0, -1, 3), 2)
  assert.equal(wrapWeaponIndex(2, 1, 3), 0)
  assert.equal(wrapWeaponIndex(1, 1, 3), 2)
  assert.deepEqual(passiveRechargeTicks(50, 100), { ticks: 0, remainderMs: 50 })
  assert.deepEqual(passiveRechargeTicks(250, 100), { ticks: 2, remainderMs: 50 })
  assert.deepEqual(passiveRechargeTicks(900, 100), { ticks: 4, remainderMs: 500 })
  assert.equal(scaleBossHitDamage(2, 1, 1.5), 5)
  assert.equal(scaleBossHitDamage(1, 0, 0.2), 1)
  assert.equal(bossHitFeedbackLabel(1.5), 'WEAKNESS HIT')
  assert.equal(bossHitFeedbackLabel(0.5), 'RESISTED HIT')
  assert.equal(bossHitFeedbackLabel(1), '')
  assert.equal(bossHitFeedbackLabel(0, 'BLOCKED'), 'BLOCKED')
  assert.equal(bossHazardRingCount(3, 0), 3)
  assert.equal(bossHazardRingCount(4, 3), 1)
  assert.equal(bossHazardRingCount(2, 5), 0)
})
