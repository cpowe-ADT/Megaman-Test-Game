import Phaser from 'phaser'
import { AUTOMATION } from '../../config/automation'
import { GAMEPLAY_ACTOR_CEILING, GAMEPLAY_VIEWPORT_TOP } from '../../config/gameplayLayout'
import type { StepGameFramesOptions } from '../../config/frameStepping'
import { getCampaignStage } from '../../content/campaign'
import { getWeaponConfig } from '../../content/weapons'
import { INPUT_ACTIONS, type InputAction } from '../../input/ActionState'
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
/** A held-action set from a given frame until the next row (`docs/prompts/05a-*` input replay). */
export type InputScriptRow = Readonly<{ frame: number; held?: readonly string[] }>
export type InputReplayOptions = Readonly<{
  /** Return a sample after every stepped frame (not just row boundaries) under `trace`. */
  trace?: boolean
  /** Keep the automation-held set latched after the replay ends; default releases it. */
  keepHeld?: boolean
}>
export type InputReplaySample = Readonly<{ frame: number; x: number; y: number; vx: number; vy: number; grounded: boolean; dashing: boolean }>
export type InputReplayResult = Readonly<{
  frames: number
  finalPlayer: { x: number; y: number; vx: number; vy: number }
  trace?: readonly InputReplaySample[]
}>

function readFinalPlayer(host: GameDebugHost): InputReplayResult['finalPlayer'] {
  const body = host.player?.body as Phaser.Physics.Arcade.Body | undefined
  return {
    x: Number(host.player?.x ?? 0),
    y: Number(host.player?.y ?? 0),
    vx: Number(body?.velocity?.x ?? 0),
    vy: Number(body?.velocity?.y ?? 0)
  }
}

function readLocomotion(host: GameDebugHost): { grounded: boolean; dashing: boolean } {
  const debugState = host.getNewPlayerDebugState?.() as { locomotion?: { grounded?: boolean; dashing?: boolean } } | null | undefined
  return {
    grounded: Boolean(debugState?.locomotion?.grounded),
    dashing: Boolean(debugState?.locomotion?.dashing)
  }
}

export function installGameDebugHooks(host: GameDebugHost, dump: () => unknown): void {
  if (!AUTOMATION.enabled) return
  let recordingRows: Array<{ frame: number; held: string[] }> | null = null
  let recordingLastKey = ''
  let recordingStartFrame = 0
  let recordingHandler: (() => void) | null = null
  /** Removes any live `recordInputs` preupdate handler; called at the start of a new recording (so
   * a second `recordInputs()` call cannot leak the first handler), by `stopRecording`, and once on
   * scene shutdown (a scene shutting down mid-recording must not leave an orphaned handler running
   * when Phaser reuses the instance). */
  const stopRecordingHandler = (): void => {
    if (recordingHandler) host.events.off('preupdate', recordingHandler)
    recordingHandler = null
  }
  host.events.once('shutdown', stopRecordingHandler)
  ;(window as any).dump = dump
      ;(window as any).dump = dump
      ;(window as any).bossDebug = {
        damage: (amount = 1) => host.applyDamageToBoss(amount),
        forceVictory: () => {
          host.onBossDefeated()
          host.bossBeats?.presentation.finishDeathNow()
          host.dialogueOverlay?.skip()
        },
        unlockIntro: () => {
          host.dialogueOverlay?.skip()
          // The intro is timed (WARNING, card, dialogue, bar fill): cancel what is pending so no dialogue opens mid-fight.
          host.bossBeats?.presentation.skipIntro()
          host.bossController?.unlockIntro()
          if (host.bossEncounterActive) host.bossBeats?.beginBossCombat()
        },
        hp: () => host.bossHp,
        /** Feet vs body vs floor for the live boss; feetToBodyGap must be 0 when grounded. */
        groundReport: () => host.bossController?.getGroundReport?.() ?? null
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
        skipDialogue: () => { host.bossBeats?.presentation.finishDeathNow(); host.dialogueOverlay?.skip() },
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
    },
    /**
     * Frame-exact input replay (prompt 05 §5.1 item 9, hardened in 5.1c): `script` is a sparse
     * list of `{ frame, held }` rows, each held-action set applying from its frame until the next
     * row's. Feeds the automation-only action source (`SceneInputActions.setAutomationHeld`),
     * which the keyboard hub latches presses/releases against exactly like a physical key change.
     *
     * Sleeps the loop once for the whole replay and wakes it once at the end (rather than letting
     * each `window.stepFrames` call manage sleep/wake itself, whose `wake()` runs one immediate,
     * uncontrolled-delta step) so every stepped frame is exactly 1000/60 regardless of how many
     * rows the script has. Throws on an unknown action name, a missing `window.stepFrames`
     * (non-automation build) or a paused game, instead of silently stepping zero frames. Under
     * `trace: true`, steps one frame at a time and returns a sample after each.
     */
    replayInputs: (script: readonly InputScriptRow[], options?: InputReplayOptions): InputReplayResult => {
      const stepFrames = (window as any).stepFrames as
        | ((n: number, stepOptions?: StepGameFramesOptions) => number)
        | undefined
      if (typeof stepFrames !== 'function') {
        throw new Error('stageDebug.replayInputs requires window.stepFrames (automation build only, ?automation=1).')
      }
      if (host.game.isPaused) {
        throw new Error('stageDebug.replayInputs cannot step frames while the game is paused.')
      }
      const rows = Array.isArray(script) ? [...script].sort((a, b) => a.frame - b.frame) : []
      for (const row of rows) {
        for (const action of row.held ?? []) {
          if (!INPUT_ACTIONS.includes(action as InputAction)) {
            throw new Error(`stageDebug.replayInputs: unknown action "${action}".`)
          }
        }
      }

      const trace: InputReplaySample[] = []
      const sampleAt = (frame: number): InputReplaySample => ({
        frame,
        ...readFinalPlayer(host),
        ...readLocomotion(host)
      })

      const loop = host.game.loop as { running: boolean; sleep: () => void; wake: (seamless?: boolean) => void }
      const wasRunning = loop.running
      if (wasRunning) loop.sleep()

      let framesStepped = 0
      try {
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index]
          const held: Record<string, boolean> = {}
          for (const action of row.held ?? []) held[action] = true
          host.actions?.setAutomationHeld(held)
          const next = rows[index + 1]
          if (!next) continue
          const delta = Math.max(0, Math.round(next.frame - row.frame))
          if (delta === 0) continue
          if (options?.trace) {
            for (let step = 0; step < delta; step += 1) {
              framesStepped += stepFrames(1, { manageLoop: false })
              trace.push(sampleAt(row.frame + step + 1))
            }
          } else {
            framesStepped += stepFrames(delta, { manageLoop: false })
          }
        }
      } finally {
        if (wasRunning) loop.wake()
        if (!options?.keepHeld) host.actions?.setAutomationHeld({})
      }

      const result: InputReplayResult = { frames: framesStepped, finalPlayer: readFinalPlayer(host) }
      return options?.trace ? { ...result, trace } : result
    },
    /** Starts capturing the held-action set per frame from real input into the same `{ frame, held }` shape. */
    recordInputs: (): boolean => {
      stopRecordingHandler()
      recordingRows = []
      recordingLastKey = ''
      recordingStartFrame = host.game.loop.frame
      recordingHandler = () => {
        const snapshot = host.actions?.heldSnapshot() ?? {}
        const held = Object.keys(snapshot).filter(action => snapshot[action]).sort()
        const key = held.join(',')
        if (key === recordingLastKey) return
        recordingLastKey = key
        recordingRows?.push({ frame: host.game.loop.frame - recordingStartFrame, held })
      }
      host.events.on('preupdate', recordingHandler)
      return true
    },
    /** Stops `recordInputs()` and returns the recorded script (a valid `replayInputs` input). */
    stopRecording: (): Array<{ frame: number; held: string[] }> => {
      stopRecordingHandler()
      const rows = recordingRows ?? []
      recordingRows = null
      return rows
    }
  })
}

export function uninstallGameDebugHooks(dump: () => unknown): void {
  if (!AUTOMATION.enabled) return
  if ((window as any).dump === dump) delete (window as any).dump
  delete (window as any).bossDebug
  delete (window as any).stageDebug
}
