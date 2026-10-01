import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOSS_INTRO_DURATION_MS,
  BossIntroSequence,
  resolveBossIntroFrames,
  shouldPlayBossIntro
} from '../src/scenes/bossIntro/BossIntroLogic.ts'

// Part 13g, EVAL-P13-012: the pre-stage boss card's pure timing, typewriter and skip gate.

test('the sequence starts active and types the name in over the full duration', () => {
  const sequence = new BossIntroSequence()
  const started = sequence.start(8, 1000)
  assert.equal(started.phase, 'active')
  assert.equal(started.active, true)
  assert.equal(started.visibleChars, 0)
  assert.equal(started.remainingMs, 1000)

  const mid = sequence.tick(250)
  assert.equal(mid, false, 'no phase change mid-flight')
  const snapshot = sequence.snapshot()
  assert.ok(snapshot.visibleChars > 0 && snapshot.visibleChars <= 8)

  const changed = sequence.tick(10000)
  assert.equal(changed, true, 'the tick that crosses the duration reports the phase change')
  const done = sequence.snapshot()
  assert.equal(done.phase, 'done')
  assert.equal(done.active, false)
  assert.equal(done.remainingMs, 0)
  assert.equal(done.visibleChars, 8, 'done shows the full name')
})

test('the default duration is about 3 s', () => {
  assert.equal(BOSS_INTRO_DURATION_MS, 3000)
})

test('skip ends an active card immediately and is a no-op otherwise', () => {
  const sequence = new BossIntroSequence()
  assert.equal(sequence.skip(), false, 'idle: nothing to skip')
  sequence.start(10)
  assert.equal(sequence.skip(), true)
  assert.equal(sequence.snapshot().phase, 'done')
  assert.equal(sequence.snapshot().visibleChars, 10)
  assert.equal(sequence.skip(), false, 'already done')
})

test('resolveBossIntroFrames keeps only the boss\'s own intro frames, sorted numerically', () => {
  const frames = [
    'pyro_maw/idle/0',
    'pyro_maw/intro/10',
    'pyro_maw/intro/2',
    'pyro_maw/intro/0',
    'pyro_maw/intro/1',
    'tide_reaver/intro/0'
  ]
  assert.deepEqual(resolveBossIntroFrames(frames, 'pyro_maw'), [
    'pyro_maw/intro/0',
    'pyro_maw/intro/1',
    'pyro_maw/intro/2',
    'pyro_maw/intro/10'
  ])
})

test('shouldPlayBossIntro: never the tutorial, never a resumed run, off with the story switch, skipped under unasked automation', () => {
  const base = {
    stageId: 'pyro_maw',
    bossId: 'pyro_maw',
    tutorialStageId: 'tutorial_sentinel',
    storyIntroEnabled: true,
    automationEnabled: false,
    automationBossIntro: false
  }
  assert.equal(shouldPlayBossIntro(base), true, 'a fresh warden entry, story on, no automation: plays')
  assert.equal(shouldPlayBossIntro({ ...base, stageId: 'tutorial_sentinel', bossId: 'sentinel_rook' }), false, 'the tutorial never shows it')
  assert.equal(shouldPlayBossIntro({ ...base, loadFromSave: true }), false, 'a resumed run skips it')
  assert.equal(shouldPlayBossIntro({ ...base, storyIntroEnabled: false }), false, '?storyIntro=off skips it')
  assert.equal(shouldPlayBossIntro({ ...base, automationEnabled: true }), false, 'automation skips it by default')
  assert.equal(shouldPlayBossIntro({ ...base, automationEnabled: true, automationBossIntro: true }), true, 'a smoke can ask for it')
  assert.equal(shouldPlayBossIntro({ ...base, stageId: null }), false, 'no stage id: nothing to show')
  assert.equal(shouldPlayBossIntro({ ...base, bossId: null }), false, 'no boss id: nothing to show')
})
