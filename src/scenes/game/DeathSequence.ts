import Phaser from 'phaser'
import AudioService from '../../audio'
import type { BossProjectileController } from '../../boss/framework/BossProjectileController'
import { getCampaignStage } from '../../content/campaign'
import { GAME_HEIGHT } from '../../config/renderPolicy'
import type { NewPlayerRuntime } from '../../player/NewPlayerRuntime'
import type { PlayerDamageRequest, PlayerDamageResult } from '../../player/types'
import type { CampaignSessionStatistics } from '../../progression/statistics'
import type { HUD } from '../../ui/HUD'
import { Save } from '../../systems/Save'
import type { StoryDirector } from './StoryDirector'

/** The members of the Game scene that death, respawn, checkpoints and game over read and write. */
export interface DeathSequenceHost {
  readonly scene: Phaser.Scenes.ScenePlugin
  readonly time: Phaser.Time.Clock
  player: Phaser.Physics.Arcade.Sprite
  playerHp: number
  playerMaxHp: number
  playerLives: number
  fallingToDeath: boolean
  gameOverTriggered: boolean
  bossEncounterActive: boolean
  activeStageId: string
  activeBossRoom?: { playerIntroX: number }
  respawnPoint?: Phaser.Math.Vector2
  currentCheckpointIndex: number
  currentCheckpointId: string | null
  progressionSave: ReturnType<typeof Save.load>
  sessionStats: Pick<CampaignSessionStatistics, 'defeat' | 'respawn'>
  hud?: Pick<HUD, 'updatePlayerHp' | 'setLives'>
  newPlayerRuntime?: Pick<NewPlayerRuntime, 'resetForRespawn'>
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
 * unchanged in behaviour (EVAL-P5-010, slice 5.0c). `Game` keeps one-line delegations with the
 * same names so debug hooks and smoke scenarios 9, 23 and 13c see no difference.
 */
export class DeathSequence {
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
    host.respawnPoint = new Phaser.Math.Vector2(nextCheckpoint.x, nextCheckpoint.y)
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
    host.respawnPoint = new Phaser.Math.Vector2(checkpoint.x, checkpoint.y)
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
    const stageId = ((host as any).stageId as string | undefined) ?? 'unknown'
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

    const anyPlayer = host.player as any
    if (typeof anyPlayer.disableBody === 'function') {
      anyPlayer.disableBody(true, true)
    } else {
      host.player.setActive(false).setVisible(false)
      const body = host.player.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
      }
    }
    this.prepareRespawnCombatState()

    if (host.playerLives > 0) {
      host.time.delayedCall(600, () => {
        if (!host.player || !host.respawnPoint) {
          return
        }
        const respawnX =
          host.bossEncounterActive && host.activeBossRoom
            ? Math.max(host.respawnPoint.x, host.activeBossRoom.playerIntroX)
            : host.respawnPoint.x
        const respawnY = host.respawnPoint.y - 4

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
        this.resumeRespawnCombatState()
        host.syncWeaponHud()
        host.fallingToDeath = false
        host.autosaveActiveRun()
      })
    } else {
      host.fallingToDeath = false
      host.gameOver()
    }
  }
}
