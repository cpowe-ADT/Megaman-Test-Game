import type Phaser from 'phaser'
import { Settings, VOLUME_STEPS, type SettingsData } from '../systems/Settings'
import { getMusicAssetEntries, resolveMusicTrack, type MusicAssetDefinition, type MusicContext, type MusicCueId, type ResolvedMusicTrack } from './musicLibrary'
import { MusicTrackLoader } from './MusicTrackLoader'
import { musicKeysToEvict } from './musicResidency'
import { SFX_ASSETS, resolveSfxKey, type SfxAssetKey } from './sfxLibrary'

/** Development builds (and smoke, which runs the dev server) throw on an SFX key with no sound. */
const STRICT_SFX_KEYS = Boolean(import.meta.env?.DEV)
/** Boss phase changes crossfade between the boss track and its phase-two track over this long. */
export const MUSIC_PHASE_CROSSFADE_MS = 600

type MusicSound = Phaser.Sound.BaseSound & { setVolume?: (value: number) => unknown; seek?: number }

type SfxSequenceStep = {
  freq: number
  durationMs: number
  type?: OscillatorType
  gain?: number
}

/** Exported for tests (tests/music-service.test.ts); the game uses the `AudioService` singleton. */
export class PlaceholderAudioService {
  private context?: AudioContext
  private noiseBuffer?: AudioBuffer
  private activeNodes = new Set<AudioNode>()
  private enabled = true
  private unlocked = false
  private currentMusic?: Phaser.Sound.BaseSound
  private currentMusicCue?: MusicCueId
  private requestedMusicCue?: MusicCueId
  private currentTrack?: ResolvedMusicTrack
  private requestedTrack?: ResolvedMusicTrack
  private fadingMusic?: Phaser.Sound.BaseSound
  private musicPhase: 1 | 2 = 1
  private musicScene?: Phaser.Scene
  private musicGame?: Phaser.Game
  private game?: Phaser.Game
  private readonly musicLoader = new MusicTrackLoader()
  private musicVolumeScale = 1
  private sfxVolumeScale = 1
  private musicVolumeStep = VOLUME_STEPS
  private sfxVolumeStep = VOLUME_STEPS
  private currentMusicBaseVolume = 1

  constructor() {
    this.applySettings(Settings.get())
    Settings.onChange((settings) => this.applySettings(settings))
  }

  /** Reads the device volume steps; live music follows immediately. */
  applySettings(settings: Pick<SettingsData, 'musicVolume' | 'sfxVolume'>): void {
    this.musicVolumeStep = settings.musicVolume
    this.sfxVolumeStep = settings.sfxVolume
    this.musicVolumeScale = settings.musicVolume / VOLUME_STEPS
    this.sfxVolumeScale = settings.sfxVolume / VOLUME_STEPS
    const music = this.currentMusic as (Phaser.Sound.BaseSound & { setVolume?: (value: number) => unknown }) | undefined
    music?.setVolume?.(this.currentMusicBaseVolume * this.musicVolumeScale)
  }

  /**
   * Shares Phaser's AudioContext for the synthesized fallback blips and the unlock state. Before this the
   * service built its own context, so two audio render threads ran for the whole session.
   */
  attachGame(game: Phaser.Game): void {
    this.game = game
  }

  unlock(): void {
    const context = this.ensureContext()
    if (!context) {
      this.unlocked = true
    } else if (context.state === 'suspended') {
      void context.resume().then(() => {
        this.unlocked = context.state === 'running'
        if (this.unlocked) {
          this.startRequestedMusic()
        }
      }).catch(() => {
        this.unlocked = false
      })
      return
    } else {
      this.unlocked = context.state === 'running'
    }

    if (this.musicScene) {
      try {
        const phaserContext = (this.musicScene.sound as Phaser.Sound.WebAudioSoundManager | undefined)?.context
        if (phaserContext?.state === 'suspended') {
          void phaserContext.resume().catch(() => {
            // Ignore browser audio resume failures and fall back to requested state tracking.
          })
        }
      } catch {
        // Ignore Phaser audio backend resume failures.
      }
    }

    if (this.unlocked) {
      this.startRequestedMusic()
    }
  }

  playSfx(key: string): void {
    if (!this.enabled || !key) {
      return
    }

    const normalized = resolveSfxKey(key, STRICT_SFX_KEYS)
    if (!normalized) {
      return
    }

    if (this.playLoadedSfx(normalized)) {
      return
    }

    const context = this.ensureContext()
    if (!context || context.state !== 'running') {
      return
    }

    switch (normalized) {
      case 'ui_confirm':
        this.playSequence([
          { freq: 620, durationMs: 36, type: 'square', gain: 0.025 },
          { freq: 820, durationMs: 58, type: 'square', gain: 0.03 }
        ])
        break
      case 'ui_cancel':
        this.playSequence([
          { freq: 620, durationMs: 44, type: 'square', gain: 0.025 },
          { freq: 420, durationMs: 62, type: 'square', gain: 0.03 }
        ])
        break
      case 'ui_move':
        this.playSequence([{ freq: 460, durationMs: 28, type: 'sine', gain: 0.015 }])
        break
      case 'pickup_health':
        this.playSequence([
          { freq: 520, durationMs: 34, type: 'triangle', gain: 0.02 },
          { freq: 700, durationMs: 46, type: 'triangle', gain: 0.024 }
        ])
        break
      case 'pickup_ammo':
        this.playSequence([
          { freq: 420, durationMs: 34, type: 'square', gain: 0.018 },
          { freq: 620, durationMs: 52, type: 'square', gain: 0.022 }
        ])
        break
      case 'pickup_bonus':
        this.playSequence([
          { freq: 560, durationMs: 28, type: 'triangle', gain: 0.02 },
          { freq: 760, durationMs: 34, type: 'triangle', gain: 0.024 },
          { freq: 920, durationMs: 42, type: 'triangle', gain: 0.028 }
        ])
        break
      case 'pause_open':
        this.playSequence([
          { freq: 420, durationMs: 28, type: 'triangle', gain: 0.018 },
          { freq: 320, durationMs: 42, type: 'triangle', gain: 0.02 }
        ])
        break
      case 'pause_resume':
        this.playSequence([
          { freq: 360, durationMs: 28, type: 'triangle', gain: 0.018 },
          { freq: 520, durationMs: 42, type: 'triangle', gain: 0.02 }
        ])
        break
      case 'jump':
        this.playSequence([
          { freq: 360, durationMs: 28, type: 'square', gain: 0.018 },
          { freq: 510, durationMs: 52, type: 'square', gain: 0.022 }
        ])
        break
      case 'land':
        this.playSequence([
          { freq: 240, durationMs: 26, type: 'triangle', gain: 0.02 },
          { freq: 180, durationMs: 40, type: 'triangle', gain: 0.018 }
        ])
        break
      case 'dash':
        this.playSequence([
          { freq: 290, durationMs: 22, type: 'sawtooth', gain: 0.016 },
          { freq: 430, durationMs: 30, type: 'sawtooth', gain: 0.018 }
        ])
        break
      case 'sword_swing':
        this.playSequence([
          { freq: 620, durationMs: 18, type: 'triangle', gain: 0.014 },
          { freq: 400, durationMs: 42, type: 'sawtooth', gain: 0.02 }
        ])
        break
      case 'sword_hit':
        this.playNoiseBurst(65, 0.03, 1500)
        break
      case 'charge_start':
        this.playSequence([
          { freq: 210, durationMs: 40, type: 'sine', gain: 0.014 },
          { freq: 320, durationMs: 60, type: 'triangle', gain: 0.018 }
        ])
        break
      case 'charge_loop':
        this.playSequence([{ freq: 460, durationMs: 48, type: 'triangle', gain: 0.014 }])
        break
      case 'shot_basic':
        this.playSequence([{ freq: 300, durationMs: 44, type: 'square', gain: 0.022 }])
        break
      case 'shot_charge_lv1':
        this.playSequence([
          { freq: 260, durationMs: 40, type: 'sawtooth', gain: 0.02 },
          { freq: 380, durationMs: 70, type: 'sawtooth', gain: 0.025 }
        ])
        break
      case 'shot_charge_lv2':
        this.playSequence([
          { freq: 240, durationMs: 44, type: 'sawtooth', gain: 0.024 },
          { freq: 420, durationMs: 84, type: 'sawtooth', gain: 0.03 }
        ])
        break
      case 'shot_charge_lv3':
        this.playSequence([
          { freq: 220, durationMs: 46, type: 'sawtooth', gain: 0.028 },
          { freq: 470, durationMs: 92, type: 'sawtooth', gain: 0.035 }
        ])
        break
      case 'shot_charge_lv4':
        this.playSequence([
          { freq: 200, durationMs: 50, type: 'sawtooth', gain: 0.03 },
          { freq: 520, durationMs: 110, type: 'sawtooth', gain: 0.038 }
        ])
        break
      case 'player_hit':
      case 'boss_hit':
      case 'enemy_hit':
        this.playNoiseBurst(85, 0.028, 1800)
        break
      case 'boss_activate':
        this.playSequence([
          { freq: 220, durationMs: 60, type: 'triangle', gain: 0.02 },
          { freq: 320, durationMs: 72, type: 'triangle', gain: 0.024 },
          { freq: 420, durationMs: 86, type: 'triangle', gain: 0.028 }
        ])
        break
      case 'stage_clear':
        this.playSequence([
          { freq: 440, durationMs: 56, type: 'triangle', gain: 0.024 },
          { freq: 660, durationMs: 66, type: 'triangle', gain: 0.028 },
          { freq: 880, durationMs: 96, type: 'triangle', gain: 0.032 }
        ])
        break
      case 'game_over':
        this.playSequence([
          { freq: 420, durationMs: 66, type: 'triangle', gain: 0.024 },
          { freq: 280, durationMs: 76, type: 'triangle', gain: 0.028 },
          { freq: 180, durationMs: 120, type: 'triangle', gain: 0.032 }
        ])
        break
      default:
        this.playSequence([{ freq: 360, durationMs: 36, type: 'sine', gain: 0.018 }])
        break
    }
  }

  stopAll(): void {
    this.stopMusic()
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          ;(node as AudioScheduledSourceNode).stop()
        }
      } catch {
        // Audio node may already be stopped or disconnected.
      }

      try {
        node.disconnect()
      } catch {
        // ignore
      }
    })
    this.activeNodes.clear()
  }

  /**
   * Plays a cue's track. `context` picks the stage's or boss's own track (musicLibrary.resolveMusicTrack);
   * without it the cue plays its shared track.
   */
  playMusic(scene: Phaser.Scene, cue: MusicCueId, context?: MusicContext): void {
    this.musicScene = scene
    this.musicGame = scene.game
    this.requestedMusicCue = cue
    this.requestedTrack = resolveMusicTrack(cue, context)
    // Decode now even while audio is locked, so the track is ready the moment the player unlocks it.
    this.ensureMusicLoaded(this.requestedTrack)
    if (!this.unlocked) {
      return
    }
    this.startRequestedMusic()
  }

  stopMusic(): void {
    this.requestedMusicCue = undefined
    this.currentMusicCue = undefined
    this.requestedTrack = undefined
    this.currentTrack = undefined
    this.musicPhase = 1
    this.releaseSound(this.fadingMusic)
    this.fadingMusic = undefined
    if (!this.currentMusic) {
      return
    }
    this.releaseSound(this.currentMusic)
    this.currentMusic = undefined
  }

  /**
   * The boss phase change: crossfades (MUSIC_PHASE_CROSSFADE_MS) from the boss track to its phase-two track
   * at the same point in the song, or back for phase 1. No-op when the playing track has no phase-two track.
   */
  setMusicPhase(phase: 1 | 2): void {
    const track = this.currentTrack
    const scene = this.musicScene
    const current = this.currentMusic as MusicSound | undefined
    if (!track?.phaseTwo || !scene || !current || this.musicPhase === phase) {
      return
    }
    const target: MusicAssetDefinition = phase === 2 ? track.phaseTwo : track
    if (!scene.cache.audio.exists(target.key)) {
      return
    }
    const duration = Number(current.duration) || 0
    const seek = duration > 0 ? (Number(current.seek) || 0) % duration : 0
    let next: MusicSound
    try {
      next = scene.sound.add(target.key, { loop: true, volume: 0 }) as MusicSound
      next.play({ seek, loop: true, volume: 0 })
    } catch {
      return
    }
    this.musicPhase = phase
    this.releaseSound(this.fadingMusic)
    this.fadingMusic = current
    this.currentMusic = next
    const fromVolume = this.currentMusicBaseVolume * this.musicVolumeScale
    this.currentMusicBaseVolume = target.volume
    const finish = () => {
      if (this.fadingMusic === current) {
        this.fadingMusic = undefined
      }
      this.releaseSound(current)
      next.setVolume?.(this.currentMusicBaseVolume * this.musicVolumeScale)
    }
    const tweens = (scene as Partial<Phaser.Scene>).tweens
    if (!tweens) {
      finish()
      return
    }
    tweens.addCounter({
      from: 0,
      to: 1,
      duration: MUSIC_PHASE_CROSSFADE_MS,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0
        current.setVolume?.(fromVolume * (1 - t))
        next.setVolume?.(this.currentMusicBaseVolume * this.musicVolumeScale * t)
      },
      onComplete: finish
    })
  }

  private releaseSound(sound: Phaser.Sound.BaseSound | undefined): void {
    if (!sound) {
      return
    }
    try {
      sound.stop()
      sound.destroy()
    } catch {
      // Ignore Phaser sound teardown failures during scene transitions.
    }
  }

  onSceneShutdown(scene: Phaser.Scene): void {
    if (this.musicScene === scene) {
      this.musicScene = undefined
      this.stopMusic()
    }
  }

  getDebugState(): {
    enabled: boolean
    unlocked: boolean
    musicCue: MusicCueId | null
    musicPlayingCue: MusicCueId | null
    musicLoading: boolean
    residentMusicKeys: string[]
    musicVolume: number
    sfxVolume: number
  } {
    return {
      enabled: this.enabled,
      unlocked: this.unlocked,
      // The cue the game asked for; while its track decodes the previous one may still be playing.
      musicCue: this.requestedMusicCue ?? this.currentMusicCue ?? null,
      musicPlayingCue: this.currentMusicCue ?? null,
      musicLoading: this.musicLoader.isLoading(),
      residentMusicKeys: this.residentMusicKeys(),
      musicVolume: this.musicVolumeStep,
      sfxVolume: this.sfxVolumeStep
    }
  }

  private residentMusicKeys(): string[] {
    const game = this.musicGame
    if (!game) {
      return []
    }
    return getMusicAssetEntries()
      .map((entry) => entry.key)
      .filter((key) => game.cache.audio.exists(key))
  }

  private ensureMusicLoaded(track: ResolvedMusicTrack): void {
    const game = this.musicGame
    const missing = trackAssets(track).filter((asset) => !game?.cache.audio.exists(asset.key))
    if (!game || missing.length === 0) {
      return
    }
    // Free tracks nothing will play before decoding another one.
    this.evictIdleMusic()
    void Promise.all(missing.map((asset) => this.musicLoader.load(game, asset))).then((loaded) => {
      if (loaded.every(Boolean) && this.unlocked && this.requestedTrack?.key === track.key) {
        this.startRequestedMusic()
      } else {
        // The cue moved on while this track decoded (a boss dies mid-load): do not keep it resident.
        this.evictIdleMusic()
      }
    })
  }

  private evictIdleMusic(): void {
    const game = this.musicGame
    if (!game) {
      return
    }
    const playingKey = this.currentMusic?.key ?? null
    const requestedKey = this.requestedTrack?.key ?? null
    const alsoKeep = [this.fadingMusic?.key, this.currentTrack?.key, this.currentTrack?.phaseTwo?.key, this.requestedTrack?.phaseTwo?.key]
    musicKeysToEvict(this.residentMusicKeys(), playingKey, requestedKey, alsoKeep).forEach((key) => this.musicLoader.evict(game, key))
  }

  private playLoadedSfx(key: SfxAssetKey): boolean {
    const scene = this.musicScene
    if (!scene || !this.unlocked || !scene.cache.audio.exists(key)) {
      return false
    }

    const asset = SFX_ASSETS[key]
    if (!asset) {
      return false
    }

    try {
      scene.sound.play(asset.key, {
        volume: asset.volume * this.sfxVolumeScale,
        rate: asset.rate,
        detune: asset.detune
      })
      return true
    } catch {
      return false
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (typeof window === 'undefined') {
      return undefined
    }

    const shared = ((this.game ?? this.musicGame)?.sound as Partial<Phaser.Sound.WebAudioSoundManager> | undefined)?.context
    if (shared) {
      if (this.context !== shared) {
        this.context = shared
        this.noiseBuffer = undefined
        this.unlocked = shared.state === 'running'
      }
      return shared
    }

    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) {
      return undefined
    }

    if (!this.context) {
      try {
        this.context = new AudioContextCtor()
        this.unlocked = this.context.state === 'running'
      } catch {
        this.context = undefined
      }
    }

    return this.context
  }

  private startRequestedMusic(): void {
    const cue = this.requestedMusicCue
    const asset = this.requestedTrack
    const scene = this.musicScene
    if (!cue || !asset || !scene || !this.enabled) {
      return
    }
    if (trackAssets(asset).some((entry) => !scene.cache.audio.exists(entry.key))) {
      // Not decoded yet: the previous track keeps playing and this cue starts when its load resolves.
      this.musicGame = scene.game
      this.ensureMusicLoaded(asset)
      return
    }

    if (this.currentMusicCue === cue && this.currentTrack?.key === asset.key && this.currentMusic?.isPlaying) {
      return
    }

    this.stopMusic()
    this.requestedMusicCue = cue
    this.requestedTrack = asset
    this.currentMusicCue = cue
    this.currentTrack = asset

    try {
      this.currentMusicBaseVolume = asset.volume
      const sound = scene.sound.add(asset.key, {
        loop: true,
        volume: asset.volume * this.musicVolumeScale
      })
      this.currentMusic = sound
      sound.play()
    } catch {
      this.currentMusic = undefined
    }
    this.evictIdleMusic()
  }

  private playSequence(steps: SfxSequenceStep[]): void {
    const context = this.ensureContext()
    if (!context || context.state !== 'running') {
      return
    }

    let cursor = context.currentTime
    for (const step of steps) {
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()
      oscillator.type = step.type ?? 'square'
      oscillator.frequency.setValueAtTime(step.freq, cursor)

      const duration = Math.max(0.015, step.durationMs / 1000)
      const attack = Math.min(0.01, duration * 0.35)
      const releaseStart = cursor + Math.max(attack, duration * 0.6)
      const gain = step.gain ?? 0.02

      gainNode.gain.setValueAtTime(0.0001, cursor)
      gainNode.gain.exponentialRampToValueAtTime(gain, cursor + attack)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + duration)

      oscillator.connect(gainNode)
      gainNode.connect(context.destination)
      this.trackNode(oscillator)
      this.trackNode(gainNode)
      oscillator.start(cursor)
      oscillator.stop(cursor + duration)
      cursor = releaseStart + duration * 0.15
    }
  }

  private playNoiseBurst(durationMs: number, gain: number, filterHz: number): void {
    const context = this.ensureContext()
    if (!context || context.state !== 'running') {
      return
    }

    const source = context.createBufferSource()
    source.buffer = this.getNoiseBuffer(context)

    const filter = context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(filterHz, context.currentTime)

    const gainNode = context.createGain()
    const duration = Math.max(0.04, durationMs / 1000)
    gainNode.gain.setValueAtTime(gain, context.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)

    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(context.destination)

    this.trackNode(source)
    this.trackNode(filter)
    this.trackNode(gainNode)

    source.start()
    source.stop(context.currentTime + duration)
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) {
      return this.noiseBuffer
    }

    const sampleRate = context.sampleRate
    const frameCount = Math.max(1, Math.floor(sampleRate * 0.25))
    const buffer = context.createBuffer(1, frameCount, sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = Math.random() * 2 - 1
    }
    this.noiseBuffer = buffer
    return buffer
  }

  private trackNode(node: AudioNode): void {
    this.activeNodes.add(node)
    const cleanup = () => {
      this.activeNodes.delete(node)
      try {
        node.disconnect()
      } catch {
        // ignore
      }
    }

    if ('onended' in node) {
      ;(node as AudioScheduledSourceNode).onended = cleanup
      return
    }

    window.setTimeout(cleanup, 250)
  }
}

export const AudioService = new PlaceholderAudioService()
export default AudioService

/** The files a track needs decoded before it starts: the track, and a boss track's phase-two partner. */
function trackAssets(track: ResolvedMusicTrack): MusicAssetDefinition[] {
  return track.phaseTwo ? [track, track.phaseTwo] : [track]
}
