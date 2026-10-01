import Phaser from 'phaser'
import { GAME_SIZE } from '../../config/renderPolicy'
import { storyPanelKey, storyPanelPath, type StoryPanelId } from './storyPanels'

const PANEL_DEPTH = -10
const FADE_MS = 260

/**
 * Part 12i (EVAL-P8-003): a story panel behind the text: the 448x252 still over the whole frame, a dark caption band
 * across its lower part, and a short cross-fade when the panel changes.
 * Loading and eviction: `queue()` in the scene's preload loads that scene's panels; the layer removes them when the
 * scene shuts down (each is 0.45MB decoded), so the prologue's four and the epilogue's four are never resident together.
 */
export class StoryPanelLayer {
  static queue(scene: Phaser.Scene, ids: readonly StoryPanelId[]): void {
    ids.forEach((id) => {
      if (!scene.textures.exists(storyPanelKey(id))) scene.load.image(storyPanelKey(id), storyPanelPath(id))
    })
  }

  private image?: Phaser.GameObjects.Image
  private panelId: StoryPanelId | null = null
  private readonly band: Phaser.GameObjects.Rectangle

  constructor(private readonly scene: Phaser.Scene, private readonly ids: readonly StoryPanelId[], bandTop: number, bandAlpha = 0.8) {
    const { width, height } = GAME_SIZE
    this.band = scene.add.rectangle(0, bandTop, width, height - bandTop, 0x0e1622, bandAlpha).setOrigin(0, 0).setDepth(PANEL_DEPTH + 1).setVisible(false)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
  }

  /** Shows `id` (cross-fading from the one before); null hides the panel and its band. */
  show(id: StoryPanelId | null): void {
    if (id === this.panelId) return
    const previous = this.image
    this.panelId = id && this.scene.textures.exists(storyPanelKey(id)) ? id : null
    this.image = undefined
    this.band.setVisible(this.panelId !== null)
    if (this.panelId) {
      this.image = this.scene.add.image(0, 0, storyPanelKey(this.panelId)).setOrigin(0, 0).setDepth(PANEL_DEPTH).setName('story-panel')
      if (previous) {
        this.image.setAlpha(0)
        this.scene.tweens.add({ targets: this.image, alpha: 1, duration: FADE_MS, onComplete: () => previous.destroy() })
        return
      }
    }
    previous?.destroy()
  }

  get current(): StoryPanelId | null {
    return this.panelId
  }

  private destroy(): void {
    this.image?.destroy()
    this.image = undefined
    this.ids.forEach((id) => {
      if (this.scene.textures.exists(storyPanelKey(id))) this.scene.textures.remove(storyPanelKey(id))
    })
  }
}
