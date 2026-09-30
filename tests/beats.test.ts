// Part 12i, EVAL-P8-004: the beats' pure rules (READY, stage results, the weapon-get view, low HP, the campaign record).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  READY_MS,
  RESPAWN_READY_MS,
  ReadyBlink,
  STAGE_CARD_MS,
  StageIntroSequence,
  readyLit
} from '../src/scenes/game/StageIntroSequence'
import {
  RESULTS_HOLD_MS,
  clearRewardItemId,
  computeStageResults,
  formatStageTime,
  stageEntrySnapshot,
  stageSecretLocationIds
} from '../src/ui/beats/stageResults'
import { LOW_HP_BEEP_MS, LOW_HP_MIN_ALPHA, LOW_HP_PULSE_MS, LowHpPulse, isLowHp, lowHpPulseAlpha } from '../src/ui/beats/lowHp'
import {
  CREDITS_MIN_LINE_MS,
  campaignRank,
  campaignRecordRows,
  creditsLineOnScreenMs,
  creditsMsPerPx
} from '../src/ui/beats/campaignRecord'
import { WEAPON_SWITCH_HINT, buildWeaponGetView, rosterTutorialLine } from '../src/ui/beats/weaponGet'
import { BOSS_ROSTER } from '../src/bosses/roster'
import { createFreshProgressionState } from '../src/progression/state'

/** Blinks: rising edges of `lit` sampled every millisecond across `durationMs`. */
function countBlinks(lit: (elapsedMs: number) => boolean, durationMs: number): number {
  let edges = 0
  let previous = false
  for (let ms = 0; ms < durationMs; ms += 1) {
    const now = lit(ms)
    if (now && !previous) edges += 1
    previous = now
  }
  return edges
}

test('12i READY: three blinks over 1.2 s after the card, then control; 600 ms on a respawn', () => {
  assert.equal(READY_MS, 1200)
  assert.equal(RESPAWN_READY_MS, 600)
  assert.equal(countBlinks((ms) => readyLit(ms, READY_MS), READY_MS), 3)
  assert.equal(countBlinks((ms) => readyLit(ms, RESPAWN_READY_MS), RESPAWN_READY_MS), 3)
  assert.equal(readyLit(0, READY_MS), true, 'lit on its first frame')
  assert.equal(readyLit(READY_MS, READY_MS), false, 'dark once over')

  const intro = new StageIntroSequence()
  assert.equal(intro.start({ card: true, briefing: false, ready: true }).phase, 'card')
  assert.equal(intro.tick(STAGE_CARD_MS), true)
  assert.equal(intro.snapshot().phase, 'ready')
  assert.equal(intro.snapshot().readyVisible, true)
  assert.equal(intro.isActive(), true, 'READY holds control')
  assert.equal(intro.advance(), false, 'confirm does not cut READY short')
  assert.equal(intro.tick(READY_MS - 1), false)
  assert.equal(intro.tick(1), true)
  assert.equal(intro.snapshot().phase, 'done')

  const briefed = new StageIntroSequence()
  briefed.start({ card: true, briefing: true, ready: true })
  assert.equal(briefed.advance(), true, 'confirm ends the card early')
  assert.equal(briefed.snapshot().phase, 'briefing')
  assert.equal(briefed.briefingComplete(), true)
  assert.equal(briefed.snapshot().phase, 'ready', 'READY follows the briefing')
  assert.equal(briefed.skip(), true, 'the pause key skips READY too')
  assert.equal(briefed.snapshot().phase, 'done')

  const respawn = new ReadyBlink()
  respawn.start(RESPAWN_READY_MS)
  assert.equal(respawn.lit(), true)
  respawn.tick(RESPAWN_READY_MS)
  assert.equal(respawn.isActive(), false)
  assert.equal(respawn.remainingMs(), 0)
})

test('12i results: time, secrets as the entry-to-clear delta of the stage tank checks, lives used, difficulty', () => {
  assert.deepEqual(stageSecretLocationIds('pyro_maw').sort(), ['pyro_maw:heart_tank', 'pyro_maw:sub_tank'])
  assert.deepEqual(stageSecretLocationIds('tutorial_sentinel'), [])
  assert.equal(formatStageTime(252_530), '04:12.53')
  assert.equal(formatStageTime(-5), '00:00.00')
  assert.equal(formatStageTime(4_502_400), '75:02.40')
  assert.ok(RESULTS_HOLD_MS >= 3000 && RESULTS_HOLD_MS <= 6000)

  const entry = stageEntrySnapshot({ collectedChecks: ['pyro_maw:sub_tank', 'tide_reaver:heart_tank'], stats: { deaths: 4 } })
  const results = computeStageResults({
    stageId: 'pyro_maw',
    entry,
    clear: { collectedChecks: [...entry.collectedChecks, 'pyro_maw:heart_tank', 'pyro_maw:boss_clear'], stats: { deaths: 6 }, difficulty: 'veteran' },
    elapsedMs: 252_530.4
  })
  assert.deepEqual(results, {
    stageId: 'pyro_maw', timeMs: 252_530, timeLabel: '04:12.53', secretsFound: 1, secretsTotal: 2, livesUsed: 2, difficulty: 'VETERAN'
  })
  const none = computeStageResults({ stageId: 'pyro_maw', entry, clear: { collectedChecks: entry.collectedChecks, stats: { deaths: 4 } }, elapsedMs: 1000 })
  assert.equal(none.secretsFound, 0, 'a tank collected before entry is not found again')
  assert.equal(none.livesUsed, 0)
  assert.equal(none.difficulty, 'NORMAL')
})

test('12i weapon-get: the boss-clear placement on a first clear only; the card names the weapon, its energy and the switch keys', () => {
  const classic = createFreshProgressionState('classic', 'classic')
  const before = { collectedChecks: [] as string[], progressionWorld: classic.progressionWorld }
  const after = { collectedChecks: ['pyro_maw:boss_clear'], progressionWorld: classic.progressionWorld }
  assert.equal(clearRewardItemId(before, after, 'pyro_maw:boss_clear'), 'FlameSerpent', 'Classic gives the stage weapon')
  assert.equal(clearRewardItemId(after, after, 'pyro_maw:boss_clear'), null, 'a replayed clear gains nothing')
  const randomized = { collectedChecks: [], progressionWorld: { placements: { 'pyro_maw:boss_clear': 'heart_tank' } } }
  assert.equal(clearRewardItemId({ collectedChecks: [] }, randomized, 'pyro_maw:boss_clear'), 'heart_tank', 'the randomizer gives its placement')

  const registry = { sequenceId: 'pyro_maw_weapon_get', speakerId: 'director_iona', speakerName: 'Director Iona Vale', text: 'Registered.' }
  const card = { weaponId: 'FlameSerpent', weaponName: 'Flame Serpent', sourceStageId: 'pyro_maw' as const, registry }
  const weapon = buildWeaponGetView('FlameSerpent', { card, storyOn: true })
  assert.equal(weapon.kind, 'weapon')
  assert.equal(weapon.title, 'WEAPON GET')
  assert.equal(weapon.name, 'FLAME SERPENT')
  assert.equal(weapon.energy, BOSS_ROSTER.pyro_maw.weaponReward?.maxEnergy)
  assert.equal(weapon.switchHint, WEAPON_SWITCH_HINT)
  assert.equal(WEAPON_SWITCH_HINT, 'Q / E TO SWITCH')
  assert.equal(weapon.tutorial, BOSS_ROSTER.pyro_maw.weaponReward?.tutorial)
  assert.deepEqual(weapon.registry, { sequenceId: 'pyro_maw_weapon_get', speakerName: 'Director Iona Vale', text: 'Registered.' })
  assert.equal(buildWeaponGetView('FlameSerpent', { card, storyOn: false }).registry, null, "Iona's line is story, off with it")

  const tank = buildWeaponGetView('heart_tank')
  assert.deepEqual([tank.kind, tank.title, tank.name, tank.energy, tank.switchHint], ['item', 'ITEM GET', 'HEART TANK', null, null])
  const slash = buildWeaponGetView('arc_slash')
  assert.equal(slash.kind, 'item', 'the tutorial technique is an upgrade, not a switchable weapon')
  assert.equal(slash.tutorial, rosterTutorialLine('ArcSlash'))
  assert.ok(slash.tutorial)
})

test('12i low HP: at or under 25% the bar pulses and beeps every 1.5 s of live time; Reduced Flashing turns both off', () => {
  assert.equal(isLowHp(7, 28), true, '25% exactly')
  assert.equal(isLowHp(8, 28), false)
  assert.equal(isLowHp(0, 28), false, 'dead is not low')
  assert.equal(lowHpPulseAlpha(0), 1)
  assert.ok(Math.abs(lowHpPulseAlpha(LOW_HP_PULSE_MS / 2) - LOW_HP_MIN_ALPHA) < 1e-9)

  const pulse = new LowHpPulse()
  const live = { current: 5, max: 28, live: true, reducedFlashing: false }
  const beepsAt: number[] = []
  let elapsed = 0
  let minAlpha = 1
  for (let frame = 0; frame < 190; frame += 1) {
    const out = pulse.tick(1000 / 60, live)
    elapsed += 1000 / 60
    minAlpha = Math.min(minAlpha, out.alpha)
    if (out.beep) beepsAt.push(Math.round(elapsed))
  }
  assert.equal(beepsAt.length, 3, `beeps at ${beepsAt.join(', ')}`)
  assert.ok(Math.abs(beepsAt[1] - beepsAt[0] - LOW_HP_BEEP_MS) <= 17 && Math.abs(beepsAt[2] - beepsAt[1] - LOW_HP_BEEP_MS) <= 17)
  assert.ok(minAlpha < 0.5, 'the bar dims')

  const held = pulse.snapshot()
  const paused = pulse.tick(5000, { ...live, live: false })
  assert.deepEqual(paused, { active: true, alpha: 1, beep: false }, 'paused: solid bar, no beep')
  assert.equal(pulse.snapshot().elapsedMs, held.elapsedMs, 'the clock holds')

  const reduced = new LowHpPulse()
  for (let frame = 0; frame < 120; frame += 1) {
    const out = reduced.tick(1000 / 60, { ...live, reducedFlashing: true })
    assert.deepEqual(out, { active: false, alpha: 1, beep: false })
  }
  assert.equal(reduced.snapshot().beeps, 0)
  assert.deepEqual(pulse.tick(16, { ...live, current: 20 }), { active: false, alpha: 1, beep: false }, 'healed: off')
})

test('12i campaign record: the rows from the save, the rank rule, credits slow enough for 2.5 s a line', () => {
  assert.equal(campaignRank({ deaths: 0 }), 'FLAWLESS')
  assert.equal(campaignRank({ deaths: 9 }), 'STEADY')
  assert.equal(campaignRank({ deaths: 10 }), 'RELENTLESS')
  const rows = campaignRecordRows({
    stats: { playTimeMs: 3 * 3600_000 + 7 * 60_000 + 59_000, deaths: 3 },
    heartTanks: 8,
    subTanks: 4,
    upgradeUnlocks: ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs', 'chip_quick_charge', 'chip_speedster', 'chip_weapon_plus', 'chip_buster_plus', 'arc_slash'],
    difficulty: 'normal'
  })
  assert.deepEqual(rows.map((row) => `${row.label} ${row.value}`), [
    'PLAY TIME 3H 07M', 'HEARTS 8/8', 'SUB TANKS 4/4', 'CAPSULES 8/8', 'DEATHS 3', 'DIFFICULTY NORMAL', 'RANK STEADY'
  ])
  for (const [span, line] of [[228, 14], [120, 14], [40, 14], [14, 14]]) {
    const pace = creditsMsPerPx(span, line)
    assert.ok(creditsLineOnScreenMs(span, line, pace) >= CREDITS_MIN_LINE_MS || span - line <= 0, `${span}px band`)
  }
  assert.ok(creditsLineOnScreenMs(228, 14, creditsMsPerPx(228, 14)) >= CREDITS_MIN_LINE_MS)
  assert.ok(creditsMsPerPx(40, 14) > creditsMsPerPx(228, 14), 'a short band slows the scroll')
})
