import { IDENTITY } from './content/identity'
import { NewCampaignScene } from './scenes/NewCampaignScene'
import Phaser from 'phaser'
import AudioService from './audio'
import { Boot } from './scenes/Boot'
import { Preload } from './scenes/Preload'
import { Title } from './scenes/Title'
import { StageSelect } from './scenes/StageSelect'
import { Game } from './scenes/Game'
import { SystemMenu } from './scenes/SystemMenu'
import { ControlsScene } from './scenes/ControlsScene'
import { ProgressionSummaryScene } from './scenes/ProgressionSummaryScene'
import GameOverScene from './scenes/GameOverScene'
import { OptionsScene } from './scenes/OptionsScene'
import { EndingScene } from './scenes/EndingScene'
import { PrologueScene } from './scenes/PrologueScene'
import { Settings } from './systems/Settings'
import { Save } from './systems/Save'
import { AUTOMATION } from './config/automation'
import { GAME_HEIGHT, GAME_WIDTH, STRICT_PIXEL_RENDER_POLICY } from './config/renderPolicy'
import { describeRenderView, installHdRendering, resolveRenderScale } from './config/hdRender'
import { resolvePlayerFeatureFlags } from './player/featureFlags'
import { summarizeSpriteKinematics } from './tools/debug/StateSnapshot'
import { getStageContentRetentionReport } from './content/campaign'

const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const rendererType = query?.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO
const runtimeResolution = STRICT_PIXEL_RENDER_POLICY.resolution
// Automation pins the device pixel ratio to 1 so a 448x252 viewport renders exactly one canvas pixel per game pixel.
const forceDprOne = query?.get('automation') === '1'
const measureRenderScale = () =>
  typeof window !== 'undefined'
    ? resolveRenderScale(window.innerWidth, window.innerHeight, window.devicePixelRatio ?? 1, forceDprOne)
    : { zoom: 1, dpr: 1, scale: 1, cssZoom: 1 }
const initialRenderScale = measureRenderScale()

const config: Phaser.Types.Core.GameConfig = {
  type: rendererType,
  parent: 'app',
  backgroundColor: '#0b0d12',
  render: {
    antialias: STRICT_PIXEL_RENDER_POLICY.antialias,
    pixelArt: STRICT_PIXEL_RENDER_POLICY.pixelArt,
    roundPixels: STRICT_PIXEL_RENDER_POLICY.roundPixels
  },
  scale: {
    // The canvas is created at device resolution (448x252 times zoom times devicePixelRatio) and each
    // scene camera zooms by the same factor, so pixel art stays on whole device pixels while text renders HD.
    // The CSS zoom (1/dpr, or zoom/scale above the scale cap) maps that canvas back to CSS pixels. See config/hdRender.ts.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: Math.round(GAME_WIDTH * initialRenderScale.scale),
    height: Math.round(GAME_HEIGHT * initialRenderScale.scale),
    zoom: initialRenderScale.cssZoom
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false
    }
  },
  pixelArt: STRICT_PIXEL_RENDER_POLICY.pixelArt,
  scene: [Boot, Preload, Title, NewCampaignScene, StageSelect, Game, SystemMenu, ControlsScene, ProgressionSummaryScene, GameOverScene, PrologueScene, EndingScene, OptionsScene]
}

;(config as any).resolution = runtimeResolution

const game = new Phaser.Game(config)
AudioService.attachGame(game)

const hdRendering = installHdRendering(game, { measure: measureRenderScale })
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => hdRendering.refresh())
}

type DebugWindow = Window & {
  __phaserGame?: Phaser.Game
  render_game_to_text?: () => string
  advanceTime?: (ms: number) => Promise<void>
}

function installDevCrashOverlay(enable: boolean): void {
  if (!enable || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  let overlay: HTMLDivElement | null = null

  const ensureOverlay = (): HTMLDivElement => {
    if (overlay) {
      return overlay
    }
    overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.left = '12px'
    overlay.style.right = '12px'
    overlay.style.bottom = '12px'
    overlay.style.padding = '12px'
    overlay.style.borderRadius = '10px'
    overlay.style.background = 'rgba(12, 18, 28, 0.95)'
    overlay.style.border = '1px solid rgba(255, 82, 82, 0.5)'
    overlay.style.color = '#ffe2e2'
    overlay.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace'
    overlay.style.fontSize = '12px'
    overlay.style.whiteSpace = 'pre-wrap'
    overlay.style.zIndex = '999999'
    overlay.style.pointerEvents = 'none'
    document.body.appendChild(overlay)
    return overlay
  }

  const showError = (title: string, detail: string) => {
    const node = ensureOverlay()
    node.textContent = `${title}\n${detail}`
  }

  window.addEventListener('error', (event) => {
    showError('Runtime Error', `${event.message}\n${event.filename}:${event.lineno}:${event.colno}`)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason =
      event.reason instanceof Error
        ? `${event.reason.name}: ${event.reason.message}`
        : String(event.reason ?? 'Unknown rejection')
    showError('Unhandled Rejection', reason)
  })
}

type SceneWithOptionalState = Phaser.Scene & {
  player?: Phaser.Physics.Arcade.Sprite
  playerHp?: number
  playerMaxHp?: number
  paused?: boolean
  currentWeaponIndex?: number
  weapons?: string[]
  playerLives?: number
  weaponEnergy?: { current: number; max: number }
  activeStageId?: string
  loadedFromSave?: boolean
  currentCheckpointIndex?: number
  bossEncounterActive?: boolean
  currentPhaseName?: string
  bossHp?: { current: number; max: number }
  bossName?: string
  bossRoomCameraLocked?: boolean
  playerBullets?: Phaser.Physics.Arcade.Group
  bossBullets?: Phaser.Physics.Arcade.Group
  enemySpawner?: {
    getEntities?: () => Array<{
      typeKey: string
      state: string
      sprite: { x: number; y: number; active: boolean; data?: Phaser.Data.DataManager }
      combat?: { currentHp?: number }
    }>
    getStreamDebugSnapshot?: () => {
      totalMarkers: number
      pendingMarkers: number
      activeMarkers: number
      retiredMarkers: number
    }
  }
  index?: number
  currentPage?: number
  requestedTransition?: unknown
  selectedBossId?: string | null
  selectedCheckpointId?: string | null
  selectedWeaknessLabel?: string | null
  selectedRewardLabel?: string | null
  finalGateText?: string | null
  canConfirm?: boolean
  confirmArmed?: boolean
  debugSummary?: {
    sourceScene: string
    seed: string
    checkedLocations: number
    receivedItems: string[]
    unlockedStages: string[]
    checkpoints: number
    finalGateText: string
  } | null
  progressionSave?: {
    stageAccessUnlocked?: string[]
    collectedChecks?: string[]
    pendingProgressionItems?: Array<{ itemId: string; amount: number }>
  }
  getNewPlayerDebugState?: () => Record<string, unknown> | null
  getCombatDebugSnapshot?: () => Record<string, unknown> | null
  getVisualDebugSnapshot?: () => Record<string, unknown> | null
  getWeaponEnergyDebugState?: () => Record<string, unknown>
  activeBossRoom?: { x: number; width: number; playerIntroX: number; bossSpawnX: number }
  touchControls?: { isVisible?: () => boolean }
}

function getActiveScene(targetGame: Phaser.Game): SceneWithOptionalState | undefined {
  const activeScenes = targetGame.scene.getScenes(true) as SceneWithOptionalState[]
  return activeScenes[0]
}

function inferNonPixelFilteredCount(targetGame: Phaser.Game): number {
  const cfg = targetGame.config as any
  const renderCfg = cfg.render ?? {}
  const antialias = renderCfg.antialias ?? cfg.antialias ?? STRICT_PIXEL_RENDER_POLICY.antialias
  const roundPixels = renderCfg.roundPixels ?? cfg.roundPixels ?? STRICT_PIXEL_RENDER_POLICY.roundPixels
  const pixelArt = cfg.pixelArt ?? STRICT_PIXEL_RENDER_POLICY.pixelArt
  let nonPixelFilteredCount = 0
  if (antialias !== STRICT_PIXEL_RENDER_POLICY.antialias) {
    nonPixelFilteredCount += 1
  }
  if (roundPixels !== STRICT_PIXEL_RENDER_POLICY.roundPixels) {
    nonPixelFilteredCount += 1
  }
  if (pixelArt !== STRICT_PIXEL_RENDER_POLICY.pixelArt) {
    nonPixelFilteredCount += 1
  }
  return nonPixelFilteredCount
}

function createStatePayload(targetGame: Phaser.Game): Record<string, unknown> {
  const scene = getActiveScene(targetGame)
  const activeScenes = targetGame.scene.getScenes(true) as SceneWithOptionalState[]
  const progressionSummaryScene = activeScenes.find((activeScene) => activeScene.scene.key === 'ProgressionSummary')
  if (!scene) {
    return {
      coordinateSystem: 'origin=(top-left), +x=right, +y=down',
      scene: 'None',
      ready: false
    }
  }

  const payload: Record<string, unknown> = {
    coordinateSystem: 'origin=(top-left), +x=right, +y=down',
    scene: scene.scene.key,
    activeScenes: activeScenes.map((activeScene) => activeScene.scene.key),
    ready: true,
    view: describeRenderView(targetGame, scene),
    identity: { title: IDENTITY.GAME_TITLE, heroCallsign: IDENTITY.HERO_CALLSIGN,
      devSkinEnabled: IDENTITY.DEV_SKIN.enabled,
      heroLabel: (scene as any).hud?.tPlayer?.text ?? null },
    spriteManifest: scene.registry.get('sprite_manifest_summary') ?? null,
    timeMs: Math.round(scene.time?.now ?? 0)
  }

  if (progressionSummaryScene) {
    payload.progressionSummary = progressionSummaryScene.debugSummary ?? null
  }
  payload.settings = Settings.get()
  const saveState = Save.load()
  payload.save = {
    exists: Save.exists(),
    storyFlags: saveState.storyFlags,
    subTanks: saveState.subTanks,
    subTankFill: saveState.subTankFill,
    difficulty: saveState.difficulty,
    gameCompleted: saveState.gameCompleted,
    hasActiveRun: Boolean(saveState.activeRun)
  }
  if (scene.scene.key === 'Prologue') payload.prologue = (scene as any).getDebugState?.() ?? null
  const systemMenu = activeScenes.find((active) => active.scene.key === 'SystemMenu') as any
  if (systemMenu) payload.systemMenu = systemMenu.getDebugState?.() ?? null
  const optionsScene = activeScenes.find((active) => active.scene.key === 'Options') as any
  if (optionsScene) payload.options = optionsScene.getDebugState?.() ?? null
  if (scene.scene.key === 'GameOver') payload.gameOver = (scene as any).getDebugState?.() ?? null
  if (scene.scene.key === 'EndingScene') payload.ending = (scene as any).getDebugState?.() ?? null
  if (scene.scene.key === 'StageSelect') payload.dialogue = (scene as any).dialogueOverlay?.getDebugState?.() ?? { active: false }

  const newCampaign = activeScenes.find(active => active.scene.key === 'NewCampaign') as NewCampaignScene | undefined
  if (newCampaign) payload.newCampaign = { ...newCampaign.model.selection(), randomizerAvailable: newCampaign.model.randomizerAvailable, confirmArmed: newCampaign.confirmArmed }

  if (scene.scene.key === 'StageSelect') {
    payload.stageSelect = {
      progressionMode: (scene as any).saveData?.progressionWorld?.progressionMode ?? 'relay_randomizer',
      tiles: (scene as any).getLayoutEvidence?.() ?? [],
      panels: (scene as any).getPanelEvidence?.() ?? null,
      index: scene.index ?? 0,
      page: scene.currentPage ?? 0,
      transitionPending: Boolean(scene.requestedTransition),
      selectedBossId: scene.selectedBossId ?? null,
      selectedCheckpointId: scene.selectedCheckpointId ?? null,
      weaknessLabel: scene.selectedWeaknessLabel ?? null,
      rewardLabel: scene.selectedRewardLabel ?? null,
      finalGateText: scene.finalGateText ?? null,
      canConfirm: Boolean(scene.canConfirm),
      confirmArmed: Boolean(scene.confirmArmed ?? true)
    }
  }

  if (scene.scene.key === 'Game') {
    payload.player = summarizeSpriteKinematics(scene.player)
    payload.playerState = {
      hp: scene.playerHp ?? null,
      maxHp: scene.playerMaxHp ?? null,
      paused: Boolean(scene.paused),
      weapon: scene.weapons?.[scene.currentWeaponIndex ?? 0] ?? null,
      lives: scene.playerLives ?? null,
      virtualControlsVisible: Boolean((scene as any).touchControls?.isVisible?.())
    }
    payload.playerVisual = {
      animationKey: scene.player?.anims?.currentAnim?.key ?? null,
      frameName: String(scene.player?.frame?.name ?? '')
    }
    payload.weaponEnergy = scene.weaponEnergy ?? null
    payload.weaponRecharge = scene.getWeaponEnergyDebugState?.() ?? null
    payload.activeRun = {
      loadedFromSave: Boolean(scene.loadedFromSave)
    }
    payload.progression = {
      progressionMode: (scene as any).progressionSave?.progressionWorld?.progressionMode ?? 'relay_randomizer',
      stats: (scene as any).progressionSave?.stats ?? null,
      upgrades: (scene as any).progressionSave?.upgradeUnlocks ?? [],
      unlockedStages: scene.progressionSave?.stageAccessUnlocked ?? [],
      collectedChecks: scene.progressionSave?.collectedChecks?.length ?? 0,
      pendingItems: scene.progressionSave?.pendingProgressionItems ?? [],
      selectedCheckpointId: (scene as any).currentCheckpointId ?? null
    }
    payload.bossState = {
      name: scene.bossName ?? null,
      phase: scene.currentPhaseName ?? '',
      hp: scene.bossHp ?? null,
      legacyActorPresent: Boolean((scene as any).bossBody),
      runtime: (scene as any).bossController?.getDebugState?.() ?? null
    }
    payload.stageRuntime = {
      stageId: scene.activeStageId ?? null,
      contentRetention: getStageContentRetentionReport(scene.activeStageId ?? ''),
      checkpointIndex: scene.currentCheckpointIndex ?? 0,
      bossEncounterActive: Boolean(scene.bossEncounterActive),
      bossGateLocked: Boolean((scene as any).bossGateLocked),
      bossGateX: Number((scene as any).bossGateLockX ?? 0),
      bossRoom: scene.activeBossRoom
        ? {
            x: Number(scene.activeBossRoom.x ?? 0),
            width: Number(scene.activeBossRoom.width ?? 0),
            playerIntroX: Number(scene.activeBossRoom.playerIntroX ?? 0),
            bossSpawnX: Number(scene.activeBossRoom.bossSpawnX ?? 0),
            cameraLocked: Boolean(scene.bossRoomCameraLocked)
          }
        : null
    }
    payload.victory = {
      modalOpen: Boolean((scene as any).victoryModal?.isOpen?.())
    }
    payload.dialogue = (scene as any).dialogueOverlay?.getDebugState?.() ?? {
      active: false,
      lineIndex: 0,
      lineCount: 0,
      sequenceId: null,
      speakerId: null,
      speakerName: null,
      text: null
    }
    payload.stageIntro = (scene as any).storyDirector?.getDebugState?.().intro ?? { phase: 'idle', active: false, cardRemainingMs: 0 }
    payload.story = (scene as any).storyDirector?.getDebugState?.() ?? null
    payload.ticker = (scene as any).toastLane?.getDebugState?.() ?? null
    payload.projectiles = {
      playerActive: scene.playerBullets?.getTotalUsed?.() ?? 0,
      bossActive: scene.bossBullets?.getTotalUsed?.() ?? 0
    }
    const enemyEntities = scene.enemySpawner?.getEntities?.() ?? []
    payload.enemies = enemyEntities.map((enemy) => ({
      typeKey: enemy.typeKey,
      state: enemy.state,
      hp:
        enemy.combat?.currentHp ??
        ((enemy.sprite.data?.get?.('hp') as number | undefined) ?? null),
      x: Math.round(enemy.sprite.x),
      y: Math.round(enemy.sprite.y),
      active: Boolean(enemy.sprite.active)
    }))
    payload.enemySpawner = scene.enemySpawner?.getStreamDebugSnapshot?.() ?? null
    payload.newPlayer = scene.getNewPlayerDebugState?.() ?? null
    payload.combatDebug = scene.getCombatDebugSnapshot?.() ?? null
    const visuals = scene.getVisualDebugSnapshot?.() ?? null
    payload.visuals = {
      placeholderCount: Number((visuals as any)?.placeholderCount ?? 0),
      missingAtlasCount: Number((visuals as any)?.missingAtlasCount ?? 0),
      backgroundLayerCount: Number((visuals as any)?.backgroundLayerCount ?? 0),
      nonPixelFilteredCount: Number(
        (visuals as any)?.nonPixelFilteredCount ?? inferNonPixelFilteredCount(targetGame)
      )
    }
    const sceneAny = scene as any
    payload.featureFlags = {
      player: sceneAny.playerFeatureFlags ?? resolvePlayerFeatureFlags(),
      enemy: sceneAny.enemyFeatureFlags ?? null
    }
  }

  payload.audio = AudioService.getDebugState()

  return payload
}

function installDebugHooks(targetGame: Phaser.Game): void {
  if (typeof window === 'undefined') {
    return
  }

  const debugWindow = window as DebugWindow
  debugWindow.render_game_to_text = () => JSON.stringify(createStatePayload(targetGame))
  debugWindow.advanceTime = async (ms: number) => {
    const frameMs = 1000 / 60
    const frames = Math.max(1, Math.round(ms / frameMs))
    await new Promise<void>((resolve) => {
      let remaining = frames
      const step = () => {
        remaining -= 1
        if (remaining <= 0) {
          resolve()
          return
        }
        window.requestAnimationFrame(step)
      }
      window.requestAnimationFrame(step)
    })
  }
  if (AUTOMATION.enabled) {
    debugWindow.__phaserGame = targetGame
  } else {
    delete debugWindow.__phaserGame
  }
}

installDebugHooks(game)
installDevCrashOverlay(false)
