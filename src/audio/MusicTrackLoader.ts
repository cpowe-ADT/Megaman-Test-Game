import type Phaser from 'phaser'
import type { MusicAssetDefinition } from './musicLibrary'

type MusicGame = Pick<Phaser.Game, 'cache' | 'sound'>

/**
 * Fetches and decodes one music track into Phaser's audio cache when its cue is first asked for,
 * instead of every track at boot. Concurrent requests for the same key share one job. Eviction is
 * the caller's decision (see musicResidency.ts); `evict` removes the sounds and the decoded buffer.
 */
export class MusicTrackLoader {
  private readonly pending = new Map<string, Promise<boolean>>()

  isLoading(): boolean {
    return this.pending.size > 0
  }

  load(game: MusicGame, asset: MusicAssetDefinition): Promise<boolean> {
    if (game.cache.audio.exists(asset.key)) {
      return Promise.resolve(true)
    }
    const existing = this.pending.get(asset.key)
    if (existing) {
      return existing
    }
    const context = (game.sound as Partial<Phaser.Sound.WebAudioSoundManager>).context
    if (!context || typeof fetch !== 'function') {
      // No Web Audio (or no fetch): music stays off rather than blocking the game.
      return Promise.resolve(false)
    }

    const job = fetch(asset.path)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.arrayBuffer()
      })
      .then((bytes) => context.decodeAudioData(bytes))
      .then((buffer) => {
        if (!game.cache.audio.exists(asset.key)) {
          game.cache.audio.add(asset.key, buffer)
        }
        return true
      })
      .catch((error: unknown) => {
        console.warn(`[audio] music '${asset.key}' could not load from ${asset.path}`, error)
        return false
      })
      .finally(() => {
        this.pending.delete(asset.key)
      })
    this.pending.set(asset.key, job)
    return job
  }

  evict(game: MusicGame, key: string): void {
    game.sound.removeByKey(key)
    game.cache.audio.remove(key)
  }
}
