// SFX key resolution, the mechanics sound map, the generated-SFX parameter file, and the audio service's
// per-stage and per-boss music with the phase-two crossfade (part 12h).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PlaceholderAudioService } from '../src/audio/PlaceholderAudioService'
import {
  areaAroundCentres,
  breakableWallHitSfx,
  crumblePhaseSfx,
  isAreaAudible,
  railPhaseSfx,
  risingLiquidPhaseSfx,
  roomLockPhaseSfx,
  ventPhaseSfx,
  windPhaseSfx
} from '../src/audio/mechanicsSfx'
import { SFX_ASSETS, isSfxAssetKey, resolveSfxKey } from '../src/audio/sfxLibrary'

test('a known key plays itself, an alias its mapping, and an unknown key throws only when strict', () => {
  assert.equal(resolveSfxKey('wall_break', true), 'wall_break')
  assert.equal(resolveSfxKey('Stomp Shock', true), 'miniboss_shockwave')
  assert.equal(resolveSfxKey('Giga Hop', true), null)
  assert.throws(() => resolveSfxKey('wal_break', true), /unknown SFX key 'wal_break'/)
  assert.equal(resolveSfxKey('wal_break', false), null)
  // The old substring guesses are gone: a near miss is an error in development, not a random sound.
  assert.throws(() => resolveSfxKey('enemy_big_hit', true))
})

test('mechanic state changes map to their sounds', () => {
  assert.equal(ventPhaseSfx('idle', 'arming'), 'vent_arm')
  assert.equal(ventPhaseSfx('arming', 'firing'), 'vent_fire')
  assert.equal(ventPhaseSfx('firing', 'idle'), null)
  assert.equal(ventPhaseSfx('firing', 'firing'), null)
  assert.equal(railPhaseSfx('arming', 'arcing'), 'rail_arc')
  assert.equal(railPhaseSfx('arcing', 'arcing'), null)
  assert.equal(windPhaseSfx('building', 'blowing'), 'wind_gust')
  assert.equal(windPhaseSfx('blowing', 'calm'), null)
  assert.equal(crumblePhaseSfx('solid', 'shaking'), 'crumble_shake')
  assert.equal(crumblePhaseSfx('shaking', 'fallen'), 'crumble_fall')
  assert.equal(crumblePhaseSfx('fallen', 'solid'), null)
  assert.equal(risingLiquidPhaseSfx('dormant', 'rising'), 'slag_rise')
  assert.equal(risingLiquidPhaseSfx('rising', 'full'), null)
  assert.equal(roomLockPhaseSfx('dormant', 'locked'), 'gate_close')
  assert.equal(roomLockPhaseSfx('locked', 'open'), 'gate_open')
  assert.equal(roomLockPhaseSfx('locked', 'locked'), null)
  assert.equal(breakableWallHitSfx(false), 'wall_crack')
  assert.equal(breakableWallHitSfx(true), 'wall_break')
})

test('off-screen mechanics are silent', () => {
  const view = { x: 100, y: 0, width: 448, height: 252 }
  const rail = areaAroundCentres([{ x: 700, y: 200, width: 56, height: 26 }])!
  assert.equal(isAreaAudible(rail, view), false)
  assert.equal(isAreaAudible({ ...rail, left: 560 }, view), true)
  assert.equal(isAreaAudible({ left: 40, right: 70, top: 10, bottom: 20 }, view), true, 'within the margin')
  assert.equal(areaAroundCentres([]), null)
})

test('every generated SFX has its seeded parameter set, and every parameter set a key', () => {
  const params = JSON.parse(readFileSync('assets/audio/sfx/generated/sfx-params.json', 'utf8')) as { sounds: Record<string, { file: string; seed: number }> }
  for (const [name, entry] of Object.entries(params.sounds)) {
    assert.ok(isSfxAssetKey(name), `sfx-params '${name}' is not an SFX key`)
    assert.equal(SFX_ASSETS[name as keyof typeof SFX_ASSETS].path, entry.file, `${name} renders to a different file than the library loads`)
    assert.ok(Number.isInteger(entry.seed), `${name} has no seed`)
  }
  for (const entry of Object.values(SFX_ASSETS)) {
    if (entry.path.includes('/generated/')) assert.ok(params.sounds[entry.key], `${entry.key} is generated but has no parameter set`)
  }
})

type FakeSound = { key: string; isPlaying: boolean; volume: number; duration: number; seek: number; playedWith?: unknown; play(config?: unknown): void; stop(): void; destroy(): void; setVolume(value: number): void }

function harness() {
  const cache = new Map<string, unknown>()
  const sounds: FakeSound[] = []
  const game = {
    cache: { audio: { exists: (key: string) => cache.has(key), add: (key: string, value: unknown) => cache.set(key, value), remove: (key: string) => cache.delete(key) } },
    sound: { context: { state: 'running', resume: async () => {}, decodeAudioData: async () => ({ length: 48000, numberOfChannels: 1 }) }, removeByKey: () => {} }
  }
  const scene = {
    game,
    cache: game.cache,
    sound: {
      add: (key: string) => {
        const sound: FakeSound = {
          key,
          isPlaying: false,
          volume: 1,
          duration: 32,
          seek: 0,
          play(config?: unknown) {
            this.isPlaying = true
            this.playedWith = config
          },
          stop() {
            this.isPlaying = false
          },
          destroy() {},
          setVolume(value: number) {
            this.volume = value
          }
        }
        sounds.push(sound)
        return sound
      }
    }
  }
  const originalFetch = globalThis.fetch
  const fetched: string[] = []
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url))
    return new Response(new Uint8Array(8))
  }) as typeof fetch
  const settle = async () => {
    for (let tick = 0; tick < 8; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  }
  const service = new PlaceholderAudioService()
  service.attachGame(game as never)
  service.unlock()
  return { service, scene: scene as never, cache, sounds, fetched, settle, restore: () => (globalThis.fetch = originalFetch) }
}

test('a stage id plays that stage\'s loop; a boss id decodes the boss loop with its phase-two track', async () => {
  const h = harness()
  try {
    h.service.playMusic(h.scene, 'stage', { stageId: 'pyro_maw' })
    await h.settle()
    assert.ok(h.fetched.some((url) => url.endsWith('generated/stage_pyro_maw.ogg')))
    assert.equal(h.sounds.at(-1)?.key, 'bgm_stage_pyro_maw')
    assert.equal(h.sounds.at(-1)?.isPlaying, true)

    h.service.playMusic(h.scene, 'boss', { bossId: 'pyro_maw' })
    await h.settle()
    const boss = h.sounds.at(-1)!
    assert.equal(boss.key, 'bgm_boss_pyro_maw')
    assert.equal(boss.isPlaying, true)
    assert.equal(h.service.getDebugState().musicPlayingCue, 'boss')
    // The phase-two partner is decoded with the boss loop; the stage loop is evicted.
    assert.deepEqual(h.service.getDebugState().residentMusicKeys.sort(), ['bgm_boss_pyro_maw', 'bgm_boss_pyro_maw_phase2'])
  } finally {
    h.restore()
  }
})

test('the phase change switches to the phase-two track at the same point in the song', async () => {
  const h = harness()
  try {
    h.service.playMusic(h.scene, 'boss', { bossId: 'glacier_ronin' })
    await h.settle()
    const base = h.sounds.at(-1)!
    base.seek = 40.5
    h.service.setMusicPhase(2)
    const phaseTwo = h.sounds.at(-1)!
    assert.equal(phaseTwo.key, 'bgm_boss_glacier_ronin_phase2')
    assert.equal(phaseTwo.isPlaying, true)
    assert.equal((phaseTwo.playedWith as { seek: number }).seek, 8.5, 'seek wraps into the 32s loop')
    // No tweens in this fake scene: the crossfade completes at once.
    assert.equal(base.isPlaying, false)
    assert.ok(phaseTwo.volume > 0)
    h.service.setMusicPhase(2)
    assert.equal(h.sounds.at(-1), phaseTwo, 'a second phase-two call is a no-op')
    // A cue without a phase-two track ignores the phase change.
    h.service.playMusic(h.scene, 'stage_select')
    await h.settle()
    const select = h.sounds.at(-1)!
    h.service.setMusicPhase(2)
    assert.equal(h.sounds.at(-1), select)
  } finally {
    h.restore()
  }
})
