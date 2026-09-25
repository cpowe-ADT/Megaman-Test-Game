import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DIALOGUE_CONTENT } from '../src/content/dialogue/index.ts'
import {
  FINAL_STAGE_ID,
  ROBOT_MASTER_STAGE_IDS,
  TUTORIAL_STAGE_ID,
  getCampaignStage
} from '../src/content/campaign.ts'

// Part 12g, the schema-free line pass of prompt 07 section 7.6 A (EVAL-P7-007, text half).

type Line = { speakerId?: string; text: string; card?: string }
type Sequence = { id: string; trigger: string; stageId?: string; lines: Line[] }
type Milestone = { id: string; lines: Line[] }

const content = DIALOGUE_CONTENT as unknown as { sequences: Sequence[]; milestones: Milestone[] }

/** Each warden owns one verb (style guide rule 11); the forms below count as its stem. */
const VERB_FORMS: Record<string, RegExp> = {
  pyro_maw: /\b(un)?seal(s|ed|ing)?\b/i,
  tide_reaver: /\b(hold|holds|holding|held)\b/i,
  volt_hopper: /\bcycl(e|es|ed|ing)\b/i,
  basalt_titan: /\b(bear|bears|bearing|bore|borne)\b/i,
  ferro_blade: /\b(re)?count(s|ed|ing)?\b/i,
  mire_wraith: /\bdos(e|es|ed|ing)\b/i,
  gale_vixen: /\bsteer(s|ed|ing)?\b/i,
  glacier_ronin: /\bpreserv(e|es|ed|ing)\b/i
}

/** A contraction, not a possessive: "OMEGA's" and "tonight's" do not count. */
const CONTRACTION = /\b(\w+n't|\w+'(re|ll|ve|d|m)|it's|that's|what's|whatever's|something's|there's|here's|let's)\b/i

function sequence(trigger: string, stageId?: string): Sequence {
  const found = content.sequences.filter((entry) => entry.trigger === trigger && entry.stageId === stageId)
  assert.equal(found.length, 1, `${trigger}${stageId ? ` for ${stageId}` : ''} is authored once`)
  return found[0]
}

function milestone(id: string): Milestone {
  const found = content.milestones.find((entry) => entry.id === id)
  assert.ok(found, `milestone ${id} is authored`)
  return found
}

function allLines(): Line[] {
  return [...content.sequences.flatMap((entry) => entry.lines), ...content.milestones.flatMap((entry) => entry.lines)]
}

test('each warden intro, defeat and epilogue card carry its verb stem', () => {
  const epilogue = sequence('epilogue')
  for (const stageId of ROBOT_MASTER_STAGE_IDS) {
    const verb = VERB_FORMS[stageId]
    assert.ok(verb, `${stageId} has a verb signature`)
    for (const trigger of ['boss_intro', 'boss_defeat']) {
      const own = sequence(trigger, stageId).lines.filter((line) => line.speakerId === stageId)
      assert.ok(own.some((line) => verb.test(line.text)), `${stageId} ${trigger}: the warden's own line carries ${verb}`)
    }
    const card = epilogue.lines.find((line) => line.card === stageId)
    assert.ok(card && verb.test(card.text), `${stageId} epilogue card carries ${verb}`)
  }
})

test('warden lines leave the shared "cheaper" template and the shared forensic register', () => {
  for (const stageId of ROBOT_MASTER_STAGE_IDS) {
    for (const trigger of ['boss_intro', 'boss_defeat']) {
      for (const line of sequence(trigger, stageId).lines.filter((entry) => entry.speakerId === stageId)) {
        assert.doesNotMatch(line.text, /\bcheaper\b|\bexpendable\b|OMEGA says|OMEGA calculated|Sequence confirmed|evidence is complete/i, `${stageId} ${trigger}`)
      }
    }
  }
})

test('defeat lines stay true for any placed reward', () => {
  for (const entry of content.sequences.filter((item) => item.trigger === 'boss_defeat')) {
    for (const line of entry.lines) {
      assert.doesNotMatch(line.text, /\{rewardLabel\}\s+(will|can|lets|carries|fires|burns|cuts)\b/i, `${entry.id}: ${line.text}`)
    }
  }
})

test('Iona contracts on the radio ticker and OMEGA never contracts', () => {
  for (const entry of content.sequences.filter((item) => item.trigger === 'radio')) {
    for (const line of entry.lines.filter((item) => item.speakerId === 'director_iona')) {
      assert.match(line.text, CONTRACTION, `${entry.id}: ${line.text}`)
    }
  }
  for (const line of allLines().filter((item) => item.speakerId === 'omega_core')) {
    assert.doesNotMatch(line.text, CONTRACTION, line.text)
  }
})

test('the last stage is the Central Core everywhere, and the tutorial card and its lines agree', () => {
  const finalName = getCampaignStage(FINAL_STAGE_ID).district
  assert.equal(finalName, 'Central Core')
  for (const line of allLines()) assert.doesNotMatch(line.text, /\bfortress\b|\bcitadel\b/i, line.text)
  assert.ok(sequence('stage_briefing', FINAL_STAGE_ID).lines[0].text.startsWith(`${finalName}.`))
  assert.ok(milestone('robot_masters_cleared_8').lines.some((line) => line.text.includes(finalName)))
  for (const doc of ['docs/story/story-bible.md', 'docs/story/style-guide.md', 'docs/story/script.md']) {
    assert.doesNotMatch(fs.readFileSync(doc, 'utf8'), /Omega (Fortress|Citadel)/, doc)
  }

  const tutorial = getCampaignStage(TUTORIAL_STAGE_ID)
  const cardName = tutorial.title.replace(/^Tutorial:\s*/i, '')
  for (const line of allLines()) {
    for (const match of line.text.matchAll(/drill hangar/gi)) assert.equal(match[0], tutorial.district, line.text)
  }
  const briefing = sequence('stage_briefing', TUTORIAL_STAGE_ID).lines[0].text
  assert.ok(briefing.includes(tutorial.district) && briefing.includes(cardName), briefing)
})

test('Iona earns her turn, and the Core closes the hangar and consent holes', () => {
  const tutorialDefeat = sequence('boss_defeat', TUTORIAL_STAGE_ID).lines
  assert.ok(tutorialDefeat.some((line) => line.speakerId === 'director_iona' && /lattice/.test(line.text) && /asks/.test(line.text)))
  assert.ok(milestone('robot_masters_cleared_1').lines.some((line) => line.speakerId === 'director_iona' && line.text.includes('It asks. It does not take.')))
  assert.ok(milestone('robot_masters_cleared_4').lines.some((line) => line.text.includes('I wrote the layer')))

  const omegaRadio = sequence('radio', FINAL_STAGE_ID).lines.find((line) => line.speakerId === 'omega_core')
  assert.ok(omegaRadio && omegaRadio.text.includes(getCampaignStage(TUTORIAL_STAGE_ID).district), 'OMEGA admits it left the hangar open')
  assert.equal(allLines().filter((line) => /fail differently/i.test(line.text)).length, 1, '"fail differently" is said once')

  const coreIntro = sequence('boss_intro', FINAL_STAGE_ID).lines
  const charge = coreIntro.findIndex((line) => line.speakerId === 'omega_core' && /\bconsent\b/.test(line.text))
  const answer = coreIntro.findIndex((line) => line.speakerId === 'hero')
  assert.ok(charge >= 0 && charge < answer, 'the consent charge is laid before WREN speaks')

  const epilogue = sequence('epilogue').lines
  const reckoning = epilogue.findIndex((line) => line.speakerId === 'director_iona' && line.text.includes('I filed what I wrote'))
  const holding = epilogue.findIndex((line) => line.text.includes('The network is holding'))
  assert.ok(reckoning >= 0 && reckoning <= holding, 'the reckoning comes before "The network is holding"')
  const reckoningLine = epilogue[reckoning].text
  if (reckoning === holding) assert.ok(reckoningLine.indexOf('I filed') < reckoningLine.indexOf('The network is holding'))

  for (const entry of content.sequences.filter((item) => item.trigger === 'radio')) {
    for (const line of entry.lines.filter((item) => item.speakerId === 'omega_core')) {
      assert.doesNotMatch(line.text, /\blast district\b|\bthe others\b/i, `${entry.id}: OMEGA's intrusion stands alone`)
    }
  }
})
