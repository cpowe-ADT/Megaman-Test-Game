import type Phaser from 'phaser'
import AudioService from '../../audio'
import type { BossController } from '../../bosses/BossController'
import { getCampaignStage } from '../../content/campaign'
import type { CampaignSessionStatistics } from '../../progression/statistics'
import type { ProjectileSystem } from '../../projectiles'
import { ActiveRunSaveData, Save } from '../../systems/Save'
import { drinkSubTank } from '../../systems/subTanks'
import type { HUD } from '../../ui/HUD'

/** A plain 2D point, used instead of `Phaser.Math.Vector2` so this module has no runtime Phaser dependency. */
export interface Vec2 {
  x: number
  y: number
}

/** Plain-value clamp so this module has no runtime dependency on Phaser (`Phaser.Math.Clamp`). */
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** The members of the Game scene that the active-run snapshot, sub-tanks and combat freeze touch. */
export interface RunStateHost {
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly time: Phaser.Time.Clock
  player: Phaser.Physics.Arcade.Sprite
  playerBullets: Phaser.Physics.Arcade.Group
  bossBullets: Phaser.Physics.Arcade.Group
  playerHp: number
  playerMaxHp: number
  playerLives: number
  paused: boolean
  victoryTriggered: boolean
  gameOverTriggered: boolean
  activeStageId: string
  activeBossId?: ActiveRunSaveData['bossId']
  respawnPoint?: Vec2
  currentCheckpointIndex: number
  currentCheckpointId: string | null
  currentWeaponIndex: number
  weapons: string[]
  weaponEnergyById: Record<string, number>
  selectedSubTank: number
  progressionSave: ReturnType<typeof Save.load>
  sessionStats: Pick<CampaignSessionStatistics, 'stageElapsedMs'>
  pauseOverlay?: Phaser.GameObjects.Container
  hud?: Pick<HUD, 'updatePlayerHp' | 'setLives'>
  projectileSystem?: Pick<ProjectileSystem, 'recycle'>
  bossController?: BossController
  bossTarget?: Phaser.Physics.Arcade.Sprite
  bossBody?: Phaser.Physics.Arcade.Sprite
  bossArt?: Phaser.GameObjects.Sprite
  bossHitWire?: Phaser.Physics.Arcade.Collider
  playerHitWire?: Phaser.Physics.Arcade.Collider
  bossContactWire?: Phaser.Physics.Arcade.Collider
  projectileClashWire?: Phaser.Physics.Arcade.Collider
  flushStatistics(): void
  getCurrentWeaponId(): string
  restorePlayerHealth(amount: number): number
  updateWeaponLabel(): void
}

/**
 * Active-run autosave and restore, sub-tank drinking and the combat freeze used on boss defeat
 * and respawn, moved out of `Game` unchanged in behaviour (EVAL-P5-010, slice 5.0c).
 */
export class RunState {
  constructor(private readonly host: RunStateHost) {}

  disableBossCombatActors(): void {
    const host = this.host
    if (host.bossTarget) {
      const body = host.bossTarget.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
        body.setVelocity(0, 0)
      }
      host.bossTarget.setActive(false).setVisible(false)
    }
    if (host.bossBody) {
      const body = host.bossBody.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
        body.setVelocity(0, 0)
      }
      host.bossBody.setActive(false).setVisible(false)
    }
    host.bossArt?.setVisible(false)
    host.bossController = undefined
    host.bossHitWire?.destroy()
    host.playerHitWire?.destroy()
    host.bossContactWire?.destroy()
    host.projectileClashWire?.destroy()
    host.bossHitWire = undefined
    host.playerHitWire = undefined
    host.bossContactWire = undefined
    host.projectileClashWire = undefined
  }

  disableProjectileGroups(): void {
    const host = this.host
    const disableGroup = (group?: Phaser.Physics.Arcade.Group) => {
      if (!group) {
        return
      }
      group.children.iterate((child) => {
        const sprite = child as Phaser.Physics.Arcade.Sprite | undefined
        if (!sprite?.active) {
          return false
        }
        if (host.projectileSystem?.recycle(sprite)) {
          return false
        }
        const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
        body?.setVelocity(0, 0)
        body && (body.enable = false)
        sprite.setActive(false).setVisible(false)
        return false
      })
    }

    disableGroup(host.playerBullets)
    disableGroup(host.bossBullets)
  }

  freezeCombatWorld(): void {
    const host = this.host
    host.physics.world.pause()
    host.paused = false
    host.pauseOverlay?.setVisible(false)
    const playerBody = host.player?.body as Phaser.Physics.Arcade.Body | undefined
    if (playerBody) {
      playerBody.setVelocity(0, 0)
      playerBody.setAcceleration(0, 0)
    }
  }

  drinkSelectedSubTank(): boolean {
    const host = this.host
    const fills = host.progressionSave.subTankFill ?? []
    const { fills: next, restoredRatio } = drinkSubTank(fills, host.selectedSubTank)
    if (restoredRatio <= 0) return false
    Save.setSubTankFill(next)
    host.progressionSave = Save.load()
    const total = restoredRatio * host.playerMaxHp
    const steps = 6
    let applied = 0
    AudioService.playSfx('pickup_health')
    host.time.addEvent({
      delay: 150,
      repeat: steps - 1,
      callback: () => {
        const target = Math.round((total * (applied + 1)) / steps * 100) / 100
        host.restorePlayerHealth(target - Math.round(applied * 100) / 100)
        applied = target
      }
    })
    return true
  }

  autosaveActiveRun(): boolean {
    const host = this.host
    if (host.victoryTriggered || host.gameOverTriggered) return false
    const snapshot = this.captureActiveRunSnapshot()
    return snapshot ? Save.saveActiveRun(snapshot) : false
  }

  captureActiveRunSnapshot(): ActiveRunSaveData | null {
    const host = this.host
    if (!host.activeBossId) {
      return null
    }
    host.flushStatistics()
    const stageId = host.activeStageId
    return {
      version: 2,
      savedAt: Date.now(),
      stageElapsedMs: host.sessionStats.stageElapsedMs,
      stageId,
      bossId: host.activeBossId,
      playerHp: Math.max(Number.EPSILON, host.playerHp),
      playerMaxHp: Math.max(1, Math.round(host.playerMaxHp)),
      playerLives: Math.max(0, Math.round(host.playerLives)),
      currentWeaponIndex: Math.max(0, Math.round(host.currentWeaponIndex)),
      currentWeaponId: host.getCurrentWeaponId(),
      checkpointIndex: Math.max(0, Math.round(host.currentCheckpointIndex)),
      checkpointId: host.currentCheckpointId ?? undefined,
      weaponEnergyById: { ...host.weaponEnergyById }
    }
  }

  applyActiveRunSnapshot(run: ActiveRunSaveData | null): void {
    const host = this.host
    if (!run || !host.player) {
      return
    }

    host.playerMaxHp = Math.max(1, Math.round(run.playerMaxHp))
    host.playerHp = clampNumber(run.playerHp, Number.EPSILON, host.playerMaxHp)
    host.playerLives = Math.max(0, Math.round(run.playerLives))
    const weaponIndexFromId =
      typeof run.currentWeaponId === 'string' ? host.weapons.indexOf(run.currentWeaponId) : -1
    host.currentWeaponIndex =
      weaponIndexFromId >= 0
        ? weaponIndexFromId
        : clampNumber(Math.round(run.currentWeaponIndex), 0, host.weapons.length - 1)
    host.weaponEnergyById = {
      ...host.weaponEnergyById,
      ...(run.weaponEnergyById ?? {})
    }
    const stage = getCampaignStage(host.activeStageId)
    const checkpointIndex =
      typeof run.checkpointId === 'string'
        ? stage.arena.checkpoints.findIndex((checkpoint) => checkpoint.id === run.checkpointId)
        : -1
    if (checkpointIndex >= 0) {
      const checkpoint = stage.arena.checkpoints[checkpointIndex]
      host.currentCheckpointIndex = checkpointIndex
      host.currentCheckpointId = checkpoint.id
      host.respawnPoint = { x: checkpoint.x, y: checkpoint.y }
      host.player.setPosition(checkpoint.x, checkpoint.y)
    } else if (typeof run.checkpointIndex === 'number' && stage.arena.checkpoints[run.checkpointIndex]) {
      const checkpoint = stage.arena.checkpoints[run.checkpointIndex]
      host.currentCheckpointIndex = run.checkpointIndex
      host.currentCheckpointId = checkpoint.id
      host.respawnPoint = { x: checkpoint.x, y: checkpoint.y }
      host.player.setPosition(checkpoint.x, checkpoint.y)
    }

    host.player.data?.set('hp', host.playerHp)
    host.player.data?.set('maxHp', host.playerMaxHp)
    host.hud?.updatePlayerHp(host.playerHp, host.playerMaxHp)
    host.hud?.setLives(host.playerLives)
    host.updateWeaponLabel()
  }
}
