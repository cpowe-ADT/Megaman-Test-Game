import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { CameraDirector, type CameraDirectorHost } from '../src/scenes/game/CameraDirector'
import { DeathSequence, type DeathSequenceHost } from '../src/scenes/game/DeathSequence'
import { RunState, type RunStateHost } from '../src/scenes/game/RunState'
import { DevUx, type DevUxHost } from '../src/scenes/game/DevUx'
import { Save } from '../src/systems/Save'
import { getCampaignStage, TUTORIAL_STAGE_ID } from '../src/content/campaign'

/**
 * These fake-host tests prove the seams of the four modules extracted from `Game` in slice 5.0c:
 * every host is a plain object, so no scene, canvas or Phaser runtime is needed to exercise the
 * logic (EVAL-P5-010 follow-up 5.0d). See `docs/prompts/reviews/2026-09-23-5.0c-extraction/principal-engineer.md`.
 */

function storageFixture(t: TestContext) {
  const values = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
      }
    }
  })
  t.after(() => (previous ? Object.defineProperty(globalThis, 'window', previous) : Reflect.deleteProperty(globalThis, 'window')))
  return values
}

// ----------------------------------------------------------------------------------
// CameraDirector: hit-stop pauses physics and resumes at the same real-time duration
// regardless of frame rate; a second hit-stop extends to the max, not the sum.
// ----------------------------------------------------------------------------------

function makeCameraHost() {
  const calls: string[] = []
  const host = {
    game: { loop: { delta: 0 } },
    physics: {
      world: {
        pause: () => calls.push('pause'),
        resume: () => calls.push('resume')
      }
    },
    cameras: { main: { setLerp: () => {}, shake: () => {}, setBounds: () => {}, scrollX: 0, zoom: 1, width: 100 } },
    hitstopRemainingFrames: 0,
    bossRoomCameraLocked: false
  } as unknown as CameraDirectorHost
  return { host, calls }
}

function tickUntilResolved(director: CameraDirector, host: CameraDirectorHost, deltaMs: number): number {
  ;(host.game as unknown as { loop: { delta: number } }).loop.delta = deltaMs
  let ticks = 0
  while (director.tickHitstop()) {
    ticks += 1
    if (ticks > 1000) throw new Error('hitstop never resolved')
  }
  return ticks
}

test('CameraDirector.tickHitstop pauses physics once and resumes after the same real-time duration at 30/60/144fps', () => {
  const cases: Array<{ fps: number; expectedTicks: number }> = [
    { fps: 30, expectedTicks: 5 },
    { fps: 60, expectedTicks: 10 },
    { fps: 144, expectedTicks: 24 }
  ]
  for (const { fps, expectedTicks } of cases) {
    const { host, calls } = makeCameraHost()
    const director = new CameraDirector(host)
    director.onHitstop(10)
    assert.equal(calls.filter((c) => c === 'pause').length, 1, `fps=${fps} pause`)
    const ticks = tickUntilResolved(director, host, 1000 / fps)
    assert.equal(ticks, expectedTicks, `fps=${fps} ticks`)
    assert.equal(calls.filter((c) => c === 'resume').length, 1, `fps=${fps} resume`)
    assert.equal(host.hitstopRemainingFrames, 0)
  }
})

test('CameraDirector.onHitstop extends an active hit-stop to the max, not the sum', () => {
  const { host, calls } = makeCameraHost()
  const director = new CameraDirector(host)
  director.onHitstop(5)
  director.onHitstop(8)
  assert.equal(host.hitstopRemainingFrames, 8)
  const ticks = tickUntilResolved(director, host, 1000 / 60)
  assert.equal(ticks, 8)
  assert.equal(calls.filter((c) => c === 'resume').length, 1)
})

// ----------------------------------------------------------------------------------
// DeathSequence: killPlayer's one-life-per-fall guard, the respawn checkpoint step
// order, and the game-over payload carrying the active stage id (the stageId fix).
// ----------------------------------------------------------------------------------

function makeDeathHost(overrides: Partial<DeathSequenceHost> = {}) {
  const log: string[] = []
  const player = {
    x: 200,
    active: true,
    data: { set: () => {}, get: () => undefined },
    setPosition: () => {},
    setVelocity: () => {},
    setAcceleration: () => {},
    clearTint: () => {},
    setActive: () => player,
    setVisible: () => player,
    setDataEnabled: () => {}
  }
  const host = {
    scene: {
      manager: { keys: { GameOver: {} } },
      start: (key: string, data: unknown) => log.push(`scene.start:${key}:${JSON.stringify(data)}`)
    },
    time: { delayedCall: () => log.push('time.delayedCall') },
    player,
    playerHp: 10,
    playerMaxHp: 10,
    playerLives: 2,
    fallingToDeath: false,
    gameOverTriggered: false,
    bossEncounterActive: false,
    activeStageId: TUTORIAL_STAGE_ID,
    currentCheckpointIndex: 0,
    currentCheckpointId: 'tutorial_start',
    progressionSave: Save.load(),
    sessionStats: { defeat: () => log.push('sessionStats.defeat'), respawn: () => log.push('sessionStats.respawn') },
    hud: { updatePlayerHp: () => {}, setLives: () => {} },
    requestPlayerDamage: () => ({ accepted: true }) as never,
    flushStatistics: () => log.push('flushStatistics'),
    autosaveActiveRun: () => (log.push('autosaveActiveRun'), true),
    disableProjectileGroups: () => log.push('disableProjectileGroups'),
    activateBossEncounter: () => log.push('activateBossEncounter'),
    showStageToast: () => log.push('showStageToast'),
    syncWeaponHud: () => log.push('syncWeaponHud'),
    gameOver: () => log.push('gameOver'),
    ...overrides
  } as unknown as DeathSequenceHost
  return { host, log }
}

test('DeathSequence.killPlayer guards re-entry: one life lost per fall', () => {
  const { host, log } = makeDeathHost({ playerLives: 2 })
  const death = new DeathSequence(host)

  death.killPlayer('pit')
  assert.equal(host.playerLives, 1)
  assert.equal(log.filter((l) => l === 'sessionStats.defeat').length, 1)
  assert.equal(host.fallingToDeath, true)

  // A second call before respawn resolves must not take a second life.
  death.killPlayer('pit')
  assert.equal(host.playerLives, 1)
  assert.equal(log.filter((l) => l === 'sessionStats.defeat').length, 1)
})

test('DeathSequence.updateRespawnCheckpoint runs steps in order: save, autosave, story hook, boss activation', (t) => {
  storageFixture(t)
  const stage = getCampaignStage(TUTORIAL_STAGE_ID)
  const lastIndex = stage.arena.checkpoints.length - 1
  const priorCheckpoint = stage.arena.checkpoints[lastIndex - 1]
  const lastCheckpoint = stage.arena.checkpoints[lastIndex]
  const { host, log } = makeDeathHost({
    currentCheckpointIndex: lastIndex - 1,
    currentCheckpointId: priorCheckpoint.id,
    storyDirector: { onCheckpoint: () => log.push('storyDirector.onCheckpoint') }
  })
  host.player.x = lastCheckpoint.triggerX + 10 // past the stage's last checkpoint trigger
  const death = new DeathSequence(host)

  death.updateRespawnCheckpoint()

  assert.equal(host.currentCheckpointIndex, lastIndex)
  assert.equal(host.currentCheckpointId, lastCheckpoint.id)
  assert.deepEqual(host.respawnPoint, { x: lastCheckpoint.x, y: lastCheckpoint.y })
  assert.deepEqual(log, ['flushStatistics', 'autosaveActiveRun', 'storyDirector.onCheckpoint', 'activateBossEncounter'])
})

test('DeathSequence.onPlayerGameOver payload carries the active stage id (stageId fix)', () => {
  const { host, log } = makeDeathHost({ activeStageId: 'pyro_maw', currentCheckpointId: 'pyro_start' })
  const death = new DeathSequence(host)

  death.onPlayerGameOver()

  const started = log.find((l) => l.startsWith('scene.start:'))
  assert.ok(started, 'scene.start was called')
  assert.equal(started, 'scene.start:GameOver:{"stageId":"pyro_maw","checkpointId":"pyro_start"}')
})

// ----------------------------------------------------------------------------------
// RunState: capture then apply round-trips position, checkpoint, weapon energy, lives.
// ----------------------------------------------------------------------------------

function makeRunHost(overrides: Partial<RunStateHost> = {}) {
  const log: string[] = []
  const player = {
    setPosition: (x: number, y: number) => log.push(`setPosition:${x},${y}`),
    data: { set: () => {}, get: () => undefined }
  }
  const host = {
    player,
    playerHp: 8,
    playerMaxHp: 10,
    playerLives: 3,
    activeStageId: TUTORIAL_STAGE_ID,
    activeBossId: 'tutorial_sentinel',
    currentCheckpointIndex: getCampaignStage(TUTORIAL_STAGE_ID).arena.checkpoints.length - 1,
    currentCheckpointId: getCampaignStage(TUTORIAL_STAGE_ID).arena.checkpoints.at(-1)!.id,
    currentWeaponIndex: 0,
    weapons: ['buster', 'saber'],
    weaponEnergyById: { buster: 100, saber: 50 },
    sessionStats: { stageElapsedMs: 12345 },
    hud: { updatePlayerHp: () => {}, setLives: () => {} },
    flushStatistics: () => log.push('flushStatistics'),
    getCurrentWeaponId: () => host.weapons[host.currentWeaponIndex],
    restorePlayerHealth: () => 0,
    updateWeaponLabel: () => log.push('updateWeaponLabel'),
    ...overrides
  } as unknown as RunStateHost
  return { host, log }
}

test('RunState capture then apply round-trips position, checkpoint, weapon energy and lives', () => {
  const stage = getCampaignStage(TUTORIAL_STAGE_ID)
  const lastCheckpoint = stage.arena.checkpoints.at(-1)!
  const firstCheckpoint = stage.arena.checkpoints[0]
  const { host } = makeRunHost()
  const runState = new RunState(host)

  const snapshot = runState.captureActiveRunSnapshot()
  assert.ok(snapshot)
  assert.equal(snapshot!.stageId, TUTORIAL_STAGE_ID)
  assert.equal(snapshot!.checkpointId, lastCheckpoint.id)
  assert.equal(snapshot!.playerLives, 3)
  assert.deepEqual(snapshot!.weaponEnergyById, { buster: 100, saber: 50 })

  // Mutate the host as if the run had continued and lost progress.
  host.currentCheckpointIndex = 0
  host.currentCheckpointId = firstCheckpoint.id
  host.playerLives = 1
  host.weaponEnergyById = { buster: 0, saber: 0, extra: 10 }

  runState.applyActiveRunSnapshot(snapshot)

  assert.equal(host.currentCheckpointIndex, stage.arena.checkpoints.length - 1)
  assert.equal(host.currentCheckpointId, lastCheckpoint.id)
  assert.deepEqual(host.respawnPoint, { x: lastCheckpoint.x, y: lastCheckpoint.y })
  assert.equal(host.playerLives, 3)
  assert.deepEqual(host.weaponEnergyById, { buster: 100, saber: 50, extra: 10 })
})

test('RunState.captureActiveRunSnapshot uses activeStageId, not a missing stageId field (stageId fix)', () => {
  const { host } = makeRunHost({ activeStageId: 'pyro_maw' })
  const runState = new RunState(host)
  const snapshot = runState.captureActiveRunSnapshot()
  assert.equal(snapshot!.stageId, 'pyro_maw')
})

// ----------------------------------------------------------------------------------
// DevUx: `state.on` is reachable and toggleable through the host without a real scene,
// the same object `Game._dev` (`this.devUx.state`) exposes.
// ----------------------------------------------------------------------------------

test('DevUx.state.on toggles through the host and stays reachable like Game._dev', () => {
  const pressedHandlers = new Map<string, () => void>()
  const host = {
    actions: { onPressed: (action: string, handler: () => void) => pressedHandlers.set(action, handler) },
    events: { once: () => {} },
    add: {
      text: () => ({ setScrollFactor: () => ({ setDepth: () => {} }) }),
      graphics: () => ({ setDepth: () => {} })
    },
    physics: { world: {} }
  } as unknown as DevUxHost
  const devUx = new DevUx(host)

  assert.equal(devUx.state.on, false)

  devUx.init()
  const toggle = pressedHandlers.get('debugOverlay')
  assert.ok(toggle, 'debugOverlay handler was registered')
  toggle!()

  assert.equal(devUx.state.on, true)
})
