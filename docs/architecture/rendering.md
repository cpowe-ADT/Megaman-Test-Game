# Rendering: pixel art at integer zoom, text at device resolution

- Status: canonical
- Owner scope: runtime
- Last reviewed: 2026-09-25 (part 12i: the bundled pixel font and the per-surface font decision)

The game is authored at 448x252 (`GAME_WIDTH`, `GAME_HEIGHT` in `src/config/renderPolicy.ts`). Every gameplay and UI coordinate stays in that space.

## How a frame reaches the screen

1. `resolveRenderScale(window.innerWidth, window.innerHeight, devicePixelRatio)` (`src/config/hdRenderMath.ts`) picks the window zoom (`resolveGameZoom`: the largest whole number from 2x up, the exact ratio below that) and multiplies it by the device pixel ratio. Products within 2% of a whole number snap to it, so a 1.5x window on a 2x display is an exact 3x canvas. The result is capped at `MAX_RENDER_SCALE` (6): uncapped, a 2560x1440 window on a 2x display was a 4480x2520 canvas (45MB per buffer) with every Text at resolution 10.
2. The Phaser canvas is created at `448 * scale` by `252 * scale` with CSS zoom `cssZoom` (`1 / dpr` below the cap, `zoom / scale` above it), so it always occupies `448 * zoom` CSS pixels. Below the cap it holds one canvas pixel per device pixel; above it the browser scales the canvas up with nearest-neighbour (`antialias: false` makes Phaser set `image-rendering: pixelated`). Game-pixel edges stay exact because a game pixel is 6 canvas pixels and a whole number (`zoom * dpr`) of device pixels; only anti-aliased text edges are resampled.
3. Every scene's main camera is an `HdCamera` (`src/config/hdRender.ts`) at zoom `scale`. Sprites therefore land on whole device pixels, exactly as the old CSS scaling did.
4. Every `Text` object is created through patched `add.text` / `make.text` factories that set `resolution = scale`, so its internal canvas is rendered at device resolution and drawn 1:1. That is what makes text HD at any window size. `BitmapText` (the HUD digits font) is pixel art and scales like a sprite.
5. On window resize `installHdRendering(...).refresh()` recomputes the scale, resizes the canvas, re-zooms the active cameras and re-renders tracked text.

Under `automation=1` the device pixel ratio is pinned to 1, so a 448x252 Playwright viewport renders exactly one canvas pixel per game pixel and every existing screenshot assertion holds.

## Fonts: one bundled pixel font, smooth text only for prose

`OmegaPixel` is original work (part 12i, `EVAL-P8-003`): 108 glyphs (ASCII 32 to 126, the symbols the UI prints, and `É` for Phaser's `|MÉqgy` metrics string) drawn as data in `assets/fonts/source/omega-pixel.glyphs.txt` and built by `scripts/fonts/build-pixel-font.py` (fontTools and Pillow; `--check` fails on stale outputs). The em is 8 font pixels: cap height 5, x-height 4, descenders 2, and the advance is the glyph width plus one.

- `assets/fonts/omega-pixel.woff` (2.6KB; WOFF because the venv has no `brotli` for WOFF2) serves `Text`. `Preload` queues it with `load.font` (the `FontFace` API), and Phaser finishes the loader, font included, before `Preload.create` starts `Title`, so no `Text` is measured with a fallback.
- `assets/fonts/omega-pixel.png` and `.xml` (a BMFont, key `'font'`, size 8) serve `BitmapText`: the HUD labels and the room-lock countdown already branched on that key.
- Sizes are 8, 16, 24 or 32px only (`pixelFontSize(1 | 2 | 3 | 4)`; `pixelScaleFor(px)` maps an old smooth size: up to 12px became 8px, 13 to 19px 16px, 20 to 27px 24px, the 30px Title logo 32px; `pixelFont()` for Stage Select's `font` shorthand, which Phaser splits into exactly one size and one family token), so every glyph pixel is a whole game pixel. No synthetic bold (it smears pixel edges) and heading shadows are unblurred.
- One font makes text measure the same on macOS and on Linux CI, where `monospace` and `Trebuchet MS` fell back to different faces (the fixed 8px boxes in Stage Select date from that).

| Surface | Font | Why |
| --- | --- | --- |
| Title, Profile, New Campaign, Stage Select, Options, Controls, pause menu and route console, Game Over headings and choices, results and progression summary, victory modal, stage intro, toasts, HUD, touch-button labels, Ending headings and credits roll, dialogue speaker names and page counter | `OmegaPixel` | short labels and numbers on the pixel grid |
| Dialogue body (speech box), Prologue and Ending story lines, the Game Over taunt | smooth HD `Text` in the system `monospace` | long prose reads better anti-aliased at device resolution, and its wrap widths and fixed box heights were tuned for it |
| Debug overlays (`DebugOverlay`, `DevUx`, enemy and player debug) | system `monospace` | developer-only |

## Why the camera is a subclass

Phaser zooms a camera around its centre. With a 448*scale canvas and zoom `scale`, objects with scroll factor 0 (the HUD, toasts, dialogue) would be drawn at `x*scale - 224*scale*(scale-1)`, off screen. `HdCamera` sets the origin to the top-left and re-implements the helpers that assume a centred origin: `clampX/clampY` (bounds), `centerOn*`, `centerToBounds`, `getScroll`, `startFollow`/`setFollowOffset` (half the view is folded into the follow offset so the player stays centred) and `preRender` (fixes `worldView` and `midPoint`). Scroll values keep their 1x meaning: `scrollX` is the world x at the left edge of the screen.

## Rules for code

- Never read `scene.scale.width` / `scene.scale.height` for layout; they are canvas pixels. Use `GAME_WIDTH` / `GAME_HEIGHT`, or `const { width, height } = GAME_SIZE`. Until 2026-09-22 thirteen menu and overlay sites (Title, Options, pause menu, Stage Select, dialogue, toasts, stage intro, and others) still read `this.scale`, so they drew off centre at 2x and mostly off screen at 6x, and the stage parallax canvases were `252 * scale` tall (32MB at scale 6). Smoke `40-hd-render` now asserts every visible Text on Title, Options and Stage Select lies inside the 448x252 frame at 2x.
- Pointer positions: `pointer.x` / `pointer.y` are canvas pixels. Use `pointer.worldX` / `pointer.worldY` (or `camera.getWorldPoint`) when testing against game-space bounds. Interactive objects are hit-tested through the camera automatically.
- Camera shake intensity is a fraction of the canvas width times zoom, so `Game.onCameraShake` divides by the camera zoom.
- Custom cameras (`cameras.add`) are not upgraded automatically; construct an `HdCamera` and `addExisting` it.

## Gates

- `tests/hd-render.test.ts`: render-scale selection, the scale cap and CSS zoom, and the top-left scroll math.
- Smoke `40-hd-render`: a 896x504 window gets a 896x504 canvas, camera zoom 2 with origin (0,0), text resolution 2 with a 2x text canvas, identical ground and HUD-frame pixels to the 448x252 window, and shrinks back on resize; Title, Options and Stage Select text stays inside the frame at 2x (`menus-2x.json`, `menu-*-2x.png`).
- `npm run perf:footprint` (hiDpi scenario): the canvas at 1512x860, 1920x1080 and 2560x1440 at 2x never exceeds 2688x1512.
- The visual sweep runs at 1280x720 (zoom 2), so its boss-room screenshots show HD text.
