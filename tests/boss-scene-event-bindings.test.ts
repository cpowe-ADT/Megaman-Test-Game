import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { BossSceneEventBindings } from '../src/boss/framework/BossSceneEventBindings'

test('BossSceneEventBindings routes boss scene events to callbacks', () => {
  const events = new EventEmitter()
  const calls: string[] = []
  let bossHp = { current: 0, max: 0 }

  const bindings = new BossSceneEventBindings({
    events,
    playBossMusic: () => calls.push('music:start'),
    playStageMusic: () => calls.push('music:stop'),
    onPhaseChanged: (phaseName) => calls.push(`phase:${phaseName}`),
    onAttack: (event) => calls.push(`attack:${String(event.attack?.name ?? '')}`),
    onBossDamage: (hp) => {
      bossHp = hp
    },
    onBossDefeated: (rewardName) => calls.push(`defeat:${rewardName}`)
  })

  bindings.bind()
  events.emit('boss-phase-change', { phase: { name: 'Phase 2' } })
  events.emit('boss-attack', { attack: { name: 'Spark Shot' }, attackData: { id: 'spark_shot' } })
  events.emit('boss-music-start')
  events.emit('boss-music-stop')
  events.emit('boss-damage', { hp: { current: 12, max: 20 } })
  events.emit('boss-defeated', { reward: { displayName: 'Flame Serpent' } })
  bindings.destroy()
  events.emit('boss-phase-change', { phase: { name: 'Phase 3' } })

  assert.deepEqual(calls, [
    'phase:PHASE 2',
    'attack:Spark Shot',
    'music:start',
    'music:stop',
    'defeat:Flame Serpent'
  ])
  assert.deepEqual(bossHp, { current: 12, max: 20 })
})

test('BossSceneEventBindings bind and destroy are idempotent', () => {
  const events = new EventEmitter()
  let phaseCalls = 0

  const bindings = new BossSceneEventBindings({
    events,
    playBossMusic: () => {},
    playStageMusic: () => {},
    onPhaseChanged: () => {
      phaseCalls += 1
    },
    onAttack: () => {},
    onBossDamage: () => {},
    onBossDefeated: () => {}
  })

  bindings.bind()
  bindings.bind()
  events.emit('boss-phase-change', { phase: { name: 'Phase 4' } })
  bindings.destroy()
  bindings.destroy()
  events.emit('boss-phase-change', { phase: { name: 'Phase 5' } })

  assert.equal(phaseCalls, 1)
})
