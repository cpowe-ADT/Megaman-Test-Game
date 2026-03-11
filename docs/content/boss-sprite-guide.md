# Boss Sprite Production Guide
- Status: canonical
- Owner scope: content
- Last reviewed: 2026-03-06

Each boss blueprint in `src/bosses/roster.ts` documents the frames that the runtime needs. This
cheat sheet aggregates those requirements and outlines animation duties so art and tech remain in
sync.

## Shared Expectations

- **Base frame size**: see the `frame` property for each boss. Frames should include a small buffer
  (4–6 px) for VFX overshoot so dashes and swings do not clip.
- **Origin**: align the sprite so feet rest at `origin.y`. When testing with the placeholder sprite,
  use the same proportions to avoid collision surprises.
- **Animation naming**: export spritesheets or atlases that prefix frame names with the animation key
  (e.g., `rook_idle_0.png`). The engine autogenerates frame sequences using this convention.
- **FX layers**: some bosses include `overlaySprites`. These should be rendered as separate atlases
  so the engine can tint or reuse them independently.
- **Telegraphs**: attacks specify `warningFx`. Provide at least one telegraph sprite per type:
  glow halo, fan-line cone, reticle target, and pressure wave.

## Boss Breakdown

| Boss | Frames (WxH) | Key Animations | Notes |
| ---- | ------------ | -------------- | ----- |
| Sentinel ROOK | 48×48 | idle, hop, stomp, shoot | Heavy body; stomp impact frame should align with ground ripple spawn. |
| Pyro Maw | 56×48 | idle, dash, stream, lob | Provide ember particle sheet for flame stream intensity. |
| Tide Reaver | 52×50 | idle, hover, lance, dive | Include splash effects for Riptide Crash impact. |
| Volt Hopper | 48×46 | idle, jump, dash, shoot | Mines and static orb FX should share palette with sparks. |
| Basalt Titan | 60×56 | idle, dash, punch, jump | Add debris chunks for Crustquake radial spawn. |
| Ferro Blade | 50×48 (+ 32×32 FX) | idle, dash, throw, summon, mag trail FX | Ensure teleport smear extends beyond body silhouette. |
| Mire Wraith | 48×48 | idle, slide, throw, summon | Mist trail should be semi-transparent for phase slide. |
| Gale Vixen | 46×46 | idle, dash, shoot, lift | Wind gust lines can reuse across darts and cyclone. |
| Glacier Ronin | 50×48 | idle, dash, slash, summon | Provide freeze cone particle sheet for Frost Draw linger. |

## Action Lists

- **Intro pose**: every boss needs a short 2–3 frame entrance that can blend from idle.
- **Hit stun**: while not yet scripted, capture 2 frames of recoil to support future polish.
- **Death**: 4–6 frames of dissolve/disintegrate matching element (embers, droplets, sparks, etc.).

## Export Checklist

1. Export atlas JSON + PNG per boss following Phaser’s `texture atlas` format.
2. Include metadata for frame dimensions and trimmed bounds if using texture packer.
3. Deliver a separate `boss_fx.png/json` for shared telegraphs and explosions.
4. Provide palette swatches so the UI can match name card glows.

## Placeholder Workflow

The runtime currently renders colored rectangles when atlas art is absent. Once sprites are ready,
ensure the Preload scene loads each atlas prior to entering `SceneSelect`. Update the manifest with
texture keys that match the blueprint `atlas` names so `BossController` automatically swaps from the
placeholder to the authored animations.
