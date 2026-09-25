import test from 'node:test'
import assert from 'node:assert/strict'
import { DIALOGUE_CONTENT, DIALOGUE_REGISTRY, validateDialogueContent } from '../src/content/dialogue/index.ts'
import {
  buildWeaponGetCard,
  capsuleCacheStageId,
  gainedWeaponIds,
  gameOverLineIndex,
  hasAllCapsuleCaches,
  totalGameOvers,
  weaponSourceStageId
} from '../src/content/dialogue/storyTriggers.ts'
import { FINAL_STAGE_ID, ROBOT_MASTER_STAGE_IDS, TUTORIAL_STAGE_ID, getCampaignStage } from '../src/content/campaign.ts'
import { IDENTITY } from '../src/content/identity.ts'
import { getWeaponDisplayName } from '../src/content/weapons.ts'
import { generateProgressionWorld } from '../src/progression/seed.ts'

// Part 12g, prompt 07 section 7.6 B (EVAL-P7-009): the five new triggers, each with failing fixtures, coverage
// and the selection rules its consumer uses (capsule card, weapon-get card, game-over rotation, epilogue secret).

function cloneContent(): any {
  return JSON.parse(JSON.stringify(DIALOGUE_CONTENT))
}

function errorsOf(value: unknown): string[] {
  const result = validateDialogueContent(value)
  return result.valid ? [] : result.errors
}

function sequence(content: any, id: string): any {
  const found = content.sequences.find((entry: any) => entry.id === id)
  assert.ok(found, id)
  return found
}

function expectError(content: unknown, pattern: RegExp): void {
  const errors = errorsOf(content)
  assert.ok(errors.some((error) => pattern.test(error)), `expected ${pattern} in ${JSON.stringify(errors)}`)
}

const VALUES = { hero: 'WREN' }

test('shipped content: each new trigger is covered once, spoken by its owner', () => {
  assert.deepEqual(errorsOf(cloneContent()), [])
  for (const stageId of ROBOT_MASTER_STAGE_IDS) {
    const capsule = DIALOGUE_REGISTRY.getStageSequence(stageId, 'capsule_pickup')
    assert.deepEqual(capsule?.lines.map((line) => line.speakerId), [stageId], `${stageId} cache log`)
    const phase = DIALOGUE_REGISTRY.getStageSequence(stageId, 'warden_phase')
    assert.deepEqual(phase?.lines.map((line) => line.speakerId), ['omega_core'], `${stageId} phase two`)
    const intrusion = DIALOGUE_REGISTRY.getStageSequence(stageId, 'radio')?.lines.find((line) => line.speakerId === 'omega_core')
    assert.ok(intrusion && phase && phase.lines[0].text !== intrusion.text, `${stageId}: phase two is not the checkpoint intrusion replayed`)
    const registry = DIALOGUE_REGISTRY.getStageSequence(stageId, 'weapon_get')
    assert.deepEqual(registry?.lines.map((line) => line.speakerId), ['director_iona'], `${stageId} registry`)
    assert.ok(registry?.lines[0].text.startsWith(getWeaponDisplayName(getCampaignStage(stageId).rewardWeaponId!)), `${stageId} names its weapon first`)
  }
  for (const stageId of [TUTORIAL_STAGE_ID, FINAL_STAGE_ID]) {
    for (const trigger of ['capsule_pickup', 'weapon_get', 'warden_phase'] as const) {
      assert.equal(DIALOGUE_REGISTRY.getStageSequence(stageId, trigger), undefined, `${stageId} has no ${trigger}`)
    }
  }
  assert.deepEqual(DIALOGUE_REGISTRY.getGlobalSequence('game_over')?.lines.map((line) => line.speakerId), ['omega_core', 'director_iona', 'omega_core', 'omega_core'])
  const secret = DIALOGUE_REGISTRY.getGlobalSequence('epilogue_secret')
  assert.equal(secret?.lines[0].speakerId, undefined)
  assert.ok(secret?.lines[0].text.startsWith('Drill Hangar.'))
  assert.equal(secret?.lines[1].speakerId, 'director_iona')
  const ids = DIALOGUE_REGISTRY.getRequiredStoryIds()
  for (const id of ['pyro_maw_capsule', 'pyro_maw_phase_two', 'pyro_maw_weapon_get', 'game_over', 'epilogue_secret']) assert.ok(ids.includes(id), id)
})

test('validator: capsule_pickup is the stage warden\'s one recorded line, once per warden stage', () => {
  const wrongSpeaker = cloneContent()
  sequence(wrongSpeaker, 'tide_reaver_capsule').lines[0].speakerId = 'director_iona'
  expectError(wrongSpeaker, /must be spoken by tide_reaver \(the stage warden's recorded cache log\)/)
  const missing = cloneContent()
  missing.sequences = missing.sequences.filter((entry: any) => entry.id !== 'glacier_ronin_capsule')
  expectError(missing, /coverage glacier_ronin:capsule_pickup must appear exactly once \(found 0\)/)
  const tutorial = cloneContent()
  sequence(tutorial, 'pyro_maw_capsule').stageId = TUTORIAL_STAGE_ID
  expectError(tutorial, /stageId must be one of the stages capsule_pickup covers/)
  const twoLines = cloneContent()
  sequence(twoLines, 'volt_hopper_capsule').lines.push({ speakerId: 'volt_hopper', text: 'A second log.' })
  expectError(twoLines, /must contain 1 to 1 lines/)
  const otherWarden = cloneContent()
  sequence(otherWarden, 'pyro_maw_capsule').lines[0].text = 'Tide Reaver restocked this cache.'
  expectError(otherWarden, /names another warden \(Tide Reaver\)/)
})

test('validator: weapon_get is Iona naming the weapon its stage keys', () => {
  const wrongWeapon = cloneContent()
  sequence(wrongWeapon, 'pyro_maw_weapon_get').lines[0].text = 'Hydro Lance. Registered to you now.'
  expectError(wrongWeapon, /must name Flame Serpent, the weapon this registry entry is keyed to/)
  const wrongSpeaker = cloneContent()
  sequence(wrongSpeaker, 'ferro_blade_weapon_get').lines[0].speakerId = 'omega_core'
  expectError(wrongSpeaker, /must be spoken by director_iona \(the district registry\)/)
  const missing = cloneContent()
  missing.sequences = missing.sequences.filter((entry: any) => entry.id !== 'mire_wraith_weapon_get')
  expectError(missing, /coverage mire_wraith:weapon_get must appear exactly once \(found 0\)/)
})

test('validator: warden_phase is one OMEGA line per warden stage', () => {
  const wrongSpeaker = cloneContent()
  sequence(wrongSpeaker, 'gale_vixen_phase_two').lines[0].speakerId = 'gale_vixen'
  expectError(wrongSpeaker, /must be spoken by omega_core \(the phase-two intrusion\)/)
  const core = cloneContent()
  sequence(core, 'basalt_titan_phase_two').stageId = FINAL_STAGE_ID
  expectError(core, /stageId must be one of the stages warden_phase covers/)
  expectError(core, /coverage basalt_titan:warden_phase must appear exactly once \(found 0\)/)
})

test('validator: game_over is global, four lines, three OMEGA and one Iona, no warden named', () => {
  const three = cloneContent()
  sequence(three, 'game_over').lines.pop()
  expectError(three, /must contain 4 to 4 lines/)
  const mix = cloneContent()
  sequence(mix, 'game_over').lines[1].speakerId = 'omega_core'
  expectError(mix, /must be three omega_core lines and one director_iona line \(found 4 and 0\)/)
  const warden = cloneContent()
  sequence(warden, 'game_over').lines[0].text = 'Pyro Maw is still sealed, Unit 09.'
  expectError(warden, /names a warden \(Pyro Maw\); the game-over rotation plays in any stage/)
  const bound = cloneContent()
  sequence(bound, 'game_over').stageId = 'pyro_maw'
  expectError(bound, /stageId is not allowed on game_over/)
  const narration = cloneContent()
  delete sequence(narration, 'game_over').lines[2].speakerId
  expectError(narration, /must name a speaker/)
  const duplicate = cloneContent()
  duplicate.sequences.push({ ...sequence(duplicate, 'game_over'), id: 'game_over_again' })
  expectError(duplicate, /coverage game_over must appear exactly once \(found 2\)/)
})

test('validator: epilogue_secret is the Drill Hangar card, then Iona', () => {
  const spoken = cloneContent()
  sequence(spoken, 'epilogue_secret').lines[0].speakerId = 'director_iona'
  expectError(spoken, /lines\[0\] must be narration \(the Drill Hangar card\)/)
  const hero = cloneContent()
  sequence(hero, 'epilogue_secret').lines[1].speakerId = 'hero'
  expectError(hero, /lines\[1\] must be spoken by director_iona/)
  const card = cloneContent()
  sequence(card, 'epilogue_secret').lines[0].card = 'pyro_maw'
  expectError(card, /may not carry a district card/)
  const missing = cloneContent()
  missing.sequences = missing.sequences.filter((entry: any) => entry.id !== 'epilogue_secret')
  expectError(missing, /coverage epilogue_secret must appear exactly once \(found 0\)/)
})

test('selection: capsule caches, weapon sources, gained weapons and the secret condition', () => {
  assert.equal(capsuleCacheStageId('pyro_maw:capsule'), 'pyro_maw')
  assert.equal(capsuleCacheStageId('glacier_ronin:capsule'), 'glacier_ronin')
  assert.equal(capsuleCacheStageId(`${TUTORIAL_STAGE_ID}:capsule`), null, 'the tutorial capsule has no cache log')
  assert.equal(capsuleCacheStageId('pyro_maw:heart_tank'), null)
  assert.equal(capsuleCacheStageId(''), null)
  for (const stageId of ROBOT_MASTER_STAGE_IDS) assert.equal(weaponSourceStageId(getCampaignStage(stageId).rewardWeaponId!), stageId)
  assert.equal(weaponSourceStageId('Buster'), null)
  assert.equal(weaponSourceStageId('arc_slash'), null)
  assert.deepEqual(gainedWeaponIds(['FlameSerpent'], ['FlameSerpent', 'HydroLance', 'AcidGlob']), ['HydroLance', 'AcidGlob'])
  assert.deepEqual(gainedWeaponIds(['FlameSerpent'], ['FlameSerpent']), [])
  const caches = ROBOT_MASTER_STAGE_IDS.map((stageId) => `${stageId}:capsule`)
  assert.equal(hasAllCapsuleCaches(caches), true)
  assert.equal(hasAllCapsuleCaches([...caches.slice(1), `${TUTORIAL_STAGE_ID}:capsule`, 'pyro_maw:heart_tank']), false)
  assert.equal(hasAllCapsuleCaches([]), false)
})

test('selection: the game-over line rotates by the save\'s game-over count', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((count) => gameOverLineIndex(count, 4)), [0, 1, 2, 3, 0, 1])
  assert.equal(gameOverLineIndex(0, 4), 0)
  assert.equal(gameOverLineIndex(3, 0), -1)
  assert.equal(totalGameOvers({ pyro_maw: 2, tide_reaver: 1 }), 3)
  assert.equal(totalGameOvers(undefined), 0)
  const lines = DIALOGUE_REGISTRY.getGlobalSequence('game_over')!.lines
  // Two game overs in a row hear both voices.
  assert.equal(lines[gameOverLineIndex(1, lines.length)].speakerId, 'omega_core')
  assert.equal(lines[gameOverLineIndex(2, lines.length)].speakerId, 'director_iona')
})

test('weapon_get: a randomized placement reads its own weapon\'s registry line, not the stage that placed it', () => {
  let displaced = 0
  for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'omega-relay', 'W'.repeat(64)]) {
    const world = generateProgressionWorld(seed)
    for (const [locationId, itemId] of Object.entries(world.placements)) {
      const source = weaponSourceStageId(String(itemId))
      if (!source || locationId.startsWith(`${source}:`)) continue
      const card = buildWeaponGetCard(DIALOGUE_REGISTRY, String(itemId), VALUES)
      assert.equal(card.sourceStageId, source, `${seed} ${locationId}`)
      assert.equal(card.weaponName, getWeaponDisplayName(String(itemId)))
      assert.equal(card.registry?.sequenceId, `${source}_weapon_get`)
      assert.equal(card.registry?.speakerName, IDENTITY.OPERATOR_NAME)
      assert.ok(card.registry?.text.startsWith(card.weaponName), card.registry?.text)
      assert.doesNotMatch(card.registry?.text ?? '', /[{}]/)
      displaced += 1
    }
  }
  assert.ok(displaced > 0, 'a randomized seed places a weapon away from its source stage')
  const saber = buildWeaponGetCard(DIALOGUE_REGISTRY, 'arc_slash', VALUES)
  assert.equal(saber.sourceStageId, null)
  assert.equal(saber.registry, null)
  assert.match(buildWeaponGetCard(DIALOGUE_REGISTRY, 'HydroLance', VALUES).registry?.text ?? '', /reads WREN now/)
})
