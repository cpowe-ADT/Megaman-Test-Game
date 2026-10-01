import test from 'node:test'
import assert from 'node:assert/strict'
import { blinkBossHit, type BlinkTweens } from '../src/boss/hitFlash'
import { WEAKNESS_MULTIPLIER } from '../src/bosses/types'
import { bossDamageScale, scaleBossHitDamage } from '../src/scenes/game/combatRules'

test('special weapons and charged shots hit bosses twice as hard; pellets and the saber do not change', () => {
  assert.equal(bossDamageScale('Buster', 0), 1, 'a pellet (and the saber, which counts as the Buster)')
  assert.equal(bossDamageScale('Buster', 2), 2, 'a full charge')
  assert.equal(bossDamageScale('FlameSerpent', 0), 2)
  // A weakness hit from a 3-damage weapon: 3 x 2 x 2.5 = 15, an eighth of a 120 HP boss (it was 5).
  assert.equal(scaleBossHitDamage(3 * bossDamageScale('HydroLance'), 0, WEAKNESS_MULTIPLIER), 15)
  assert.equal(scaleBossHitDamage(1 * bossDamageScale('Buster', 0), 0, 1), 1)
})

test('a new hit blink stops the last one and starts from full opacity, so fast hits cannot leave the boss see-through', () => {
  const target = { alpha: 1, setAlpha(value: number) { this.alpha = value } }
  const started: Array<{ fromAlpha: number; stopped: boolean; onStop: () => void; onComplete: () => void }> = []
  const tweens: BlinkTweens = {
    add(config) {
      const entry = { fromAlpha: target.alpha, stopped: false, onStop: config.onStop, onComplete: config.onComplete }
      started.push(entry)
      target.alpha = 0.4 // mid-blink when the next hit lands
      return { stop: () => { entry.stopped = true; entry.onStop() } }
    }
  }
  blinkBossHit(tweens, target, 0.25, 70)
  blinkBossHit(tweens, target, 0.25, 70)
  blinkBossHit(tweens, target, 0.25, 70)
  assert.deepEqual(started.map((entry) => entry.fromAlpha), [1, 1, 1], 'every blink starts from full opacity')
  assert.deepEqual(started.map((entry) => entry.stopped), [true, true, false])
  started[2].onComplete()
  assert.equal(target.alpha, 1, 'the last blink ends opaque')
})
