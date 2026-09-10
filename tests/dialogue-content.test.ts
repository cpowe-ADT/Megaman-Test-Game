import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DIALOGUE_CONTENT,
  DIALOGUE_REGISTRY,
  ROBOT_MASTER_MILESTONE_COUNTS,
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

const ALL_NARRATIVE_STAGE_IDS = [
  TUTORIAL_STAGE_ID,
  ...ROBOT_MASTER_STAGE_IDS,
  FINAL_STAGE_ID
] as const

function cloneContent(): unknown {
  return JSON.parse(JSON.stringify(DIALOGUE_CONTENT))
}

test('dialogue content registers every speaker and every campaign boss exchange', () => {
  assert.equal(DIALOGUE_REGISTRY.getSpeakers().length, 12)
  assert.equal(DIALOGUE_REGISTRY.getSequences().length, ALL_NARRATIVE_STAGE_IDS.length * 2)

  for (const stageId of ALL_NARRATIVE_STAGE_IDS) {
    const intro = DIALOGUE_REGISTRY.getSequence(stageId, 'boss_intro')
    const defeat = DIALOGUE_REGISTRY.getSequence(stageId, 'boss_defeat')

    assert.ok(intro, `${stageId} must have boss-intro dialogue`)
    assert.ok(defeat, `${stageId} must have boss-defeat dialogue`)

    for (const line of [...intro.lines, ...defeat.lines]) {
      assert.ok(DIALOGUE_REGISTRY.getSpeaker(line.speakerId))
    }
  }

  for (const stageId of ROBOT_MASTER_STAGE_IDS) {
    const defeat = DIALOGUE_REGISTRY.getSequence(stageId, 'boss_defeat')
    assert.ok(defeat?.lines.some((line) => line.text.includes('{rewardLabel}')))
  }
})

test('dialogue milestones depend only on cleared-boss count', () => {
  assert.deepEqual(DIALOGUE_REGISTRY.getMilestones().map((entry) => entry.clearedBossCount), [1, 4, 8])
  assert.deepEqual([...ROBOT_MASTER_MILESTONE_COUNTS], [1, 4, 8])

  const firstOrder = ['pyro_maw']
  const differentFirstOrder = ['glacier_ronin']
  assert.equal(
    DIALOGUE_REGISTRY.getMilestone(firstOrder.length)?.id,
    DIALOGUE_REGISTRY.getMilestone(differentFirstOrder.length)?.id
  )

  assert.equal(DIALOGUE_REGISTRY.getMilestone(2), undefined)
  assert.equal(DIALOGUE_REGISTRY.getMilestone(8)?.id, 'robot_masters_cleared_8')
})

test('dialogue interpolation resolves allowed repeated tokens without mutating content', () => {
  const template = '{hero}, recovered {rewardLabel}. Route {clearedCount}/8 is stable, {hero}.'
  const resolved = resolveDialogueText(template, {
    hero: 'Aster',
    rewardLabel: 'Flame Serpent',
    clearedCount: 4
  })

  assert.equal(resolved, 'Aster, recovered Flame Serpent. Route 4/8 is stable, Aster.')
  assert.equal(template.startsWith('{hero}'), true)

  const defeat = DIALOGUE_REGISTRY.getSequence('pyro_maw', 'boss_defeat')
  assert.ok(defeat)
  const resolvedSequence = resolveDialogueSequence(defeat, {
    hero: 'Aster',
    rewardLabel: 'Flame Serpent'
  })
  assert.equal(resolvedSequence.lines.some((line) => line.text.includes('Flame Serpent')), true)
  assert.notEqual(resolvedSequence, defeat)
})

test('dialogue interpolation rejects missing and unknown tokens', () => {
  assert.throws(() => resolveDialogueText('Hold {rewardLabel}, {hero}.', { hero: 'Aster' }), /rewardLabel/)
  assert.throws(() => resolveDialogueText('Unknown {bossName}.', { hero: 'Aster' }), /bossName/)
})

test('dialogue validation rejects unregistered speakers and incomplete stage coverage', () => {
  const unregistered = cloneContent() as any
  unregistered.sequences[0].lines[0].speakerId = 'intruder'
  const speakerResult = validateDialogueContent(unregistered)
  assert.equal(speakerResult.valid, false)
  assert.equal(speakerResult.errors.some((error) => error.includes('intruder')), true)

  const incomplete = cloneContent() as any
  incomplete.sequences = incomplete.sequences.slice(1)
  const coverageResult = validateDialogueContent(incomplete)
  assert.equal(coverageResult.valid, false)
  assert.equal(coverageResult.errors.some((error) => error.includes('tutorial_sentinel:boss_intro')), true)
})

test('dialogue validation rejects malformed tokens, duplicate ids, and milestone drift', () => {
  const malformed = cloneContent() as any
  malformed.sequences[0].lines[0].text = 'Wake {hero-name}.'
  malformed.sequences[1].id = malformed.sequences[0].id
  malformed.milestones[0].clearedBossCount = 2

  const result = validateDialogueContent(malformed)
  assert.equal(result.valid, false)
  assert.equal(result.errors.some((error) => error.includes('hero-name')), true)
  assert.equal(result.errors.some((error) => error.includes('Duplicate sequence id')), true)
  assert.equal(result.errors.some((error) => error.includes('milestone counts')), true)
  assert.throws(() => createDialogueRegistry(malformed), /Invalid dialogue content/)
})

test('dialogue validation rejects duplicate milestone counts and boss-specific milestone speakers', () => {
  const invalid = cloneContent() as any
  invalid.milestones.push({
    ...invalid.milestones[0],
    id: 'duplicate_count',
    lines: [{ speakerId: 'pyro_maw', text: 'A boss-specific count report.' }]
  })

  const result = validateDialogueContent(invalid)
  assert.equal(result.valid, false)
  assert.equal(result.errors.some((error) => error.includes('once each')), true)
  assert.equal(result.errors.some((error) => error.includes('order-independent')), true)
})
