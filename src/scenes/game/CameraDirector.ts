import type Phaser from 'phaser'
import { getCampaignStage } from '../../content/campaign'
import { getBossRoomCameraBounds } from '../../content/stageArenaLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import { Settings } from '../../systems/Settings'
import { tickHitstopFrames } from '../../player/config'
import { CONTACT_HIT_FEEL, isWeaknessContact, resolveShakeRequest, type ContactHitKind, type ShakeConfig } from '../../player/hitFeel'
import { initialCameraFollowState, stepCameraFollow, type CameraFollowState } from './cameraFollow'

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

/** The subset of a Phaser sprite the camera follow step reads: its live world position. */
export interface CameraFollowTarget {
  readonly x: number
  readonly y: number
}

/** The members of the Game scene that hit-stop, screen shake and camera bounds read and write. */
export interface CameraDirectorHost {
  readonly game: Phaser.Game
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager
  hitstopRemainingFrames: number
  bossRoomCameraLocked: boolean
  /** Read every tick for the facing look-ahead offset; 1 faces right, -1 faces left. */
  facing: 1 | -1
  activeBossRoom?: Parameters<typeof getBossRoomCameraBounds>[0] & { lockCamera?: boolean }
  newPlayerRuntime?: AnimationPausable
  enemySpawner?: AnimationPausable
  bossController?: AnimationPausable
}

/**
 * Hit-stop, screen shake and stage/boss-room camera bounds, moved out of `Game` unchanged in
 * behaviour (EVAL-P5-010, slice 5.0c). The hit-stop counter stays on the scene because smoke
 * scenarios reset `scene.hitstopRemainingFrames` directly.
 *
 * The hero follow itself (prompt 05 §5.3b, EVAL-P5-004 fix) no longer uses Phaser's
 * `startFollow`/`setDeadzone`/`setFollowOffset`: those compute their rectangle in canvas pixels
 * once a render scale is applied, which left the hero outside the frame at scale 2 (review BLOCK
 * on commit 610fe2c). `stepCameraFollow` (a pure, Phaser-free function) computes `scrollX`/`scrollY`
 * in game pixels every tick from the live bounds and view size, and this class only writes them.
 */
export class CameraDirector {
  readonly contactHits: HitFeelTraceEntry[] = []
  readonly hitstops: HitFeelTraceEntry[] = []
  private activeShakeIntensity = 0
  private followTarget?: CameraFollowTarget
  private followState: CameraFollowState = { anchorX: 0, anchorY: 0, lookAheadOffset: 0, scrollX: 0, scrollY: 0 }

  constructor(private readonly host: CameraDirectorHost) {}

  /**
   * Cancels any Phaser follow left over (defensive: nothing on the hero path calls `startFollow`
   * any more) and seeds the pure follow state from the hero's current position and facing.
   * `tickHitstop` below steps and writes `scrollX`/`scrollY` every frame from here on.
   */
  startFollowingPlayer(target: CameraFollowTarget): void {
    const host = this.host
    host.cameras.main.stopFollow()
    this.followTarget = target
    this.followState = initialCameraFollowState(
      target.x,
      target.y,
      host.facing,
      host.cameras.main.scrollX,
      host.cameras.main.scrollY
    )
  }

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
   * Runs once per `Game.update`. Hit-stop frames are authored at 60Hz and counted by real time, so
   * they last and converge the same at 30, 60 and 144fps; the camera step runs first (and every
   * frame, hit-stop or not: facing is just frozen while paused) so the hero never stalls out of
   * frame while everything else is stopped.
   */
  tickHitstop(): boolean {
    const host = this.host
    const deltaMs = host.game.loop.delta

    if (this.followTarget) {
      const camera = host.cameras.main
      const bounds = camera.getBounds()
      this.followState = stepCameraFollow(this.followState, {
        heroX: this.followTarget.x,
        heroY: this.followTarget.y,
        facing: host.facing,
        dtMs: deltaMs,
        viewWidth: camera.displayWidth,
        viewHeight: camera.displayHeight,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      })
      camera.scrollX = this.followState.scrollX
      camera.scrollY = this.followState.scrollY
    }

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
