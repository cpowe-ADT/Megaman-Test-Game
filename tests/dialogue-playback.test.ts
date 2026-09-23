import test from 'node:test'
import assert from 'node:assert/strict'
import { DialoguePlayback } from '../src/narrative/DialoguePlayback.ts'

const lines = [
  { sequenceId: 'intro', speakerId: 'operator', speakerName: 'Operator', text: 'Line one.' },
  { sequenceId: 'intro', speakerId: 'hero', speakerName: 'Relay', text: 'Line two.' }
]

test('DialoguePlayback advances deterministically and reports completion', () => {
  const playback = new DialoguePlayback()
  assert.deepEqual(playback.start(lines), {
    active: true,
    lineIndex: 0,
    lineCount: 2,
    sequenceId: 'intro',
    speakerId: 'operator',
    speakerName: 'Operator',
    text: 'Line one.'
  })
  assert.equal(playback.advance().text, 'Line two.')
  assert.deepEqual(playback.advance(), {
    active: false,
    lineIndex: 2,
    lineCount: 2,
    sequenceId: null,
    speakerId: null,
    speakerName: null,
    text: null
  })
})

test('DialoguePlayback skip converges on the same completed state', () => {
  const playback = new DialoguePlayback()
  playback.start(lines)
  const skipped = playback.skip()

  assert.equal(skipped.active, false)
  assert.equal(skipped.lineIndex, skipped.lineCount)
  assert.deepEqual(lines.map((line) => line.text), ['Line one.', 'Line two.'])
})
