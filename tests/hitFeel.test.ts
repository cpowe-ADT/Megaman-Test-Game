import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveChargeAuraFrequencyMs } from '../src/player/hitFeel'

/** `hitFeel.ts` is a pure module (no Phaser import), so it loads in plain node:test. */
test('5.3c-1 resolveChargeAuraFrequencyMs: 42ms normally, 340ms (under 3Hz) under reducedFlashing', () => {
  assert.equal(resolveChargeAuraFrequencyMs(false), 42)
  assert.equal(resolveChargeAuraFrequencyMs(true), 340)
})
