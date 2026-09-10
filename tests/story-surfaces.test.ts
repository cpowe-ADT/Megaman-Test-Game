import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { markStorySeen, sanitizeStoryFlags, shouldPlayStory } from '../src/narrative/storyFlags'
import { STAGE_CARD_MS, StageIntroSequence } from '../src/scenes/game/StageIntroSequence'
import { drinkSubTank, fillSubTankFromPickup, normalizeSubTankFill } from '../src/systems/subTanks'
import { SettingsStore, validateSettings } from '../src/systems/Settings'
import { BOSS_ROSTER } from '../src/bosses/roster'
import { BOSS_HUD_LABEL_MAX, bossHudLabel } from '../src/bosses/types'
import { buildCredits, OUTPUT_PATH, readSources, renderModule } from '../scripts/credits/build-credits.mjs'
import { resolveAutomationConfig } from '../src/config/automation'

test('story policy: seen flags skip unless replay is on; the automation switch disables everything', () => {
  assert.equal(shouldPlayStory([], 'prologue', { enabled: true, replay: false }), true)
  assert.equal(shouldPlayStory(['prologue'], 'prologue', { enabled: true, replay: false }), false)
  assert.equal(shouldPlayStory(['prologue'], 'prologue', { enabled: true, replay: true }), true)
  assert.equal(shouldPlayStory([], 'prologue', { enabled: false, replay: true }), false)
  assert.deepEqual(markStorySeen(['a'], 'b', 'a', ''), ['a', 'b'])
  assert.deepEqual(sanitizeStoryFlags(['a', 'zzz', 'a', 3], ['a', 'b']), ['a'])
  assert.deepEqual(sanitizeStoryFlags('nope', ['a']), [])
})

test('automation config reads the story switch', () => {
  assert.equal(resolveAutomationConfig({}, '?automation=1').storyIntro, true)
  assert.equal(resolveAutomationConfig({}, '?automation=1&storyIntro=off').storyIntro, false)
  assert.equal(resolveAutomationConfig({}, '?storyIntro=on').storyIntro, true)
  assert.equal(resolveAutomationConfig({}, '').storyIntro, true)
})

test('stage intro sequence: card then briefing then done; skip and advance converge', () => {
  const full = new StageIntroSequence()
  assert.equal(full.start({ card: true, briefing: true }).phase, 'card')
  assert.equal(full.tick(STAGE_CARD_MS - 1), false)
  assert.equal(full.tick(1), true)
  assert.equal(full.snapshot().phase, 'briefing')
  assert.equal(full.advance(), false, 'the overlay owns confirm during the briefing')
  assert.equal(full.briefingComplete(), true)
  assert.equal(full.snapshot().phase, 'done')
  assert.equal(full.isActive(), false)

  const cardOnly = new StageIntroSequence()
  cardOnly.start({ card: true, briefing: false })
  assert.equal(cardOnly.advance(), true)
  assert.equal(cardOnly.snapshot().phase, 'done')

  const skipped = new StageIntroSequence()
  skipped.start({ card: true, briefing: true })
  assert.equal(skipped.skip(), true)
  assert.equal(skipped.snapshot().phase, 'done')
  assert.equal(skipped.skip(), false)

  const none = new StageIntroSequence()
  assert.equal(none.start({ card: false, briefing: false }).phase, 'done')
})

test('sub tanks fill from surplus health and drink to their fill', () => {
  assert.deepEqual(normalizeSubTankFill([0.5, 2, -1, 'x'], 3), [0.5, 1, 0])
  const filled = fillSubTankFromPickup([1, 0.25, 0], 0.5)
  assert.deepEqual(filled, { fills: [1, 0.75, 0], stored: true })
  assert.deepEqual(fillSubTankFromPickup([1, 1], 0.5), { fills: [1, 1], stored: false })
  assert.deepEqual(drinkSubTank([1, 0.4], 1), { fills: [1, 0], restoredRatio: 0.4 })
  assert.deepEqual(drinkSubTank([0], 0), { fills: [0], restoredRatio: 0 })
})

test('settings validate volumes, booleans and preserve future keys', () => {
  const settings = validateSettings({ musicVolume: 14, sfxVolume: -2, screenShake: 'no', storyReplay: true, later: 'kept' })
  assert.equal(settings.musicVolume, 10)
  assert.equal(settings.sfxVolume, 0)
  assert.equal(settings.screenShake, true)
  assert.equal(settings.storyReplay, true)
  assert.equal(settings.later, 'kept')
  let saved = ''
  const store = new SettingsStore({ getItem: () => saved || null, setItem: (_k, v) => { saved = v } })
  let notified = 0
  store.onChange(() => { notified += 1 })
  store.update({ musicVolume: 3 })
  assert.equal(store.get().musicVolume, 3)
  assert.equal(notified, 1)
})

test('every boss attack and phase has a HUD label of at most twelve characters', () => {
  for (const boss of Object.values(BOSS_ROSTER)) {
    for (const attack of boss.attacks) assert.ok(bossHudLabel(attack).length <= BOSS_HUD_LABEL_MAX, `${boss.id} attack ${attack.name}`)
    for (const phase of boss.phases) assert.ok(bossHudLabel(phase).length <= BOSS_HUD_LABEL_MAX, `${boss.id} phase ${phase.name}`)
  }
  assert.equal(bossHudLabel({ name: 'Thermal Runaway', shortName: 'THERMAL' }), 'THERMAL')
})

test('src/content/credits.generated.ts is generated from the attribution files and is in sync', () => {
  const lines = buildCredits(readSources())
  assert.ok(lines.length >= 10)
  assert.ok(lines.some((line) => line.startsWith('Music: ')))
  assert.ok(lines.some((line) => line.startsWith('Art: ')))
  assert.equal(fs.readFileSync(OUTPUT_PATH, 'utf8'), renderModule(lines), 'run `npm run credits:build` and commit the result')
})
