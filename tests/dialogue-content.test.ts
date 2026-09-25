import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  DIALOGUE_CONTENT,
  DIALOGUE_LINE_LIMITS,
  DIALOGUE_REGISTRY,
  ROBOT_MASTER_MILESTONE_COUNTS,
  STAGE_DIALOGUE_TRIGGERS,
  STAGE_TRIGGER_COVERAGE,
  createDialogueRegistry,
  resolveDialogueSequence,
  resolveDialogueText,
  validateDialogueContent
} from '../src/content/dialogue/index.ts'
import {
  FINAL_STAGE_ID,
  ROBOT_MASTER_STAGE_IDS,
  TUTORIAL_STAGE_ID
} from '../src/content/campaign.ts'
import { buildScript, readContent, SCRIPT_PATH, STAGE_ORDER } from '../scripts/story/build-script.mjs'

const ALL_NARRATIVE_STAGE_IDS = [TUTORIAL_STAGE_ID, ...ROBOT_MASTER_STAGE_IDS, FINAL_STAGE_ID] as const

function cloneContent(): any {
  return JSON.parse(JSON.stringify(DIALOGUE_CONTENT))
}

function errorsOf(value: unknown): string[] {
  const result = validateDialogueContent(value)
  return result.valid ? [] : result.errors
}

function findSequence(content: any, trigger: string, stageId?: string) {
  return content.sequences.find((s: any) => s.trigger === trigger && (stageId ? s.stageId === stageId : !s.stageId))
}

test('dialogue v2 covers the required trigger table exactly once per stage', () => {
  assert.equal(DIALOGUE_REGISTRY.getSpeakers().length, 12)
  for (const trigger of STAGE_DIALOGUE_TRIGGERS) {
    for (const stageId of STAGE_TRIGGER_COVERAGE[trigger]) {
      const sequence = DIALOGUE_REGISTRY.getStageSequence(stageId, trigger)
      assert.ok(sequence, `${stageId} must have ${trigger}`)
      const limits = DIALOGUE_LINE_LIMITS[trigger]
      assert.ok(sequence.lines.length >= limits.min && sequence.lines.length <= limits.max, `${sequence.id} line count`)
    }
  }
  assert.deepEqual(STAGE_TRIGGER_COVERAGE.stage_briefing, [...ALL_NARRATIVE_STAGE_IDS])
  assert.deepEqual(STAGE_TRIGGER_COVERAGE.miniboss_callout, [...ROBOT_MASTER_STAGE_IDS])
  assert.ok(DIALOGUE_REGISTRY.getGlobalSequence('prologue'))
  assert.ok(DIALOGUE_REGISTRY.getGlobalSequence('epilogue'))
  assert.ok(DIALOGUE_REGISTRY.getGlobalSequence('credits'))
  for (const phase of [1, 2, 3] as const) assert.ok(DIALOGUE_REGISTRY.getFinalePhase(phase), `finale phase ${phase}`)
  // 7.6 B (12g) adds three warden-stage triggers (capsule log, phase two, weapon registry) and two globals.
  assert.equal(DIALOGUE_REGISTRY.getSequences().length, 10 * 4 + 8 * 5 + 3 + 3 + 1 + 2)
  for (const stageId of ROBOT_MASTER_STAGE_IDS) {
    const defeat = DIALOGUE_REGISTRY.getStageSequence(stageId, 'boss_defeat')
    assert.ok(defeat?.lines.some((line) => line.text.includes('{rewardLabel}')), `${stageId} defeat acknowledges the reward`)
  }
  // Every stage the campaign defines is covered, and the script generator agrees on the order.
  assert.deepEqual([...ALL_NARRATIVE_STAGE_IDS], STAGE_ORDER)
})

test('dialogue milestones depend only on cleared-boss count, plus one first-weakness hint', () => {
  assert.deepEqual(DIALOGUE_REGISTRY.getMilestones().map((entry) => entry.clearedBossCount), [1, 4, 8])
  assert.deepEqual([...ROBOT_MASTER_MILESTONE_COUNTS], [1, 4, 8])
  assert.equal(DIALOGUE_REGISTRY.getMilestone(2), undefined)
  assert.equal(DIALOGUE_REGISTRY.getMilestone(8)?.id, 'robot_masters_cleared_8')
  assert.equal(DIALOGUE_REGISTRY.getFirstWeaknessMilestone()?.id, 'first_weakness')
  const ids = DIALOGUE_REGISTRY.getRequiredStoryIds()
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.includes('prologue') && ids.includes('first_weakness') && ids.includes('finale_phase_3'))
})

test('story rules hold in the shipped content', () => {
  // Iona's turn is at milestone 4 and WREN gets its one line in the Core.
  const four = DIALOGUE_REGISTRY.getMilestone(4)
  assert.ok(four?.lines.some((line) => line.speakerId === 'director_iona' && /I wrote the layer/.test(line.text)))
  const phase3 = DIALOGUE_REGISTRY.getFinalePhase(3)
  assert.ok(phase3?.lines.some((line) => line.speakerId === 'hero'))
  // The last line of the game is fixed.
  const epilogue = DIALOGUE_REGISTRY.getGlobalSequence('epilogue')
  assert.equal(epilogue?.lines.at(-1)?.text, 'Then we leave it a choice.')
  assert.equal(epilogue?.lines.filter((line) => line.card).length, 8)
  // OMEGA is present in every warden stage's radio.
  for (const stageId of ROBOT_MASTER_STAGE_IDS) {
    const radio = DIALOGUE_REGISTRY.getStageSequence(stageId, 'radio')
    assert.ok(radio?.lines.some((line) => line.speakerId === 'omega_core'), `${stageId} radio has an OMEGA intrusion`)
  }
})

test('dialogue interpolation resolves every supported token and rejects the rest', () => {
  const template = '{hero} in {districtName} with {wardenName}: {rewardLabel}, {clearedCount}/{remainingCount}.'
  assert.equal(
    resolveDialogueText(template, { hero: 'Aster', districtName: 'Heat Works', wardenName: 'PYRO MAW', rewardLabel: 'Flame Serpent', clearedCount: 4, remainingCount: 4 }),
    'Aster in Heat Works with PYRO MAW: Flame Serpent, 4/4.'
  )
  const defeat = DIALOGUE_REGISTRY.getStageSequence('pyro_maw', 'boss_defeat')
  assert.ok(defeat)
  const resolved = resolveDialogueSequence(defeat, { hero: 'Aster', rewardLabel: 'Flame Serpent' })
  assert.equal(resolved.lines.some((line) => line.text.includes('Flame Serpent')), true)
  assert.notEqual(resolved, defeat)
  assert.throws(() => resolveDialogueText('Hold {rewardLabel}, {hero}.', { hero: 'Aster' }), /rewardLabel/)
  assert.throws(() => resolveDialogueText('Unknown {bossName}.', { hero: 'Aster' }), /bossName/)
})

test('validator: missing required sequence, wrong stage set, and duplicate global', () => {
  const missing = cloneContent()
  missing.sequences = missing.sequences.filter((s: any) => s.id !== 'pyro_maw_briefing')
  assert.ok(errorsOf(missing).some((e) => e.includes('pyro_maw:stage_briefing')))

  const wrongSet = cloneContent()
  findSequence(wrongSet, 'miniboss_callout', 'pyro_maw').stageId = 'tutorial_sentinel'
  assert.ok(errorsOf(wrongSet).some((e) => e.includes('stages miniboss_callout covers')))

  const duplicate = cloneContent()
  duplicate.sequences.push({ ...findSequence(duplicate, 'prologue'), id: 'prologue_2' })
  assert.ok(errorsOf(duplicate).some((e) => e.includes('prologue must appear exactly once')))
})

test('validator: line length, unknown token, line-count limits, and staging length', () => {
  const long = cloneContent()
  findSequence(long, 'radio', 'pyro_maw').lines[0].text = 'x'.repeat(181)
  assert.ok(errorsOf(long).some((e) => e.includes('1 to 180 characters')))

  const token = cloneContent()
  findSequence(token, 'radio', 'pyro_maw').lines[0].text = 'Wake {bossName}.'
  assert.ok(errorsOf(token).some((e) => e.includes('bossName')))

  const tooMany = cloneContent()
  const callout = findSequence(tooMany, 'miniboss_callout', 'pyro_maw')
  callout.lines.push({ ...callout.lines[0] })
  assert.ok(errorsOf(tooMany).some((e) => e.includes('1 to 1 lines')))

  const staging = cloneContent()
  findSequence(staging, 'prologue').staging = 'x'.repeat(241)
  assert.ok(errorsOf(staging).some((e) => e.includes('staging')))
})

test('validator: a warden line naming another warden breaks order independence', () => {
  const crossed = cloneContent()
  findSequence(crossed, 'boss_intro', 'pyro_maw').lines[0].text = 'Tide Reaver already fell. You are next.'
  assert.ok(errorsOf(crossed).some((e) => e.includes('names another warden (Tide Reaver)')))

  const own = cloneContent()
  findSequence(own, 'boss_intro', 'pyro_maw').lines[0].text = 'Pyro Maw does not yield.'
  assert.equal(errorsOf(own).some((e) => e.includes('names another warden')), false)

  const fortress = cloneContent()
  findSequence(fortress, 'boss_intro', FINAL_STAGE_ID).lines[0].text = 'Pyro Maw and Tide Reaver are copies now.'
  assert.equal(errorsOf(fortress).some((e) => e.includes('names another warden')), false)

  const milestone = cloneContent()
  milestone.milestones[0].lines[0].text = 'Pyro Maw is free.'
  assert.ok(errorsOf(milestone).some((e) => e.includes('milestones must stay order-independent')))
})

test('validator: defeat lines acknowledge rewards but never perform them', () => {
  for (const verb of ['grant', 'unlocks', 'received']) {
    const content = cloneContent()
    findSequence(content, 'boss_defeat', 'pyro_maw').lines[1].text = `I ${verb} you {rewardLabel}.`
    assert.ok(errorsOf(content).some((e) => e.includes('performs a reward')), verb)
  }
})

test('validator: finale phases, epilogue cards, narration, and stageId placement', () => {
  const phase = cloneContent()
  findSequence(phase, 'finale_phase').phase = 3
  const phaseErrors = errorsOf(phase)
  assert.ok(phaseErrors.some((e) => e.includes('finale_phase 3 must appear exactly once')))
  assert.ok(phaseErrors.some((e) => e.includes('finale_phase 1 must appear exactly once')))

  const cards = cloneContent()
  findSequence(cards, 'epilogue').lines[0].card = 'tide_reaver'
  assert.ok(errorsOf(cards).some((e) => e.includes('district card pyro_maw exactly once')))

  const narration = cloneContent()
  delete findSequence(narration, 'boss_intro', 'pyro_maw').lines[0].speakerId
  assert.ok(errorsOf(narration).some((e) => e.includes('must name a speaker')))

  const stageOnGlobal = cloneContent()
  findSequence(stageOnGlobal, 'prologue').stageId = 'pyro_maw'
  assert.ok(errorsOf(stageOnGlobal).some((e) => e.includes('stageId is not allowed on prologue')))

  const cardElsewhere = cloneContent()
  findSequence(cardElsewhere, 'boss_intro', 'pyro_maw').lines[0].card = 'pyro_maw'
  assert.ok(errorsOf(cardElsewhere).some((e) => e.includes('may not carry a district card')))
})

test('validator: tutorial_coach is Rook only, tutorial only, one line per lock, exactly once', () => {
  const coachOf = (content: any) => content.sequences.find((sequence: any) => sequence.trigger === 'tutorial_coach')
  assert.equal(coachOf(cloneContent())?.stageId, TUTORIAL_STAGE_ID)
  assert.equal(coachOf(cloneContent())?.lines.length, 5, 'one recorded prompt per teach lock')

  const wrongSpeaker = cloneContent()
  coachOf(wrongSpeaker).lines[2].speakerId = 'director_iona'
  assert.ok(errorsOf(wrongSpeaker).some((error) => /lines\[2\] must be spoken by sentinel_rook/.test(error)))

  const wrongStage = cloneContent()
  coachOf(wrongStage).stageId = 'pyro_maw'
  const stageErrors = errorsOf(wrongStage)
  assert.ok(stageErrors.some((error) => /stageId must be one of the stages tutorial_coach covers/.test(error)))
  assert.ok(stageErrors.some((error) => /coverage tutorial_sentinel:tutorial_coach must appear exactly once/.test(error)))

  const tooShort = cloneContent()
  coachOf(tooShort).lines = coachOf(tooShort).lines.slice(0, 3)
  assert.ok(errorsOf(tooShort).some((error) => /must contain 5 to 5 lines/.test(error)), 'the line bound is the tutorial lock count')

  const fourLines = cloneContent()
  coachOf(fourLines).lines = coachOf(fourLines).lines.slice(0, 4)
  assert.ok(errorsOf(fourLines).some((error) => /must contain 5 to 5 lines/.test(error)))
  const sixLines = cloneContent()
  coachOf(sixLines).lines.push({ ...coachOf(sixLines).lines[4] })
  assert.ok(errorsOf(sixLines).some((error) => /must contain 5 to 5 lines/.test(error)), 'a sixth line that never plays is refused')

  const swapped = cloneContent()
  const [first, second] = coachOf(swapped).lines
  coachOf(swapped).lines[0] = second
  coachOf(swapped).lines[1] = first
  assert.ok(errorsOf(swapped).some((error) => /lines\[0\]\.lock must be jump/.test(error)))
  assert.deepEqual(coachOf(cloneContent()).lines.map((line: any) => line.lock), ['jump', 'dash', 'wall_jump', 'charge', 'saber'])

  const strayLock = cloneContent()
  strayLock.sequences.find((sequence: any) => sequence.trigger === 'radio').lines[0].lock = 'dash'
  assert.ok(errorsOf(strayLock).some((error) => /lock belongs only to tutorial_coach/.test(error)))

  const duplicated = cloneContent()
  duplicated.sequences.push({ ...coachOf(duplicated), id: 'tutorial_sentinel_coach_copy' })
  assert.ok(errorsOf(duplicated).some((error) => /coverage tutorial_sentinel:tutorial_coach must appear exactly once \(found 2\)/.test(error)))
})

test('validator: milestone kinds, counts, and speakers', () => {
  const noWeakness = cloneContent()
  noWeakness.milestones = noWeakness.milestones.filter((m: any) => m.kind !== 'first_weakness')
  assert.ok(errorsOf(noWeakness).some((e) => e.includes('first_weakness must appear exactly once')))

  const drift = cloneContent()
  drift.milestones.find((m: any) => m.clearedBossCount === 4).clearedBossCount = 2
  const driftErrors = errorsOf(drift)
  assert.ok(driftErrors.some((e) => e.includes('1, 4, or 8')))
  assert.ok(driftErrors.some((e) => e.includes('once each')))

  // Flipped in 12g (7.6 B.12): OMEGA answers Iona once at the fourth milestone, so it is order-independent; a warden is not.
  const omega = cloneContent()
  omega.milestones[0].lines[0].speakerId = 'omega_core'
  assert.deepEqual(errorsOf(omega), [])
  const warden = cloneContent()
  warden.milestones[0].lines[0].speakerId = 'pyro_maw'
  assert.ok(errorsOf(warden).some((e) => e.includes('must use an order-independent speaker')))
  const four = DIALOGUE_REGISTRY.getMilestone(4)?.lines ?? []
  assert.deepEqual(four.map((line) => line.speakerId), ['director_iona', 'director_iona', 'omega_core', 'hero'])
  assert.equal(four[2].text, 'You wrote it to ask, Director. I taught it to hold.')

  const duplicate = cloneContent()
  duplicate.sequences[1].id = duplicate.sequences[0].id
  assert.ok(errorsOf(duplicate).some((e) => e.includes('Duplicate sequence id')))
  assert.throws(() => createDialogueRegistry(duplicate), /Invalid dialogue content/)
})

test('docs/story/script.md is generated from the shipped dialogue and is in sync', () => {
  const generated = buildScript(readContent())
  const onDisk = fs.readFileSync(SCRIPT_PATH, 'utf8')
  assert.equal(onDisk, generated, 'run `npm run story:script` and commit the result')
  assert.ok(generated.includes('## Epilogue') && generated.includes('Then we leave it a choice.'))
})
