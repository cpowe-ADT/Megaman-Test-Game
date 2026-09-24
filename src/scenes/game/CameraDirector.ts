import type Phaser from 'phaser'
import { getCampaignStage } from '../../content/campaign'
import { getBossRoomCameraBounds } from '../../content/stageArenaLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import {
  CAMERA_FACING_LOOK_AHEAD_PX,
  CAMERA_FOLLOW_DEADZONE_X,
  CAMERA_FOLLOW_DEADZONE_Y_LOCKED,
  CAMERA_FOLLOW_DEADZONE_Y_SCROLLING
} from '../../config/gameplayLayout'
import { Settings } from '../../systems/Settings'
import { tickHitstopFrames, timeScaledLerp } from '../../player/config'
import { CONTACT_HIT_FEEL, isWeaknessContact, resolveShakeRequest, type ContactHitKind, type ShakeConfig } from '../../player/hitFeel'

/** Camera follow lerp per 60Hz frame (prompt 05 §5.3): x leads faster than y so a vertical bump
 *  on flat ground barely moves the camera, and the look-ahead tween below reuses the x constant
 *  so there is one shared time-scaled rate instead of a second tunable. */
const FOLLOW_LERP_X_PER_FRAME = 0.12
const FOLLOW_LERP_Y_PER_FRAME = 0.08

/**
 * Locked vs scrolling y-follow, decided from the current camera bounds height against the one
 * screen tall (`GAME_HEIGHT`) baseline. Every stage today sets bounds exactly one screen tall, so
 * this always resolves to `locked`; prompt 06 stages taller than one screen resolve to `scrolling`
 * so the y-follow deadzone can open up instead of clamping every frame.
 */
export type VerticalFollowMode = 'locked' | 'scrolling'
export function decideVerticalFollowMode(boundsHeight: number, screenHeight: number): VerticalFollowMode {
  return boundsHeight > screenHeight ? 'scrolling' : 'locked'
}

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
 */
export class CameraDirector {
  readonly contactHits: HitFeelTraceEntry[] = []
  readonly hitstops: HitFeelTraceEntry[] = []
  private activeShakeIntensity = 0
  private worldBoundsHeight = GAME_HEIGHT
  private lookAheadOffsetX = 0

  constructor(private readonly host: CameraDirectorHost) {}

  /**
   * `startFollow(player, true, 0.12, 0.08)` plus the initial deadzone (prompt 05 §5.3 item 1).
   * `HdCamera` folds the view centre into the follow offset already, so this sets no second
   * centre; `tickHitstop` below re-applies the time-scaled lerp, deadzone and look-ahead offset
   * every frame so they stay correct across resizes and frame rates.
   */
  startFollowingPlayer(target: object): void {
    const host = this.host
    host.cameras.main.startFollow(target, true, FOLLOW_LERP_X_PER_FRAME, FOLLOW_LERP_Y_PER_FRAME)
    host.cameras.main.setDeadzone(CAMERA_FOLLOW_DEADZONE_X, CAMERA_FOLLOW_DEADZONE_Y_LOCKED)
    this.lookAheadOffsetX = 0
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
    this.worldBoundsHeight = GAME_HEIGHT
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
    this.worldBoundsHeight = bounds.height
  }

  /**
   * Runs once per `Game.update`. Hit-stop frames and the follow lerp/deadzone/look-ahead are
   * authored at 60Hz and counted by real time, so they last and converge the same at 30, 60 and
   * 144fps. The look-ahead tween reuses the x follow lerp (one shared time-scaled constant) so the
   * camera settles 40px in front of the hero's facing direction instead of snapping there.
   */
  tickHitstop(): boolean {
    const host = this.host
    const deltaMs = host.game.loop.delta
    const lerpX = timeScaledLerp(FOLLOW_LERP_X_PER_FRAME, deltaMs)
    const lerpY = timeScaledLerp(FOLLOW_LERP_Y_PER_FRAME, deltaMs)
    host.cameras.main?.setLerp(lerpX, lerpY)

    const verticalMode = decideVerticalFollowMode(this.worldBoundsHeight, GAME_HEIGHT)
    host.cameras.main?.setDeadzone(
      CAMERA_FOLLOW_DEADZONE_X,
      verticalMode === 'scrolling' ? CAMERA_FOLLOW_DEADZONE_Y_SCROLLING : CAMERA_FOLLOW_DEADZONE_Y_LOCKED
    )

    const targetLookAheadX = -host.facing * CAMERA_FACING_LOOK_AHEAD_PX
    this.lookAheadOffsetX += (targetLookAheadX - this.lookAheadOffsetX) * lerpX
    host.cameras.main?.setFollowOffset(this.lookAheadOffsetX, 0)

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
