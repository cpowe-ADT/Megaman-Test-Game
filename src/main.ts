import { IDENTITY } from './content/identity'
import { NewCampaignScene } from './scenes/NewCampaignScene'
import Phaser from 'phaser'
import AudioService from './audio'
import { Boot } from './scenes/Boot'
import { Preload } from './scenes/Preload'
import { Title } from './scenes/Title'
import { StageSelect } from './scenes/StageSelect'
import { BossIntroScene } from './scenes/BossIntroScene'
import { Game } from './scenes/Game'
import { SystemMenu } from './scenes/SystemMenu'
import { ControlsScene } from './scenes/ControlsScene'
import { ProgressionSummaryScene } from './scenes/ProgressionSummaryScene'
import GameOverScene from './scenes/GameOverScene'
import { OptionsScene } from './scenes/OptionsScene'
import { ProfileScene } from './scenes/ProfileScene'
import { EndingScene } from './scenes/EndingScene'
import { PrologueScene } from './scenes/PrologueScene'
import { Settings } from './systems/Settings'
import { Profiles, Save } from './systems/Save'
import { AUTOMATION } from './config/automation'
import { GAME_HEIGHT, GAME_WIDTH, STRICT_PIXEL_RENDER_POLICY } from './config/renderPolicy'
import { describeRenderView, installHdRendering, resolveRenderScale } from './config/hdRender'
import { WORLD_GRAVITY_Y } from './player/config'
import { resolvePlayerFeatureFlags } from './player/featureFlags'
import { summarizeSpriteKinematics } from './tools/debug/StateSnapshot'
import { getStageContentRetentionReport } from './content/campaign'
import { ROOM_LOCK_DATA_KEY } from './mechanics/adapters/RoomLockAdapter'
import { STAGE_MECHANICS_DATA_KEY } from './mechanics/adapters/StageMechanicsAdapter'
import { stepGameFrames, type StepGameFramesOptions } from './config/frameStepping'
import { computeFrameTimeStats, type FrameTimeStats } from './perf/frameStats'
import { createRuntimeLeakCounters } from './perf/runtimeLeakTracker'

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
      gravity: { x: 0, y: WORLD_GRAVITY_Y },
      debug: false
    }
  },
  pixelArt: STRICT_PIXEL_RENDER_POLICY.pixelArt,
  scene: [Boot, Preload, Title, ProfileScene, NewCampaignScene, StageSelect, BossIntroScene, Game, SystemMenu, ControlsScene, ProgressionSummaryScene, GameOverScene, PrologueScene, EndingScene, OptionsScene]
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
  perfDebug?: () => PerfDebugSnapshot
  stepFrames?: (frames: number, options?: StepGameFramesOptions) => number
  stepFramesActive?: boolean
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

// Part 12i (prompt 08 8.5, prompt 04 4.4): `window.perfDebug()` beside `advanceTime`, and
// `render_game_to_text().runtime` for smoke `63-restart-leak`. Both install unconditionally, the
// same tier as `render_game_to_text`/`advanceTime` (not gated on `?automation=1` the way
// `__phaserGame`/`stepFrames` are), so either works from a devtools console against any build.
const PERF_FRAME_SAMPLE_CAP = 600 // about 10s at 60fps: enough for a stable p95/p99 without unbounded growth.
const perfFrameSamplesMs: number[] = []
const perfRuntimeCounters = createRuntimeLeakCounters()
const perfPreloadTiming: { ms: number | null; bytes: number | null } = { ms: null, bytes: null }

/** `game.events` fires 'prestep' before the update/render step and 'postrender' after submission,
 * the same pair `scripts/perf/footprint.mjs`'s `stepTimes` samples from outside the page. */
function installPerfFrameSampling(targetGame: Phaser.Game): void {
  let stepStartedAt = 0
  targetGame.events.on('prestep', () => {
    stepStartedAt = performance.now()
  })
  targetGame.events.on('postrender', () => {
    if (!stepStartedAt) return
    perfFrameSamplesMs.push(performance.now() - stepStartedAt)
    if (perfFrameSamplesMs.length > PERF_FRAME_SAMPLE_CAP) perfFrameSamplesMs.shift()
  })
}

/** Time from navigation start to the Preload scene's own shutdown (it hands off to Title once every
 * asset load resolves), and the transfer bytes of every resource that finished by then. Reads the
 * scene's lifecycle event from outside it; Preload.ts is untouched. */
function installPerfPreloadTiming(targetGame: Phaser.Game): void {
  // `game.scene.getScene('Preload')` can miss its own scene object read synchronously right after
  // `new Phaser.Game(config)` (the SceneManager's initial boot queue has not run yet); waiting for the
  // loop's own first 'prestep' guarantees it has, without depending on exactly when that boot queue
  // drains.
  targetGame.events.once('prestep', () => {
    const preloadScene = targetGame.scene.getScene('Preload')
    preloadScene?.events.once('shutdown', () => {
      const doneAtMs = performance.now()
      perfPreloadTiming.ms = Math.round(doneAtMs)
      const bytes = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter((entry) => entry.responseEnd <= doneAtMs)
        .reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0)
      perfPreloadTiming.bytes = Math.round(bytes)
    })
  })
}

/** Sum of every decoded texture source's width*height*4 (prompt 08 8.5's formula), the same
 * computation `scripts/perf/footprint.mjs`'s snapshot() already uses for its own textureMB budget. */
function computePerfTextureMB(targetGame: Phaser.Game): number {
  let bytes = 0
  targetGame.textures.getTextureKeys().forEach((key) => {
    targetGame.textures.get(key).source.forEach((source: { width?: number; height?: number }) => {
      bytes += (source.width ?? 0) * (source.height ?? 0) * 4
    })
  })
  return bytes / (1024 * 1024)
}

/**
 * Wraps the global listener and timer APIs once at module load so a leak anywhere (not only
 * Phaser's own emitters) shows up. `setTimeout`/`setInterval` track their own id so a natural
 * `setTimeout` firing ends its count the same as an explicit `clearTimeout` (an interval only ends on
 * `clearInterval`); `addEventListener`/`removeEventListener` count 1:1 per call, so registering the
 * exact same (type, listener, capture) twice -- which the DOM itself dedupes -- over-counts by one.
 * That is the safe direction for a leak check: a rare false add, never a hidden real one.
 */
function installPerfRuntimeLeakTracking(): void {
  if (typeof window === 'undefined') return
  const originalAddEventListener = EventTarget.prototype.addEventListener
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener
  EventTarget.prototype.addEventListener = function (this: EventTarget, ...args: Parameters<typeof originalAddEventListener>) {
    perfRuntimeCounters.addListener()
    return originalAddEventListener.apply(this, args)
  }
  EventTarget.prototype.removeEventListener = function (this: EventTarget, ...args: Parameters<typeof originalRemoveEventListener>) {
    perfRuntimeCounters.removeListener()
    return originalRemoveEventListener.apply(this, args)
  }

  const originalSetTimeout = window.setTimeout.bind(window)
  const originalClearTimeout = window.clearTimeout.bind(window)
  const originalSetInterval = window.setInterval.bind(window)
  const originalClearInterval = window.clearInterval.bind(window)
  const pendingTimeoutIds = new Set<number>()
  const pendingIntervalIds = new Set<number>()

  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) => {
    let id = 0
    id = originalSetTimeout(
      (...callbackArgs: unknown[]) => {
        pendingTimeoutIds.delete(id)
        perfRuntimeCounters.endTimer()
        if (typeof handler === 'function') handler(...callbackArgs)
      },
      timeout,
      ...rest
    ) as unknown as number
    pendingTimeoutIds.add(id)
    perfRuntimeCounters.startTimer()
    return id
  }) as typeof window.setTimeout

  window.clearTimeout = ((id?: Parameters<typeof originalClearTimeout>[0]) => {
    if (typeof id === 'number' && pendingTimeoutIds.delete(id)) {
      perfRuntimeCounters.endTimer()
    }
    return originalClearTimeout(id)
  }) as typeof window.clearTimeout

  window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) => {
    const id = originalSetInterval(handler, timeout, ...rest) as unknown as number
    pendingIntervalIds.add(id)
    perfRuntimeCounters.startTimer()
    return id
  }) as typeof window.setInterval

  window.clearInterval = ((id?: Parameters<typeof originalClearInterval>[0]) => {
    if (typeof id === 'number' && pendingIntervalIds.delete(id)) {
      perfRuntimeCounters.endTimer()
    }
    return originalClearInterval(id)
  }) as typeof window.clearInterval
}

type PerfDebugSnapshot = {
  frameMs: FrameTimeStats
  renderScale: number
  textureMB: number
  jsHeapMB: number | null
  preload: { ms: number | null; bytes: number | null }
}

function buildPerfDebugSnapshot(targetGame: Phaser.Game, measure: () => { scale: number }): PerfDebugSnapshot {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return {
    frameMs: computeFrameTimeStats(perfFrameSamplesMs),
    renderScale: measure().scale,
    textureMB: Math.round(computePerfTextureMB(targetGame) * 100) / 100,
    jsHeapMB: memory ? Math.round((memory.usedJSHeapSize / (1024 * 1024)) * 100) / 100 : null,
    preload: { ...perfPreloadTiming }
  }
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
  payload.profiles = { ...Profiles.debugState(), screen: (activeScenes.find((active) => active.scene.key === 'Profiles') as any)?.getDebugState?.() ?? null }
  if (scene.scene.key === 'Prologue') payload.prologue = (scene as any).getDebugState?.() ?? null
  const systemMenu = activeScenes.find((active) => active.scene.key === 'SystemMenu') as any
  if (systemMenu) payload.systemMenu = systemMenu.getDebugState?.() ?? null
  const optionsScene = activeScenes.find((active) => active.scene.key === 'Options') as any
  if (optionsScene) payload.options = optionsScene.getDebugState?.() ?? null
  if (scene.scene.key === 'GameOver') payload.gameOver = (scene as any).getDebugState?.() ?? null
  if (scene.scene.key === 'EndingScene') payload.ending = (scene as any).getDebugState?.() ?? null
  if (scene.scene.key === 'StageSelect') payload.dialogue = (scene as any).dialogueOverlay?.getDebugState?.() ?? { active: false }
  // Part 13g, EVAL-P13-012: the pre-stage boss card's own bossIntro (phase, name, visibleCharacters); the
  // Game scene's bossIntro (the in-stage door WARNING, BossPresentation.getDebugState) is set further down
  // and the two are never active together.
  if (scene.scene.key === 'BossIntro') payload.bossIntro = (scene as any).getDebugState?.() ?? null

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
    {
      const camera = scene.cameras.main
      const cameraBounds = camera.getBounds()
      payload.camera = {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        midPointX: camera.midPoint.x,
        midPointY: camera.midPoint.y,
        boundsX: cameraBounds.x,
        boundsY: cameraBounds.y,
        boundsWidth: cameraBounds.width,
        boundsHeight: cameraBounds.height
      }
    }
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
    // Part 12i: `card` is 'weapon_get' then 'results' (StageClearCards.getDebugState); `bossIntro` is the WARNING,
    // name card and bar fill beat (BossPresentation.getDebugState).
    payload.victory = {
      modalOpen: Boolean((scene as any).victoryModal?.isOpen?.()),
      ...((scene as any).victoryModal?.getDebugState?.() ?? {})
    }
    // 13d (EVAL-P13-013): also at the top level, as the task names it (render_game_to_text().weaponDemo).
    payload.weaponDemo = (payload.victory as { weaponDemo?: unknown }).weaponDemo ?? null
    payload.bossIntro = (scene as any).bossBeats?.presentation?.getDebugState?.() ?? null
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
    payload.mechanics = {
      roomLocks: scene.data?.get?.(ROOM_LOCK_DATA_KEY)?.getDebugState?.() ?? [],
      verticalSegments: scene.data?.get?.(ROOM_LOCK_DATA_KEY)?.getSegmentDebugState?.() ?? [],
      ...(scene.data?.get?.(STAGE_MECHANICS_DATA_KEY)?.getDebugState?.() ?? {})
    }
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
  // Part 12i, smoke `63-restart-leak`: native listener/timer counts from installPerfRuntimeLeakTracking,
  // zeroed only if that installer has not run yet (it is called once, unconditionally, at module load).
  payload.runtime = perfRuntimeCounters.snapshot()

  return payload
}

function installDebugHooks(targetGame: Phaser.Game): void {
  if (typeof window === 'undefined') {
    return
  }

  const debugWindow = window as DebugWindow
  debugWindow.render_game_to_text = () => JSON.stringify(createStatePayload(targetGame))
  debugWindow.perfDebug = () => buildPerfDebugSnapshot(targetGame, measureRenderScale)
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
    debugWindow.stepFrames = (frames: number, options?: StepGameFramesOptions) => {
      debugWindow.stepFramesActive = true
      const stepped = stepGameFrames(targetGame, frames, options)
      debugWindow.stepFramesActive = false
      return stepped
    }
    debugWindow.stepFramesActive = false
  } else {
    delete debugWindow.__phaserGame
    delete debugWindow.stepFrames
    delete debugWindow.stepFramesActive
  }
}

installDebugHooks(game)
installPerfFrameSampling(game)
installPerfPreloadTiming(game)
installPerfRuntimeLeakTracking()
installDevCrashOverlay(false)
