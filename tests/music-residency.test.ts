import test from 'node:test'
import assert from 'node:assert/strict'
import { decodedAudioBytes, musicKeysToEvict } from '../src/audio/musicResidency'
import { MusicTrackLoader } from '../src/audio/MusicTrackLoader'

test('only the playing track and the requested track stay decoded', () => {
  const resident = ['bgm_stage_select', 'bgm_stage_loop', 'bgm_boss_loop']
  // Boss requested while the stage loop still plays: both stay, the select track goes.
  assert.deepEqual(musicKeysToEvict(resident, 'bgm_stage_loop', 'bgm_boss_loop'), ['bgm_stage_select'])
  // Boss now playing: everything else goes.
  assert.deepEqual(musicKeysToEvict(resident, 'bgm_boss_loop', 'bgm_boss_loop'), ['bgm_stage_select', 'bgm_stage_loop'])
  // Music stopped between scenes, Stage Select asked for its track: the stage and boss tracks go.
  assert.deepEqual(musicKeysToEvict(resident, null, 'bgm_stage_select'), ['bgm_stage_loop', 'bgm_boss_loop'])
  // Nothing playing and nothing asked for: nothing stays.
  assert.deepEqual(musicKeysToEvict(resident, undefined, undefined), resident)
})

test('decoded size is four bytes per sample per channel', () => {
  // 152s stereo at 48kHz, the boss loop: about 58MB held while it plays.
  assert.equal(decodedAudioBytes({ length: 152 * 48000, numberOfChannels: 2 }), 58_368_000)
})

function fakeGame() {
  const cache = new Map<string, unknown>()
  const removedSounds: string[] = []
  let decodes = 0
  const game = {
    cache: {
      audio: {
        exists: (key: string) => cache.has(key),
        add: (key: string, value: unknown) => cache.set(key, value),
        remove: (key: string) => cache.delete(key)
      }
    },
    sound: {
      context: {
        decodeAudioData: async (bytes: ArrayBuffer) => {
          decodes += 1
          return { length: bytes.byteLength, numberOfChannels: 2 }
        }
      },
      removeByKey: (key: string) => removedSounds.push(key)
    }
  }
  return { game: game as never, cache, removedSounds, decodes: () => decodes }
}

test('the loader decodes a track once, shares concurrent requests, and evicts on request', async () => {
  const originalFetch = globalThis.fetch
  let fetches = 0
  globalThis.fetch = (async () => {
    fetches += 1
    return new Response(new Uint8Array(16))
  }) as typeof fetch
  try {
    const { game, cache, removedSounds, decodes } = fakeGame()
    const loader = new MusicTrackLoader()
    const asset = { key: 'bgm_stage_loop', path: 'assets/audio/music/stage_loop.ogg', volume: 0.34 }
    const [first, second] = await Promise.all([loader.load(game, asset), loader.load(game, asset)])
    assert.equal(first, true)
    assert.equal(second, true)
    assert.equal(fetches, 1, 'two requests for one key share a single fetch')
    assert.equal(decodes(), 1)
    assert.equal(cache.has('bgm_stage_loop'), true)
    assert.equal(loader.isLoading(), false)
    assert.equal(await loader.load(game, asset), true)
    assert.equal(fetches, 1, 'a resident track is not fetched again')

    loader.evict(game, 'bgm_stage_loop')
    assert.equal(cache.has('bgm_stage_loop'), false)
    assert.deepEqual(removedSounds, ['bgm_stage_loop'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a failed fetch leaves music off without throwing', async () => {
  const originalFetch = globalThis.fetch
  const originalWarn = console.warn
  globalThis.fetch = (async () => new Response('missing', { status: 404 })) as typeof fetch
  console.warn = () => {}
  try {
    const { game, cache } = fakeGame()
    const loaded = await new MusicTrackLoader().load(game, { key: 'bgm_boss_loop', path: 'missing.ogg', volume: 0.3 })
    assert.equal(loaded, false)
    assert.equal(cache.has('bgm_boss_loop'), false)
  } finally {
    globalThis.fetch = originalFetch
    console.warn = originalWarn
  }
})
