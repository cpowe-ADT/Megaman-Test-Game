// The audio service's on-demand music, end to end with a fake Phaser game and a fetch whose responses the
// test releases by hand, so cue changes can land mid-decode. Guards the wiring, not just the pure rule:
// deleting the late-decode eviction or the "previous track plays on" behaviour fails here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PlaceholderAudioService } from '../src/audio/PlaceholderAudioService'

type FakeSound = { key: string; isPlaying: boolean; play(): void; stop(): void; destroy(): void; setVolume(): void }

function harness() {
  const cache = new Map<string, unknown>()
  const sounds: FakeSound[] = []
  const game = {
    cache: { audio: { exists: (key: string) => cache.has(key), add: (key: string, value: unknown) => cache.set(key, value), remove: (key: string) => cache.delete(key) } },
    sound: {
      context: { state: 'running', resume: async () => {}, decodeAudioData: async () => ({ length: 48000, numberOfChannels: 2 }) },
      removeByKey: () => {}
    }
  }
  const scene = {
    game,
    cache: game.cache,
    sound: {
      add: (key: string) => {
        const sound: FakeSound = {
          key,
          isPlaying: false,
          play() { this.isPlaying = true },
          stop() { this.isPlaying = false },
          destroy() {},
          setVolume() {}
        }
        sounds.push(sound)
        return sound
      }
    }
  }
  const pending = new Map<string, () => void>()
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((url: string) =>
    new Promise<Response>((resolve) => {
      pending.set(String(url), () => resolve(new Response(new Uint8Array(8))))
    })) as typeof fetch
  const release = async (fragment: string) => {
    const url = [...pending.keys()].find((key) => key.includes(fragment))
    assert.ok(url, `a fetch for ${fragment} is pending`)
    pending.get(url!)!()
    pending.delete(url!)
    for (let tick = 0; tick < 6; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  }
  const service = new PlaceholderAudioService()
  service.attachGame(game as never)
  service.unlock()
  return { service, scene: scene as never, cache, sounds, release, restore: () => (globalThis.fetch = originalFetch) }
}

test('the previous track plays on while the next cue decodes, then is evicted', async () => {
  const h = harness()
  try {
    h.service.playMusic(h.scene, 'stage')
    await h.release('stage_loop')
    assert.equal(h.service.getDebugState().musicPlayingCue, 'stage')

    h.service.playMusic(h.scene, 'boss')
    const loading = h.service.getDebugState()
    assert.equal(loading.musicCue, 'boss', 'the requested cue is reported at once')
    assert.equal(loading.musicPlayingCue, 'stage', 'the stage track keeps playing while the boss track decodes')
    assert.equal(loading.musicLoading, true)

    await h.release('boss_loop')
    const settled = h.service.getDebugState()
    assert.equal(settled.musicPlayingCue, 'boss')
    assert.deepEqual(settled.residentMusicKeys, ['bgm_boss_loop'], 'only the playing track stays decoded')
  } finally {
    h.restore()
  }
})

test('a decode that lands after its cue moved on is evicted, not kept (58MB boss loop through Stage Select)', async () => {
  const h = harness()
  try {
    h.service.playMusic(h.scene, 'boss')
    h.service.stopMusic()
    h.service.playMusic(h.scene, 'stage_select')
    await h.release('stage_select')
    assert.equal(h.service.getDebugState().musicPlayingCue, 'stage_select')

    await h.release('boss_loop')
    const state = h.service.getDebugState()
    assert.equal(state.musicPlayingCue, 'stage_select')
    assert.deepEqual(state.residentMusicKeys, ['bgm_stage_select'], 'the late boss decode must not stay resident')
    assert.equal(h.cache.has('bgm_boss_loop'), false)
  } finally {
    h.restore()
  }
})
