import Phaser from 'phaser'
import { PORTRAIT_ATLAS_JSON_PATH, PORTRAIT_ATLAS_KEY, PORTRAIT_ATLAS_PNG_PATH } from './dialoguePortraits'

/**
 * The portrait atlas loads on first use, not at boot (the boot texture budget in `tests/perf-budget.json`
 * is measured on Title, which draws no portrait). Eviction: none once loaded; it is twelve 48x48 frames
 * (0.1MB decoded) drawn by the dialogue overlay in every story scene and by Stage Select.
 */
export function queuePortraitAtlas(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PORTRAIT_ATLAS_KEY)) {
    scene.load.atlas(PORTRAIT_ATLAS_KEY, PORTRAIT_ATLAS_PNG_PATH, PORTRAIT_ATLAS_JSON_PATH)
  }
}

/** Loads the atlas outside a scene's preload (the loader runs mid-scene) and calls `onReady` once it exists. */
export function ensurePortraitAtlas(scene: Phaser.Scene, onReady: () => void): void {
  if (scene.textures.exists(PORTRAIT_ATLAS_KEY)) return
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (scene.textures.exists(PORTRAIT_ATLAS_KEY)) onReady()
  })
  queuePortraitAtlas(scene)
  if (!scene.load.isLoading()) scene.load.start()
}
