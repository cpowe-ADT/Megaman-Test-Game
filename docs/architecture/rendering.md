# Rendering: pixel art at integer zoom, text at device resolution

- Status: canonical
- Owner scope: runtime
- Last reviewed: 2026-09-10

The game is authored at 448x252 (`GAME_WIDTH`, `GAME_HEIGHT` in `src/config/renderPolicy.ts`). Every gameplay and UI coordinate stays in that space.

## How a frame reaches the screen

1. `resolveRenderScale(window.innerWidth, window.innerHeight, devicePixelRatio)` (`src/config/hdRenderMath.ts`) picks the window zoom (`resolveGameZoom`: the largest whole number from 2x up, the exact ratio below that) and multiplies it by the device pixel ratio. Products within 2% of a whole number snap to it, so a 1.5x window on a 2x display is an exact 3x canvas.
2. The Phaser canvas is created at `448 * scale` by `252 * scale` with a CSS zoom of `1 / dpr`, so it occupies `448 * zoom` CSS pixels but holds one canvas pixel per device pixel.
3. Every scene's main camera is an `HdCamera` (`src/config/hdRender.ts`) at zoom `scale`. Sprites therefore land on whole device pixels, exactly as the old CSS scaling did.
4. Every `Text` object is created through patched `add.text` / `make.text` factories that set `resolution = scale`, so its internal canvas is rendered at device resolution and drawn 1:1. That is what makes text HD at any window size. `BitmapText` (the HUD digits font) is pixel art and scales like a sprite.
5. On window resize `installHdRendering(...).refresh()` recomputes the scale, resizes the canvas, re-zooms the active cameras and re-renders tracked text.

Under `automation=1` the device pixel ratio is pinned to 1, so a 448x252 Playwright viewport renders exactly one canvas pixel per game pixel and every existing screenshot assertion holds.

## Why the camera is a subclass

Phaser zooms a camera around its centre. With a 448*scale canvas and zoom `scale`, objects with scroll factor 0 (the HUD, toasts, dialogue) would be drawn at `x*scale - 224*scale*(scale-1)`, off screen. `HdCamera` sets the origin to the top-left and re-implements the helpers that assume a centred origin: `clampX/clampY` (bounds), `centerOn*`, `centerToBounds`, `getScroll`, `startFollow`/`setFollowOffset` (half the view is folded into the follow offset so the player stays centred) and `preRender` (fixes `worldView` and `midPoint`). Scroll values keep their 1x meaning: `scrollX` is the world x at the left edge of the screen.

## Rules for code

- Never read `scene.scale.width` / `scene.scale.height` for layout; they are canvas pixels. Use `GAME_WIDTH` / `GAME_HEIGHT`.
- Pointer positions: `pointer.x` / `pointer.y` are canvas pixels. Use `pointer.worldX` / `pointer.worldY` (or `camera.getWorldPoint`) when testing against game-space bounds. Interactive objects are hit-tested through the camera automatically.
- Camera shake intensity is a fraction of the canvas width times zoom, so `Game.onCameraShake` divides by the camera zoom.
- Custom cameras (`cameras.add`) are not upgraded automatically; construct an `HdCamera` and `addExisting` it.

## Gates

- `tests/hd-render.test.ts`: render-scale selection and the top-left scroll math.
- Smoke `40-hd-render`: a 896x504 window gets a 896x504 canvas, camera zoom 2 with origin (0,0), text resolution 2 with a 2x text canvas, identical ground and HUD-frame pixels to the 448x252 window, and shrinks back on resize.
- The visual sweep runs at 1280x720 (zoom 2), so its boss-room screenshots show HD text.
