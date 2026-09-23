import type Phaser from 'phaser'
import { getCampaignStage } from '../../content/campaign'
import { getBossRoomCameraBounds } from '../../content/stageArenaLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import { Settings } from '../../systems/Settings'
import { tickHitstopFrames, timeScaledLerp } from '../../player/config'

/** Camera follow lerp per 60Hz frame, as passed to `startFollow` in `Game.create`. */
const FOLLOW_LERP_PER_FRAME = 0.1

/** Plain-value clamp so this module has no runtime dependency on Phaser (`Phaser.Math.Clamp`). */
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

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
  constructor(private readonly host: CameraDirectorHost) {}

  onHitstop(frames: number): void {
    const host = this.host
    host.hitstopRemainingFrames = Math.max(host.hitstopRemainingFrames, frames)
    host.physics.world.pause()
    host.newPlayerRuntime?.pauseAnimations?.()
    host.enemySpawner?.pauseAnimations?.()
    host.bossController?.pauseAnimations?.()
  }

  onCameraShake(config: { intensity: number; duration: number }): void {
    const host = this.host
    if (!Settings.get().screenShake) return
    // Shake amplitude is intensity * canvas width * zoom; the HD canvas is already zoom times wider.
    host.cameras.main.shake(config.duration, config.intensity / Math.max(1, host.cameras.main.zoom))
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
