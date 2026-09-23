/**
 * HD rendering: pixel art at an integer zoom, text at the display's real resolution.
 *
 * The game is authored at 448x252. Before this module the canvas stayed 448x252 and was scaled
 * with CSS, so every glyph was an upscaled 1x bitmap. Now the canvas is created at
 * 448*scale x 252*scale (scale = integer zoom * devicePixelRatio), every scene camera zooms by
 * `scale`, and every Text object renders its internal canvas at `scale` so it maps 1:1 to device
 * pixels. Sprites still land on whole device pixels, so the pixel art is unchanged.
 *
 * Phaser cameras zoom around their centre by default, which throws scroll-factor-0 HUD objects
 * off screen at any zoom above 1. `HdCamera` zooms around the top-left instead and re-implements
 * the few helpers that assume a centred origin (bounds clamp, centerOn, follow, worldView), so
 * world coordinates, scroll values and HUD placement mean exactly what they did at 1x.
 */
import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './renderPolicy'
import { centerScroll, clampScroll, worldViewFor, type RenderScale } from './hdRenderMath'

export { resolveRenderScale, clampScroll, centerScroll, worldViewFor } from './hdRenderMath'
export type { RenderScale } from './hdRenderMath'

type BoundsRect = { x: number; y: number; width: number; height: number; centerX: number; centerY: number }

export class HdCamera extends Phaser.Cameras.Scene2D.Camera {
  private requestedFollowOffset = { x: 0, y: 0 }

  constructor(x: number, y: number, width: number, height: number) {
    super(x, y, width, height)
    this.setOrigin(0, 0)
  }

  private get boundsRect(): BoundsRect | null {
    const bounds = (this as unknown as { _bounds?: BoundsRect })._bounds
    return this.useBounds && bounds ? bounds : null
  }

  override clampX(x: number): number {
    const bounds = this.boundsRect
    return bounds ? clampScroll(x, bounds.x, bounds.width, this.displayWidth) : x
  }

  override clampY(y: number): number {
    const bounds = this.boundsRect
    return bounds ? clampScroll(y, bounds.y, bounds.height, this.displayHeight) : y
  }

  override getScroll(x: number, y: number, out?: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const result = out ?? new Phaser.Math.Vector2()
    result.x = this.clampX(centerScroll(x, this.displayWidth))
    result.y = this.clampY(centerScroll(y, this.displayHeight))
    return result
  }

  override centerOnX(x: number): this {
    this.midPoint.x = x
    this.scrollX = this.clampX(centerScroll(x, this.displayWidth))
    return this
  }

  override centerOnY(y: number): this {
    this.midPoint.y = y
    this.scrollY = this.clampY(centerScroll(y, this.displayHeight))
    return this
  }

  override centerOn(x: number, y: number): this {
    this.centerOnX(x)
    this.centerOnY(y)
    return this
  }

  override centerToBounds(): this {
    const bounds = this.boundsRect
    if (bounds) {
      this.midPoint.set(bounds.centerX, bounds.centerY)
      this.scrollX = centerScroll(bounds.centerX, this.displayWidth)
      this.scrollY = centerScroll(bounds.centerY, this.displayHeight)
    }
    return this
  }

  /** Follow keeps the target centred: the offset is measured from the centre of the view. */
  override startFollow(
    target: object,
    roundPixels = false,
    lerpX = 1,
    lerpY = lerpX,
    offsetX = 0,
    offsetY = 0
  ): this {
    this.requestedFollowOffset = { x: offsetX, y: offsetY }
    super.startFollow(target, roundPixels, lerpX, lerpY, offsetX, offsetY)
    this.refreshFollowOffset()
    return this
  }

  override setFollowOffset(x = 0, y = 0): this {
    this.requestedFollowOffset = { x, y }
    this.refreshFollowOffset()
    return this
  }

  override setZoom(x = 1, y = x): this {
    super.setZoom(x, y)
    this.refreshFollowOffset()
    return this
  }

  override setSize(width: number, height?: number): this {
    super.setSize(width, height)
    this.refreshFollowOffset()
    return this
  }

  private refreshFollowOffset(): void {
    // Phaser subtracts followOffset from the target and, with a top-left origin, adds nothing
    // else, so half the view is folded into the offset to keep the target centred.
    this.followOffset.set(
      this.requestedFollowOffset.x + this.displayWidth / 2,
      this.requestedFollowOffset.y + this.displayHeight / 2
    )
  }

  override preRender(): void {
    super.preRender()
    const view = worldViewFor(this.scrollX, this.scrollY, this.width, this.height, this.zoomX, this.zoomY)
    this.midPoint.set(view.x + view.width / 2, view.y + view.height / 2)
    this.worldView.setTo(view.x, view.y, view.width, view.height)
  }
}

let current: RenderScale = { zoom: 1, dpr: 1, scale: 1, cssZoom: 1 }
const trackedTexts = new Set<Phaser.GameObjects.Text>()
let factoriesPatched = false

export function getRenderScale(): RenderScale {
  return current
}

/**
 * Phaser's Text.setResolution updates the style and re-renders, but only the constructor copies the
 * resolution onto the texture source, and the canvas renderer divides the draw size by that source
 * value. Keep both in sync or canvas-rendered text shows at `scale` times its size.
 */
function applyTextResolution(text: Phaser.GameObjects.Text, scale: number): void {
  if (text.style.resolution !== scale) text.setResolution(scale)
  const source = text.frame?.source as { resolution?: number } | undefined
  if (source && source.resolution !== scale) source.resolution = scale
}

function trackText(text: Phaser.GameObjects.Text): void {
  if (!text || typeof text.setResolution !== 'function') return
  applyTextResolution(text, current.scale)
  trackedTexts.add(text)
  text.once(Phaser.GameObjects.Events.DESTROY, () => trackedTexts.delete(text))
}

function patchTextFactories(): void {
  if (factoriesPatched) return
  factoriesPatched = true
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as Record<string, (...args: unknown[]) => unknown>
  const creator = Phaser.GameObjects.GameObjectCreator.prototype as unknown as Record<string, (...args: unknown[]) => unknown>
  for (const target of [factory, creator]) {
    const original = target.text
    if (typeof original !== 'function') continue
    target.text = function (this: unknown, ...args: unknown[]) {
      const text = original.apply(this, args) as Phaser.GameObjects.Text
      trackText(text)
      return text
    }
  }
}

function applyToScene(scene: Phaser.Scene): void {
  const cameras = scene.cameras
  if (!cameras) return
  let main = cameras.main as Phaser.Cameras.Scene2D.Camera | undefined
  if (!(main instanceof HdCamera)) {
    const hd = new HdCamera(0, 0, scene.scale.width, scene.scale.height)
    if (main) cameras.remove(main, true)
    cameras.addExisting(hd, true)
    main = hd
  }
  main.setZoom(current.scale)
}

export interface InstallHdRenderingOptions {
  /** Measure the window and device for the render scale. */
  measure: () => RenderScale
}

/**
 * Installs HD rendering on a game: swaps every scene's main camera for an HdCamera when the
 * scene starts, tracks Text objects so their resolution follows the render scale, and resizes
 * the canvas whenever `refresh()` is called (bind it to the window resize event).
 */
export function installHdRendering(game: Phaser.Game, options: InstallHdRenderingOptions): { refresh: () => void } {
  current = options.measure()
  patchTextFactories()

  const bindScenes = (): void => {
    game.scene.scenes.forEach((scene) => {
      scene.events.on(Phaser.Scenes.Events.START, () => applyToScene(scene))
      // A scene paused under a menu misses refresh(); catch up when it comes back.
      scene.events.on(Phaser.Scenes.Events.RESUME, () => applyToScene(scene))
      scene.events.on(Phaser.Scenes.Events.WAKE, () => applyToScene(scene))
      if (scene.sys.settings.status >= Phaser.Scenes.RUNNING && scene.sys.settings.status < Phaser.Scenes.SHUTDOWN) {
        applyToScene(scene)
      }
    })
  }
  // Scenes are instantiated by the SceneManager on the game's READY event (isBooted turns true
  // earlier, while textures are still loading), so bind only once the scene list exists.
  if (game.scene.scenes.length > 0) bindScenes()
  else game.events.once(Phaser.Core.Events.READY, bindScenes)

  const refresh = (): void => {
    const next = options.measure()
    current = next
    if (Math.abs(game.scale.zoom - next.cssZoom) > 0.0001) game.scale.setZoom(next.cssZoom)
    const width = Math.round(GAME_WIDTH * next.scale)
    const height = Math.round(GAME_HEIGHT * next.scale)
    if (game.scale.width !== width || game.scale.height !== height) game.scale.resize(width, height)
    // Re-apply even when the scale is unchanged: a resize can re-centre the canvas and scenes may
    // have started since the last measurement.
    game.scene.getScenes(true).forEach((scene) => applyToScene(scene))
    trackedTexts.forEach((text) => {
      if (text.active) applyTextResolution(text, next.scale)
    })
    game.scale.refresh()
  }

  return { refresh }
}

/** Debug snapshot for automation: canvas size, camera zoom and text resolution of a scene. */
export function describeRenderView(game: Phaser.Game, scene?: Phaser.Scene | null) {
  const main = scene?.cameras?.main
  const sample = scene?.children?.list?.find((child) => child instanceof Phaser.GameObjects.Text) as
    | Phaser.GameObjects.Text
    | undefined
  return {
    canvasWidth: game.scale.width,
    canvasHeight: game.scale.height,
    cssZoom: game.scale.zoom,
    zoom: current.zoom,
    dpr: current.dpr,
    scale: current.scale,
    cameraZoom: main?.zoom ?? null,
    cameraOrigin: main ? { x: main.originX, y: main.originY } : null,
    cameraIsHd: main instanceof HdCamera,
    textResolution: sample?.style?.resolution ?? null,
    textSourceResolution: (sample?.frame?.source as { resolution?: number } | undefined)?.resolution ?? null,
    textCanvasWidth: sample?.canvas?.width ?? null,
    textDisplayWidth: sample ? Math.round(sample.width) : null
  }
}
