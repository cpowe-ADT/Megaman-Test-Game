import test from 'node:test'
import assert from 'node:assert/strict'
import { PORTRAIT_FRAME_NAMES, portraitForSpeaker } from '../src/ui/dialoguePortraits.ts'
import { DIALOGUE_SPEAKER_IDS } from '../src/content/dialogue/types.ts'

test('every dialogue speaker id resolves to a frame in the portrait atlas', () => {
  for (const speakerId of DIALOGUE_SPEAKER_IDS) {
    const frame = portraitForSpeaker(speakerId)
    assert.ok(frame, `${speakerId} has no portrait frame`)
    assert.ok((PORTRAIT_FRAME_NAMES as readonly string[]).includes(frame as string))
  }
})

test('the hero speaks under the pilot name token, so the frame is wren, not hero', () => {
  assert.equal(portraitForSpeaker('hero'), 'wren')
})

test('the operator and the tutorial mini-boss use their own frame names', () => {
  assert.equal(portraitForSpeaker('director_iona'), 'iona')
  assert.equal(portraitForSpeaker('sentinel_rook'), 'rook')
})

test('every warden id and the antagonist already equal their frame name', () => {
  const identity = ['pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin', 'omega_core']
  for (const id of identity) assert.equal(portraitForSpeaker(id), id)
})

test('narration and unknown speakers show no portrait', () => {
  assert.equal(portraitForSpeaker(''), null)
  assert.equal(portraitForSpeaker(null), null)
  assert.equal(portraitForSpeaker(undefined), null)
  assert.equal(portraitForSpeaker('narrator'), null)
})
