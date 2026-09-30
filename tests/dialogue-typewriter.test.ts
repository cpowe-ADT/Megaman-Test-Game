import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TYPEWRITER_BLIP_EVERY_CHARS,
  TYPEWRITER_CHARS_PER_SECOND,
  typewriterBlipTicked,
  typewriterConfirmAction,
  typewriterVisibleChars
} from '../src/ui/dialogueTypewriter.ts'

test('constants match the spec: 40 characters per second, a blip every 2 characters', () => {
  assert.equal(TYPEWRITER_CHARS_PER_SECOND, 40)
  assert.equal(TYPEWRITER_BLIP_EVERY_CHARS, 2)
})

test('characters shown grow at 40 per second and clamp to the line length', () => {
  assert.equal(typewriterVisibleChars(20, 0), 0)
  assert.equal(typewriterVisibleChars(20, 250), 10, '0.25s at 40/s is 10 characters')
  assert.equal(typewriterVisibleChars(20, 500), 20, '0.5s at 40/s is exactly the line length')
  assert.equal(typewriterVisibleChars(20, 10000), 20, 'never exceeds the line length')
  assert.equal(typewriterVisibleChars(0, 500), 0, 'an empty line shows nothing')
  assert.equal(typewriterVisibleChars(20, -50), 0, 'a negative elapsed clamps to zero')
})

test('a blip ticks every two characters, once per tick even across a big frame jump', () => {
  assert.equal(typewriterBlipTicked(0, 1), false)
  assert.equal(typewriterBlipTicked(0, 2), true)
  assert.equal(typewriterBlipTicked(2, 3), false)
  assert.equal(typewriterBlipTicked(2, 4), true)
  assert.equal(typewriterBlipTicked(0, 7), true, 'a big jump still ticks once, not three times')
  assert.equal(typewriterBlipTicked(5, 5), false, 'no new characters, no tick')
  assert.equal(typewriterBlipTicked(6, 4), false, 'going backward never ticks')
})

test('confirm completes a typing line, then advances a complete one', () => {
  assert.equal(typewriterConfirmAction(5, 20), 'complete')
  assert.equal(typewriterConfirmAction(19, 20), 'complete')
  assert.equal(typewriterConfirmAction(20, 20), 'advance')
  assert.equal(typewriterConfirmAction(0, 0), 'advance', 'an empty line is already complete')
})
