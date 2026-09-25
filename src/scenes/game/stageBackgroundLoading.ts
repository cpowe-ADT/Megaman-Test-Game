import type Phaser from 'phaser'
import type { LoadableAtlasEntry } from '../../assets/types'
import { AUTOMATION } from '../../config/automation'
import { HERO_COMBAT_ATLASES } from '../../combat/heroCombatVisuals'
import { getCampaignStage } from '../../content/campaign'
import { MECHANICS_ATLAS, MECHANICS_V2_ATLAS } from '../../mechanics/mechanicsVisuals'
import { TELEGRAPHS_ATLAS } from '../../boss/telegraphArt'
import { HUD_ICONS_ATLAS, WEAPONS_ATLAS } from '../../projectiles/weaponArt'
import { PICKUPS_ATLAS } from '../../ui/pickups/pickupArt'
import { STAGE_BACKGROUND_ASSETS, type StageBackgroundAsset } from '../../content/stageBackgroundCatalog'
import { queueStageTileAtlas } from './stageTileLoading'

/**
 * Stage backgrounds load per stage, not per game. Each 384x216 layer is 0.33MB decoded whatever its
 * PNG weighs, and Preload used to hold all 30 catalog layers (9.2MB) for a stage that draws four or five.
 */

/** Layers a scene outside a stage draws: the prologue drifts the dock skyline. Preload keeps these. */
export const RESIDENT_BACKGROUND_KEYS: readonly string[] = ['bg_dock_0']

export type GameStartData = { stageId?: string; bossId?: string; loadFromSave?: boolean } | undefined | null
type ActiveRunIds = { stageId?: string; bossId?: string } | null | undefined

/** The stage the Game scene will build from its start data: a resumed run wins, then the stage, then the boss id. */
export function resolveGameStageId(data: GameStartData, activeRun: ActiveRunIds): string {
  return activeRun?.stageId ?? data?.stageId ?? data?.bossId ?? 'pyro_maw'
}

/** Automation's `?bossId=` override (automation builds only). */
export function automationBossQuery(): string | null {
  if (!AUTOMATION.enabled || typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('bossId')
}

/**
 * The stage and the boss the Game scene will run, one rule for preload (which atlases to queue) and
 * create (which boss to build): a resumed run wins, then automation's override, then the start data,
 * then the stage's own boss.
 */
export function resolveGameStageAndBoss(data: GameStartData, activeRun: ActiveRunIds, queryBossId: string | null = automationBossQuery()): [string, string] {
  const stageId = resolveGameStageId(data, activeRun)
  return [stageId, activeRun?.bossId ?? queryBossId ?? data?.bossId ?? getCampaignStage(stageId).bossId]
}

export function stageBackgroundKeys(stageId: string): string[] {
  return (getCampaignStage(stageId).arena.background?.layers ?? []).map((layer) => layer.key)
}

export function stageBackgroundAssets(stageId: string): StageBackgroundAsset[] {
  const keys = new Set(stageBackgroundKeys(stageId))
  return STAGE_BACKGROUND_ASSETS.filter((asset) => keys.has(asset.key))
}

export function residentBackgroundAssets(): StageBackgroundAsset[] {
  return STAGE_BACKGROUND_ASSETS.filter((asset) => RESIDENT_BACKGROUND_KEYS.includes(asset.key))
}

/** Background textures to drop before building `stageId`: everything but its own layers and the resident set. */
export function backgroundKeysToEvict(loadedKeys: readonly string[], stageId: string): string[] {
  const keep = new Set([...RESIDENT_BACKGROUND_KEYS, ...stageBackgroundKeys(stageId)])
  const catalog = new Set(STAGE_BACKGROUND_ASSETS.map((asset) => asset.key))
  return loadedKeys.filter((key) => catalog.has(key) && !keep.has(key))
}

/**
 * Called from Game.preload(): drops the previous stage's layers (its objects were destroyed at
 * shutdown) and queues this stage's. Keys already loaded are skipped, so a restart loads nothing
 * and Phaser runs create() in the same step.
 */
export function queueStageBackgrounds(scene: Phaser.Scene, stageId: string): void {
  backgroundKeysToEvict(scene.textures.getTextureKeys(), stageId).forEach((key) => scene.textures.remove(key))
  stageBackgroundAssets(stageId).forEach((asset) => {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.path)
    }
  })
}

/**
 * Atlases only the Game scene draws: the hero's buster, saber and hit art, the stage mechanics art
 * (v1: vents, slag, walls, crumbles, gates, 256x262; v2: conveyors, ice, rails, wind, currents, rockfall,
 * 256x212), the boss attack tells (256x112), the warden weapon shots (256x222) and the pickups (128x178, 12h). Recorded in the sprite manifest with loadScope 'game',
 * so Preload skips them; tests/hero-combat-visuals.test.ts and tests/mechanics-visuals.test.ts keep the
 * two in step. Rule: loaded on the first Game.preload and kept resident across stages, never evicted,
 * because every stage draws them (every pit has slag, every boss telegraphs, every weapon is one pickup away) and together they are about 1.1MB decoded.
 */
export const GAME_SCENE_ATLASES = [...HERO_COMBAT_ATLASES, MECHANICS_ATLAS, MECHANICS_V2_ATLAS, TELEGRAPHS_ATLAS, WEAPONS_ATLAS, PICKUPS_ATLAS, HUD_ICONS_ATLAS] as const

export function queueGameSceneAtlases(scene: Phaser.Scene): void {
  GAME_SCENE_ATLASES.forEach((atlas) => {
    if (!scene.textures.exists(atlas.key)) {
      scene.load.atlas(atlas.key, atlas.image, atlas.data)
    }
  })
}

/**
 * Atlases only some stages draw (loadScope 'stage' in the sprite manifest): the mini-bosses and their
 * stage skins (about 0.38MB each at 64px, a stage places one or two) and each warden's atlas (0.25MB
 * each, 2.5MB for all ten, which Preload used to hold for a stage that fights one). Preload skips them, so the boot texture budget does not pay for them; the list below
 * matches the manifest's 'stage' entries (tests/stage-background-loading.test.ts). Rule: queued
 * by the stages whose enemy markers use the family (`atlas_<typeKey>`) and by the stage that fights the boss
 * (`atlas_<bossId>`), evicted when a stage that needs neither is built. Enemy and boss animations are made on
 * first use (EnemyAnimator, BossController), after this load.
 */
export const STAGE_SCOPED_BOSS_IDS = ['sentinel_rook', 'pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin', 'omega_core'] as const

/** The mini-boss families (12c, `src/enemy/minibossCatalog.ts`), one atlas per archetype and skin. */
export const STAGE_SCOPED_ENEMY_FAMILIES = [
  'custodian_walker',
  'custodian_walker_basalt',
  'custodian_walker_glacier',
  'relay_turret_nest',
  'relay_turret_nest_ferro',
  'sentry_twin',
  'sentry_twin_gale',
  'drill_serpent'
] as const

export const STAGE_SCOPED_ATLASES: readonly LoadableAtlasEntry[] = [
  ...STAGE_SCOPED_ENEMY_FAMILIES.map((typeKey) => ({
    id: `enemies-${typeKey}`,
    atlasKey: `atlas_${typeKey}`,
    runtimeImage: `/assets/sprites/enemies/${typeKey}/${typeKey}.png`,
    runtimeData: `/assets/sprites/enemies/${typeKey}/${typeKey}.atlas.json`
  })),
  ...STAGE_SCOPED_BOSS_IDS.map((bossId) => ({
    id: `boss-${bossId.replace(/_/g, '-')}`,
    atlasKey: `atlas_${bossId}`,
    runtimeImage: `/assets/sprites/bosses/${bossId}.png`,
    runtimeData: `/assets/sprites/bosses/${bossId}.json`
  }))
]

export function stageScopedAtlases(stageId: string, bossId: string = getCampaignStage(stageId).bossId): LoadableAtlasEntry[] {
  const used = new Set(getCampaignStage(stageId).enemyMarkers.map((marker) => `atlas_${marker.typeKey}`))
  used.add(`atlas_${bossId}`)
  return STAGE_SCOPED_ATLASES.filter((entry) => used.has(entry.atlasKey))
}

export function stageScopedAtlasKeysToEvict(loadedKeys: readonly string[], stageId: string, bossId?: string): string[] {
  const keep = new Set(stageScopedAtlases(stageId, bossId).map((entry) => entry.atlasKey))
  const scoped = new Set(STAGE_SCOPED_ATLASES.map((entry) => entry.atlasKey))
  return loadedKeys.filter((key) => scoped.has(key) && !keep.has(key))
}

export function queueStageScopedAtlases(scene: Phaser.Scene, stageId: string, bossId?: string): void {
  stageScopedAtlasKeysToEvict(scene.textures.getTextureKeys(), stageId, bossId).forEach((key) => scene.textures.remove(key))
  stageScopedAtlases(stageId, bossId).forEach((entry) => {
    if (!scene.textures.exists(entry.atlasKey)) {
      scene.load.atlas(entry.atlasKey, entry.runtimeImage, entry.runtimeData)
    }
  })
}

/** Everything Game.preload() queues for a stage: its background layers, its biome tile atlas, its boss and stage-scoped enemy atlases and the resident Game-scene atlases. */
export function queueStageAssets(scene: Phaser.Scene, stageId: string, bossId?: string): void {
  queueStageBackgrounds(scene, stageId)
  queueStageTileAtlas(scene, stageId)
  queueStageScopedAtlases(scene, stageId, bossId)
  queueGameSceneAtlases(scene)
}
