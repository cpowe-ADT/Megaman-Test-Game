import type Phaser from 'phaser'
import { getCampaignStage } from '../../content/campaign'
import { getBossRoomCameraBounds } from '../../content/stageArenaLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import { Settings } from '../../systems/Settings'
import { tickHitstopFrames, timeScaledLerp } from '../../player/config'
import { CONTACT_HIT_FEEL, isWeaknessContact, resolveShakeRequest, type ContactHitKind, type ShakeConfig } from '../../player/hitFeel'

/** Camera follow lerp per 60Hz frame, as passed to `startFollow` in `Game.create`. */
const FOLLOW_LERP_PER_FRAME = 0.1

/** Plain-value clamp so this module has no runtime dependency on Phaser (`Phaser.Math.Clamp`). */
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Recent hit-stops and the contact hits that caused them, newest last (smoke 24 reads both). */
export interface HitFeelTraceEntry {
  kind: ContactHitKind | 'player_hit' | 'other'
  frames: number
  atMs: number
}
const HIT_FEEL_TRACE_LIMIT = 16

interface AnimationPausable {
  pauseAnimations?(): void
  resumeAnimations?(): void
}

/** The members of the Game scene that hit-stop, screen shake and camera bounds read and write. */
export interface CameraDirectorHost {
  readonly game: Phaser.Game
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager
  hitstopRemainingFrames: number
  bossRoomCameraLocked: boolean
  activeBossRoom?: Parameters<typeof getBossRoomCameraBounds>[0] & { lockCamera?: boolean }
  newPlayerRuntime?: AnimationPausable
  enemySpawner?: AnimationPausable
  bossController?: AnimationPausable
}

/**
 * Hit-stop, screen shake and stage/boss-room camera bounds, moved out of `Game` unchanged in
 * behaviour (EVAL-P5-010, slice 5.0c). The hit-stop counter stays on the scene because smoke
 * scenarios reset `scene.hitstopRemainingFrames` directly.
 */
export class CameraDirector {
  readonly contactHits: HitFeelTraceEntry[] = []
  readonly hitstops: HitFeelTraceEntry[] = []
  private activeShakeIntensity = 0

  constructor(private readonly host: CameraDirectorHost) {}

  /**
   * The only source of hit-stop for attacks: called from the sword-hit and projectile-impact paths
   * after a target was hit (prompt 05 §5.2 item 1). `hitstopFrames` overrides the table (sword windows).
   */
  onContactHit(kind: ContactHitKind, hitstopFrames?: number): void {
    const feel = CONTACT_HIT_FEEL[kind]
    const frames = Math.max(0, hitstopFrames ?? feel.hitstopFrames)
    this.trace(this.contactHits, { kind, frames, atMs: this.nowMs() })
    if (frames > 0) {
      this.onHitstop(frames, kind)
    }
    if (feel.shake) {
      this.onCameraShake(feel.shake)
    }
  }

  /** Boss damage landed: the weakness hit-stop fires only when damage was applied at a weakness multiplier. */
  onBossHit(multiplier: number, amountApplied: number): void {
    if (isWeaknessContact(multiplier, amountApplied)) {
      this.onContactHit('boss_weakness')
    }
  }

  onHitstop(frames: number, kind: HitFeelTraceEntry['kind'] = 'other'): void {
    const host = this.host
    this.trace(this.hitstops, { kind, frames, atMs: this.nowMs() })
    host.hitstopRemainingFrames = Math.max(host.hitstopRemainingFrames, frames)
    host.physics.world.pause()
    host.newPlayerRuntime?.pauseAnimations?.()
    host.enemySpawner?.pauseAnimations?.()
    host.bossController?.pauseAnimations?.()
  }

  /** Capped at the heavy budget and never stacked: a weaker shake during a running one is dropped. */
  onCameraShake(config: ShakeConfig): void {
    const host = this.host
    if (!Settings.get().screenShake) return
    const camera = host.cameras.main
    const running = Boolean((camera as { shakeEffect?: { isRunning?: boolean } }).shakeEffect?.isRunning)
    const shake = resolveShakeRequest(config, { running, intensity: this.activeShakeIntensity })
    if (!shake) return
    this.activeShakeIntensity = shake.intensity
    // Shake amplitude is intensity * canvas width * zoom; the HD canvas is already zoom times wider.
    camera.shake(shake.duration, shake.intensity / Math.max(1, camera.zoom), true)
  }

  private nowMs(): number {
    return Number(this.host.game?.loop?.time ?? 0)
  }

  private trace(list: HitFeelTraceEntry[], entry: HitFeelTraceEntry): void {
    list.push(entry)
    if (list.length > HIT_FEEL_TRACE_LIMIT) {
      list.shift()
    }
  }

  applyStageCameraBounds(stageId: string): void {
    const host = this.host
    const stage = getCampaignStage(stageId)
    const worldWidth = Math.max(GAME_WIDTH, Number(stage.arena.width ?? GAME_WIDTH))
    host.cameras.main.setBounds(0, 0, worldWidth, GAME_HEIGHT)
    host.bossRoomCameraLocked = false
  }

  applyBossRoomCameraLock(): void {
    const host = this.host
    if (!host.activeBossRoom?.lockCamera) {
      return
    }
    const bounds = getBossRoomCameraBounds(host.activeBossRoom, GAME_HEIGHT)
    host.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height)
    host.cameras.main.scrollX = clampNumber(
      host.cameras.main.scrollX,
      bounds.x,
      bounds.x + bounds.width - host.cameras.main.width
    )
    host.bossRoomCameraLocked = true
  }

  /**
   * Runs once per `Game.update`. Hit-stop frames and the follow lerp are authored at 60Hz and
   * counted by real time, so they last and converge the same at 30, 60 and 144fps.
   */
  tickHitstop(): boolean {
    const host = this.host
    const deltaMs = host.game.loop.delta
    const lerp = timeScaledLerp(FOLLOW_LERP_PER_FRAME, deltaMs)
    host.cameras.main?.setLerp(lerp, lerp)
    if (host.hitstopRemainingFrames > 0) {
      host.hitstopRemainingFrames = tickHitstopFrames(host.hitstopRemainingFrames, deltaMs)
      if (host.hitstopRemainingFrames <= 0) {
        host.physics.world.resume()
        host.newPlayerRuntime?.resumeAnimations?.()
        host.enemySpawner?.resumeAnimations?.()
        host.bossController?.resumeAnimations?.()
      }
      return true
    }
    return false
  }
}
