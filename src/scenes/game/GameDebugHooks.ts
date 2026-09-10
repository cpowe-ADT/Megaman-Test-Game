import Phaser from 'phaser'
import { AUTOMATION } from '../../config/automation'
import { GAMEPLAY_ACTOR_CEILING, GAMEPLAY_VIEWPORT_TOP } from '../../config/gameplayLayout'
import { getCampaignStage } from '../../content/campaign'
import { getWeaponConfig } from '../../content/weapons'
import { getLatestActiveProjectile, spawnDebugProjectileClash, summarizeProjectilePool } from '../../projectiles/diagnostics/ProjectileDevTools'
import { Save } from '../../systems/Save'

/**
 * The Game scene as the automation hooks see it. The scene is still under @ts-nocheck, so this
 * adapter edge is deliberately loose; every member read here exists on `Game`.
 */
export type GameDebugHost = Phaser.Scene & Record<string, any>

/**
 * Installs `window.bossDebug` and `window.stageDebug` for browser automation. Moved out of
 * `Game.devInit` unchanged in behavior; hooks added since prompt 01 are grouped at the end.
 */
export function installGameDebugHooks(host: GameDebugHost, dump: () => unknown): void {
  if (!AUTOMATION.enabled) return
  ;(window as any).dump = dump
      ;(window as any).dump = dump
      ;(window as any).bossDebug = {
        damage: (amount = 1) => host.applyDamageToBoss(amount),
        forceVictory: () => {
          host.onBossDefeated()
          host.dialogueOverlay?.skip()
        },
        unlockIntro: () => {
          host.dialogueOverlay?.skip()
          host.bossController?.unlockIntro()
        },
        hp: () => host.bossHp
      }
      ;(window as any).stageDebug = {
        checkpointIndex: () => host.currentCheckpointIndex,
        enemyStream: () => host.enemySpawner?.getStreamDebugSnapshot?.() ?? null,
        projectilePools: () => ({
          player: summarizeProjectilePool(host.playerBullets),
          enemy: summarizeProjectilePool(host.bossBullets)
        }),
        playerViewport: () => {
          const body = host.player?.body as Phaser.Physics.Arcade.Body | undefined
          return {
            top: Number(body?.top ?? host.player?.y ?? 0),
            bottom: Number(body?.bottom ?? host.player?.y ?? 0),
            viewportTop: GAMEPLAY_VIEWPORT_TOP,
            actorCeiling: GAMEPLAY_ACTOR_CEILING,
            blockedUp: Boolean(body?.blocked.up)
          }
        },
        setWeaponEnergy: (weaponId: string, amount: number) => {
          if (!host.weapons.includes(weaponId) || weaponId === 'Buster') {
            return null
          }
          const config = getWeaponConfig(weaponId)
          host.weaponEnergyById[weaponId] = Phaser.Math.Clamp(Number(amount) || 0, 0, config.maxEnergy)
          host.passiveWeaponRechargeAccumulatorMs = 0
          if (weaponId === host.getCurrentWeaponId()) {
            host.syncWeaponHud()
          }
          return host.getWeaponEnergyDebugState()
        },
        freezeLatestPlayerProjectile: () => {
          const projectile = getLatestActiveProjectile(host.playerBullets)
          const body = projectile?.body as Phaser.Physics.Arcade.Body | undefined
          if (!projectile?.active || !body?.enable) {
            return null
          }
          body.setVelocity(0, 0)
          return {
            projectileId: projectile.data?.get?.('projectileId') ?? null,
            active: projectile.active,
            visible: projectile.visible,
            bodyEnabled: body.enable
          }
        },
        forcePlayerDeath: () =>
          host.requestPlayerDamage({
            amount: Math.max(1, host.playerHp),
            tier: 'heavy',
            sourceType: 'system',
            sourceId: 'debug_force_death',
            bypassIFrames: true,
            knockback: { x: 0, y: 0 }
          }),
        activateBossRoom: () => host.activateBossEncounter(),
        advanceDialogue: () => host.dialogueOverlay?.advance(),
        skipDialogue: () => host.dialogueOverlay?.skip(),
        spawnProjectileClash: (options?: { strong?: boolean } | boolean) => {
        if (!host.player || !host.playerBullets || !host.bossBullets) {
          return null
        }
        const strong = typeof options === 'boolean' ? options : Boolean(options?.strong)
        const clashX = host.player.x + 96
        const clashY = host.player.y - 6
        return spawnDebugProjectileClash({
          playerGroup: host.playerBullets,
          enemyGroup: host.bossBullets,
          clashX,
          clashY,
          spawnPlayerProjectile: () =>
            host.fireBulletFromRuntime({
              type: strong ? 'charge' : 'pellet',
              chargeLevel: strong ? 2 : 0,
              facing: 1
            }),
          spawnEnemyProjectile: () =>
            host.devRegister(
              host.projectileSystem?.spawn({
                id: 'enemy_basic_shot',
                x: host.player.x + 12,
                y: host.player.y - 6,
                direction: -1,
                speed: 220,
                damage: 1,
                velocity: { x: -220, y: 0 },
                tint: host.bossController?.blueprint.theme.trail ?? 0x55ccff,
                metadata: {
                  attack: strong ? 'debug-projectile-clash-strong' : 'debug-projectile-clash',
                  sourceType: 'system',
                  sourceId: 'debug_projectile_clash',
                  ignoreBossUntil: host.time.now + 120
                }
              }) ?? undefined,
              'bullet.enemy'
            )
        })
      },
      setPlayerX: (x: number) => {
        if (!host.player) {
          return null
        }
        host.player.setPosition(x, host.player.y)
        return { x: host.player.x, y: host.player.y }
      },
      crossNextCheckpoint: () => {
        if (!host.player) {
          return null
        }
        const stage = getCampaignStage(host.activeStageId)
        const nextCheckpoint = stage.arena.checkpoints[host.currentCheckpointIndex + 1]
        if (!nextCheckpoint) {
          return null
        }
        host.player.setPosition(nextCheckpoint.triggerX + 8, host.player.y)
        return { x: host.player.x, triggerX: nextCheckpoint.triggerX, nextCheckpointId: nextCheckpoint.id }
      },
      crossBossGate: () => {
        if (!host.player) {
          return null
        }
        host.player.setPosition(host.bossActivationX + 8, host.player.y)
        return {
          x: host.player.x,
          bossActivationX: host.bossActivationX,
          bossRoomX: host.activeBossRoom?.x ?? null
        }
      },
      damagePlayer: (amount = 1) => ({
        result: host.requestPlayerDamage({
          amount,
          sourceType: 'system',
          sourceId: 'debug_damage'
        }),
        hp: host.playerHp,
        maxHp: host.playerMaxHp
      }),
      spawnPickup: (type: 'health' | 'ammo' | 'bonus' = 'health', offsetX = 0) => {
        if (!host.player) {
          return null
        }
        const pickup = host.spawnEnemyDrop(host.player.x + Number(offsetX || 0), host.player.y - 18, type)
        return pickup
          ? { type, x: pickup.x, y: pickup.y, active: pickup.active, textureKey: pickup.texture.key }
          : null
      },
      spawnHostileProjectile: () => {
        if (!host.player || !host.projectileSystem) {
          return null
        }
        const projectile = host.devRegister(
          host.projectileSystem.spawn({
            id: 'enemy_basic_shot',
            x: host.player.x + 84,
            y: host.player.y - 10,
            direction: -1,
            speed: 210,
            damage: 1,
            velocity: { x: -210, y: 0 },
            metadata: {
              attack: 'debug-respawn-projectile',
              sourceType: 'system',
              sourceId: 'debug_respawn_projectile',
              ignoreBossUntil: host.time.now + 120
            }
          }) ?? undefined,
          'bullet.enemy'
        )
        return projectile ? { x: projectile.x, y: projectile.y, active: projectile.active } : null
      },
        bossGateState: () => ({
          locked: host.bossGateLocked,
          x: host.bossGateLockX,
          bossRoomX: host.activeBossRoom?.x ?? null,
          bossRoomWidth: host.activeBossRoom?.width ?? null,
          cameraLocked: host.bossRoomCameraLocked
        })
      }
  Object.assign((window as any).stageDebug, {
    advanceStageIntro: () => host.storyDirector?.advanceIntro(),
    skipStageIntro: () => host.storyDirector?.skipIntro(),
    storyState: () => host.storyDirector?.getDebugState() ?? null,
    setLives: (count: number) => {
      host.playerLives = Math.max(0, Math.round(Number(count) || 0))
      host.hud?.setLives(host.playerLives)
      return host.playerLives
    },
    setSubTanks: (count: number, fills?: number[]) => {
      const state = Save.load()
      state.subTanks = Math.max(0, Math.min(4, Math.round(Number(count) || 0)))
      Save.save(state)
      Save.setSubTankFill(Array.isArray(fills) ? fills : Array.from({ length: state.subTanks }, () => 1))
      host.progressionSave = Save.load()
      return { subTanks: host.progressionSave.subTanks, subTankFill: host.progressionSave.subTankFill }
    }
  })
}

export function uninstallGameDebugHooks(dump: () => unknown): void {
  if (!AUTOMATION.enabled) return
  if ((window as any).dump === dump) delete (window as any).dump
  delete (window as any).bossDebug
  delete (window as any).stageDebug
}
