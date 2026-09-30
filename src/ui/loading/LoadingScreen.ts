import Phaser from 'phaser'
import { GAME_SIZE } from '../../config/renderPolicy'
import { PIXEL_FONT, PIXEL_FONT_FAMILY, pixelFontSize } from '../menu/menuTheme'
import { firstVisitControlsLines, loadingBarFill } from './loadingScreenModel'

/** The drawn OMEGA RELAY logo (Higgsfield, keyed and snapped to the relay palette; `assets/ui/README.md`). */
export const LOGO_TEXTURE_KEY = 'ui_logo_omega_relay'
export const LOGO_PATH = 'assets/ui/logo/omega_relay_logo.png'

const BAR = { x: 124, y: 150, width: 200, height: 6 }

/**
 * Part 12i (EVAL-P8-003): the Preload loading screen. The logo is queued first and drawn the moment it lands, the bar
 * follows the loader, and a first visit gets a note naming the controls once the pixel font is in.
 * Loading and eviction: every object here dies with the Preload scene. The logo texture stays resident (320x64,
 * 80KB decoded): the Title draws it next.
 */
export class LoadingScreen {
  private readonly bar: Phaser.GameObjects.Graphics
  private logo?: Phaser.GameObjects.Image
  private note?: Phaser.GameObjects.Text
  private progress = 0

  constructor(private readonly scene: Phaser.Scene, private readonly firstVisit: boolean) {
    scene.cameras.main.setBackgroundColor('#0E1622')
    scene.add.rectangle(BAR.x - 2, BAR.y - 2, BAR.width + 4, BAR.height + 4, 0x141a26, 1).setOrigin(0, 0).setStrokeStyle(1, 0x5c7fa8, 1)
    this.bar = scene.add.graphics()
    this.draw(0)
    scene.load.on(Phaser.Loader.Events.PROGRESS, this.draw, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.load.off(Phaser.Loader.Events.PROGRESS, this.draw, this))
    if (scene.textures.exists(LOGO_TEXTURE_KEY)) this.showLogo()
    else {
      scene.load.once(`filecomplete-image-${LOGO_TEXTURE_KEY}`, () => this.showLogo())
      scene.load.image(LOGO_TEXTURE_KEY, LOGO_PATH)
    }
  }

  /** Called once the pixel font is in (or at once if it already was): a Text measured before it would keep the fallback. */
  fontReady(): void {
    if (!this.firstVisit || this.note) return
    const { width } = GAME_SIZE
    this.note = this.scene.add.text(width / 2, BAR.y + 26, firstVisitControlsLines().join('\n'), {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#8fb8dd', align: 'center', lineSpacing: 6
    }).setOrigin(0.5, 0).setName('loading-controls-note')
  }

  getDebugState(): { progress: number; logo: boolean; note: string | null; fontFamily: string } {
    return { progress: this.progress, logo: Boolean(this.logo), note: this.note?.text ?? null, fontFamily: PIXEL_FONT_FAMILY }
  }

  private showLogo(): void {
    if (this.logo || !this.scene.textures.exists(LOGO_TEXTURE_KEY)) return
    const { width } = GAME_SIZE
    this.logo = this.scene.add.image(width / 2, 100, LOGO_TEXTURE_KEY).setName('loading-logo')
  }

  private draw(progress: number): void {
    this.progress = progress
    this.bar.clear()
    this.bar.fillStyle(0xf2a93b, 1).fillRect(BAR.x, BAR.y, loadingBarFill(progress, BAR.width), BAR.height)
  }
}
