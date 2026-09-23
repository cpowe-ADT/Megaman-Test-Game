import type Phaser from 'phaser'
import AudioService from '../../audio'
import type { BossProjectileController } from '../../boss/framework/BossProjectileController'
import { getCampaignStage } from '../../content/campaign'
import { GAME_HEIGHT } from '../../config/renderPolicy'
import { FEEL_FRAME_MS } from '../../player/config'
import type { NewPlayerRuntime } from '../../player/NewPlayerRuntime'
import type { PlayerDamageRequest, PlayerDamageResult } from '../../player/types'
import type { CampaignSessionStatistics } from '../../progression/statistics'
import type { HUD } from '../../ui/HUD'
import { Save } from '../../systems/Save'
import type { StoryDirector } from './StoryDirector'

/** A plain 2D point, used instead of `Phaser.Math.Vector2` so this module has no runtime Phaser dependency. */
export interface Vec2 {
  x: number
  y: number
}

/**
 * Death beats in ms from the killing blow (prompt 05 §5.2 item 5): `player_death` and its sfx with
 * the world frozen for 250ms, then eight orbs and a heavy shake, a fade, and a beam-in respawn at
 * 900ms with a 600ms READY.
 */
export const DEATH_TIMELINE = {
  freezeMs: 250,
  burstAtMs: 250,
  orbCount: 8,
  fadeOutAtMs: 650,
  fadeOutMs: 200,
  respawnAtMs: 900,
  fadeInMs: 200,
  readyMs: 600
} as const

export type DeathBeat = 'freeze' | 'burst' | 'fadeOut' | 'respawn'

/** The beats in play order; pure so the timing is tested without a scene. */
export function planDeathBeats(timeline: typeof DEATH_TIMELINE = DEATH_TIMELINE): Array<{ atMs: number; beat: DeathBeat }> {
  return [
    { atMs: 0, beat: 'freeze' as const },
    { atMs: timeline.burstAtMs, beat: 'burst' as const },
    { atMs: timeline.fadeOutAtMs, beat: 'fadeOut' as const },
    { atMs: timeline.respawnAtMs, beat: 'respawn' as const }
  ].sort((a, b) => a.atMs - b.atMs)
}

/** The freeze runs through the hit-stop counter, which is authored in 60Hz frames. */
export function freezeHitstopFrames(freezeMs: number = DEATH_TIMELINE.freezeMs): number {
  return Math.round(freezeMs / FEEL_FRAME_MS)
}

/** What smoke 9 and 23 read back (`scene.deathSequence.trace`). */
export interface DeathTrace {
  reason: 'pit' | 'debug' | 'damage'
  animationKey: 'player_death'
  sfxKey: 'player_death'
  orbCount: number
  diedAtMs: number
  burstAtMs: number | null
  respawnedAtMs: number | null
}

/** The members of the Game scene that death, respawn, checkpoints and game over read and write. */
export interface DeathSequenceHost {
  readonly scene: Phaser.Scenes.ScenePlugin
  readonly time: Phaser.Time.Clock
  readonly events?: Pick<Phaser.Events.EventEmitter, 'emit'>
  readonly cameras?: Phaser.Cameras.Scene2D.CameraManager
  player: Phaser.Physics.Arcade.Sprite
  playerHp: number
  playerMaxHp: number
  playerLives: number
  fallingToDeath: boolean
  gameOverTriggered: boolean
  bossEncounterActive: boolean
  activeStageId: string
  activeBossRoom?: { playerIntroX: number }
  respawnPoint?: Vec2
  currentCheckpointIndex: number
  currentCheckpointId: string | null
  progressionSave: ReturnType<typeof Save.load>
  sessionStats: Pick<CampaignSessionStatistics, 'defeat' | 'respawn'>
  hud?: Pick<HUD, 'updatePlayerHp' | 'setLives'>
  newPlayerRuntime?: Pick<NewPlayerRuntime, 'resetForRespawn' | 'playDeath' | 'playDeathBurst' | 'playBeamIn'>
  bossProjectileController?: Pick<BossProjectileController, 'onPauseChanged' | 'stop'>
  storyDirector?: Pick<StoryDirector, 'onCheckpoint'>
  requestPlayerDamage(request: PlayerDamageRequest): PlayerDamageResult
  flushStatistics(): void
  autosaveActiveRun(): boolean
  disableProjectileGroups(): void
  activateBossEncounter(): void
  showStageToast(message: string, durationMs?: number): void
  syncWeaponHud(): void
  gameOver(): void
}

/**
 * Kill plane, player death, respawn at the checkpoint and game over, moved out of `Game`
 * in slice 5.0c (EVAL-P5-010); the death beats are prompt 05 §5.2 item 5 (`DEATH_TIMELINE`). `Game` keeps one-line delegations with the
 * same names so debug hooks and smoke scenarios 9, 23 and 13c see no difference.
 */
export class DeathSequence {
  trace: DeathTrace | null = null
  private pendingReason: DeathTrace['reason'] = 'damage'

  constructor(private readonly host: DeathSequenceHost) {}

  updateRespawnCheckpoint(): void {
    const host = this.host
    if (!host.player) {
      return
    }
    const stage = getCampaignStage(host.activeStageId)
    const nextCheckpoint = stage.arena.checkpoints[host.currentCheckpointIndex + 1]
    if (!nextCheckpoint || host.player.x < nextCheckpoint.triggerX) {
      return
    }
    host.currentCheckpointIndex += 1
    host.respawnPoint = { x: nextCheckpoint.x, y: nextCheckpoint.y }
    host.currentCheckpointId = nextCheckpoint.id
    host.flushStatistics()
    Save.unlockCheckpoint(host.activeStageId, nextCheckpoint.id)
    host.autosaveActiveRun()
    host.progressionSave = Save.load()
    if (host.storyDirector) {
      host.storyDirector.onCheckpoint(host.currentCheckpointIndex, nextCheckpoint)
    } else {
      host.showStageToast(`Checkpoint ${host.currentCheckpointIndex + 1}`, 900)
    }
    if (host.currentCheckpointIndex >= stage.arena.checkpoints.length - 1 || host.player.x >= stage.arena.bossRoom.x) {
      host.activateBossEncounter()
    }
  }

  applySelectedCheckpoint(stageId: string, checkpointId?: string | null): void {
    const host = this.host
    const stage = getCampaignStage(stageId)
    const selectedId = checkpointId ?? Save.load().selectedCheckpointByStage?.[stageId] ?? stage.arena.checkpoints[0]?.id
    const checkpointIndex = Math.max(
      0,
      stage.arena.checkpoints.findIndex((checkpoint) => checkpoint.id === selectedId)
    )
    const checkpoint = stage.arena.checkpoints[checkpointIndex] ?? stage.arena.checkpoints[0]
    if (!checkpoint || !host.player) {
      return
    }
    host.currentCheckpointIndex = checkpointIndex
    host.currentCheckpointId = checkpoint.id
    host.player.setPosition(checkpoint.x, checkpoint.y)
    host.respawnPoint = { x: checkpoint.x, y: checkpoint.y }
    Save.setSelectedCheckpoint(stageId, checkpoint.id)
    Save.unlockCheckpoint(stageId, checkpoint.id)
    host.progressionSave = Save.load()
  }

  checkStageKillPlane(): void {
    const host = this.host
    if (!host.player || !host.player.active || host.fallingToDeath) {
      return
    }
    const stage = getCampaignStage(host.activeStageId)
    if (!stage.arena.allowFallOff) {
      return
    }
    if (host.player.y <= GAME_HEIGHT + 40) {
      return
    }
    host.requestPlayerDamage({
      amount: Math.max(1, host.playerHp),
      tier: 'heavy',
      sourceType: 'fall',
      sourceId: 'stage_kill_plane',
      bypassIFrames: true,
      knockback: { x: 0, y: 0 }
    })
  }

  killPlayer(reason: 'pit' | 'debug' | 'damage'): void {
    const host = this.host
    if (!host.player || host.fallingToDeath) {
      return
    }
    host.sessionStats.defeat()
    host.flushStatistics()
    host.playerHp = 0
    host.player.data?.set?.('hp', host.playerHp)
    host.hud?.updatePlayerHp(host.playerHp, host.playerMaxHp)
    host.fallingToDeath = true
    this.pendingReason = reason
    this.playerDeathAndRespawn()
  }

  prepareRespawnCombatState(): void {
    const host = this.host
    host.disableProjectileGroups()
    host.bossProjectileController?.onPauseChanged(true)
  }

  resumeRespawnCombatState(): void {
    const host = this.host
    host.disableProjectileGroups()
    host.bossProjectileController?.onPauseChanged(false)
  }

  onPlayerGameOver(): void {
    const host = this.host
    if (host.gameOverTriggered) {
      return
    }
    host.gameOverTriggered = true
    host.bossProjectileController?.stop()
    Save.clearActiveRun()
    AudioService.stopMusic()
    AudioService.playSfx('game_over')
    const stageId = host.activeStageId ?? 'unknown'
    if (host.scene.manager.keys['GameOver']) {
      host.scene.start('GameOver', { stageId, checkpointId: host.currentCheckpointId ?? null })
    }
  }

  playerDeathAndRespawn(): void {
    const host = this.host
    if (!host.player) {
      return
    }

    host.playerLives--
    host.hud?.setLives(host.playerLives)
    if (host.playerLives > 0) {
      // Before the body is disabled: an inactive sprite does not start animations.
      host.newPlayerRuntime?.playDeath()
    }

    // The body stops (no collisions, no kill plane) but the hero stays visible for the death pose.
    const anyPlayer = host.player as any
    if (typeof anyPlayer.disableBody === 'function') {
      anyPlayer.disableBody(true, false)
    } else {
      host.player.setActive(false)
      const body = host.player.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
      }
    }
    this.prepareRespawnCombatState()

    if (host.playerLives <= 0) {
      host.player.setVisible(false)
      host.fallingToDeath = false
      host.gameOver()
      return
    }

    const timeline = DEATH_TIMELINE
    const diedAtMs = Number(host.time.now ?? 0)
    this.trace = {
      reason: this.pendingReason,
      animationKey: 'player_death',
      sfxKey: 'player_death',
      orbCount: timeline.orbCount,
      diedAtMs,
      burstAtMs: null,
      respawnedAtMs: null
    }
    const trace = this.trace
    host.events?.emit('player.hitstop', freezeHitstopFrames(timeline.freezeMs))

    host.time.delayedCall(timeline.burstAtMs, () => {
      trace.burstAtMs = Number(host.time.now ?? 0)
      host.newPlayerRuntime?.playDeathBurst()
      host.player?.setVisible(false)
    })
    host.time.delayedCall(timeline.fadeOutAtMs, () => {
      host.cameras?.main?.fadeOut(timeline.fadeOutMs, 0, 0, 0)
    })
    host.time.delayedCall(timeline.respawnAtMs, () => {
      if (!host.player || !host.respawnPoint) {
        return
      }
      this.respawnAtCheckpoint()
      trace.respawnedAtMs = Number(host.time.now ?? 0)
    })
  }

  private respawnAtCheckpoint(): void {
    const host = this.host
    const respawnPoint = host.respawnPoint as Vec2
    const respawnX =
      host.bossEncounterActive && host.activeBossRoom
        ? Math.max(respawnPoint.x, host.activeBossRoom.playerIntroX)
        : respawnPoint.x
    const respawnY = respawnPoint.y - 4

    const playerAny = host.player as any
    if (typeof playerAny.enableBody === 'function') {
      playerAny.enableBody(true, respawnX, respawnY, true, true)
    } else {
      host.player.setPosition(respawnX, respawnY)
      const body = host.player.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = true
        body.reset(respawnX, respawnY)
      }
    }
    host.playerHp = host.playerMaxHp
    host.player.setDataEnabled()
    host.player.data.set('hp', host.playerHp)
    host.player.data.set('maxHp', host.playerMaxHp)
    host.hud?.updatePlayerHp(host.playerHp, host.playerMaxHp)
    host.player.setVelocity(0, 0)
    host.player.setAcceleration(0, 0)
    host.player.clearTint()
    host.player.setActive(true).setVisible(true)
    host.sessionStats.respawn()
    host.newPlayerRuntime?.resetForRespawn(1000)
    host.newPlayerRuntime?.playBeamIn()
    host.cameras?.main?.fadeIn(DEATH_TIMELINE.fadeInMs, 0, 0, 0)
    host.showStageToast('READY', DEATH_TIMELINE.readyMs)
    this.resumeRespawnCombatState()
    host.syncWeaponHud()
    host.fallingToDeath = false
    host.autosaveActiveRun()
  }
}
