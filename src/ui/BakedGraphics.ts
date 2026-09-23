import Phaser from 'phaser'
import { getRenderScale } from '../config/hdRender'

export type BakeBounds = { x: number; y: number; width: number; height: number }

/**
 * A Graphics drawn once into a texture at the current render scale, shown through an Image.
 *
 * Phaser rebuilds a visible Graphics' triangles on every frame, rounded corners included, whether or not
 * anything changed. The HUD's rounded panels and fourteen-cell bars were about 4.2ms of a 4.6ms stage
 * frame (headless, `npm run perf:footprint`). Baked, the cost is paid only when the drawing changes or the
 * window's render scale does. The texture is `bounds * scale` pixels and the Image is scaled by `1 / scale`,
 * so under the scene camera's zoom it lands 1:1 on device pixels and looks as it did.
 */
export class BakedGraphics {
  /** Draw into this, then call `bake`. It is never on the display list. */
  readonly graphics: Phaser.GameObjects.Graphics
  readonly image: Phaser.GameObjects.Image
  private readonly texture: Phaser.Textures.DynamicTexture

  constructor(private readonly scene: Phaser.Scene, key: string) {
    this.graphics = scene.make.graphics({}, false)
    // One texture per key for the whole session: a new HUD after a scene restart reuses it.
    const existing = scene.textures.exists(key) ? scene.textures.get(key) : null
    this.texture =
      existing instanceof Phaser.Textures.DynamicTexture
        ? existing
        : (scene.textures.addDynamicTexture(key, 1, 1) as Phaser.Textures.DynamicTexture)
    this.image = scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0)
    // Off the display list, so the scene will not destroy it.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.graphics.destroy())
  }

  /** Renders `graphics` (drawn in game pixels) into the texture; `bounds` must contain the drawing. */
  bake(bounds: BakeBounds): void {
    // A HUD from a finished run can still be called while the next run's create() sets up (Game.ts
    // updates the weapon label before it replaces `hud`). Drawing into a dead Graphics was harmless;
    // retexturing a destroyed Image is not, so a shut-down layer ignores the call.
    if (!this.image.scene) {
      return
    }
    const scale = Math.max(0.25, getRenderScale().scale)
    const width = Math.max(1, Math.ceil(bounds.width * scale))
    const height = Math.max(1, Math.ceil(bounds.height * scale))
    if (this.texture.width !== width || this.texture.height !== height) {
      this.texture.setSize(width, height)
    }
    this.texture.clear()
    this.graphics.setScale(scale).setPosition(-bounds.x * scale, -bounds.y * scale)
    this.texture.draw(this.graphics)
    this.image.setTexture(this.texture.key)
    this.image.setPosition(bounds.x, bounds.y).setScale(1 / scale)
  }

  destroy(): void {
    this.graphics.destroy()
    this.image.destroy()
  }
}
