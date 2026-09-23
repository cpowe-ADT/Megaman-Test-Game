# 03. Art, Animation, and Boss Identity

Active seats: Orchestrator, Art Director / Animator, Principal Game Engineer, Game Director (boss readability), QA / Eval Lead.

This prompt is two to three sessions; image generation is iterative. Run it as `03a` (3.1 and 3.2), `03b` (3.3), `03c` (3.4 to 3.6).

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 03a | 3.1 Style sheet and pipeline | Art | none yet | P3-001, P3-002 | approve the look; choose the image-generation path |
| 03a | 3.2 Biome tilesets and backgrounds | Art | every stage looks like its district | P3-003, P3-004 | approve two dressed biomes |
| 03b | 3.3 Bosses, mini-bosses, portraits, readability | Art, then Director | bosses with real animation and tells | P3-005, P3-006 | approve the two pilots, then each batch |
| 03c | 3.4 Hero and enemies | Art | the original hero; biome enemy variants | P3-007, P3-008 | pick the hero concept |
| 03c | 3.5 VFX and UI art | Art | explosions, logo, tiles, portraits, cards | P3-009 | approve four screens |
| 03c | 3.6 Visual gates | QA | none | P3-010 | proceed to exit |

## Entry conditions

- Charter pasted. `docs/prompts/handoff/02-levels-and-gameplay.md` exists with `Status: COMPLETE` and every `EVAL-P2-*` row is `PASS`. Otherwise print what is missing and stop.
- Read: the handoff, `docs/content/sprites.md`, `docs/content/sprite-imagegen.md`, `docs/content/boss-sprite-guide.md`, `docs/content/derived-sprite-sources.md`, `docs/working/boss-animation-and-fight-rebuild-plan.md` (the diagnosis and production decisions still hold), `assets/sprites/manifest.v1.json` (note each atlas's `frame` cell size), `src/assets/coverageRequirements.ts`, `src/assets/validateManifest.ts`, `src/player/PlayerAtlasBindings.ts`, `src/player/PlayerBodyProfiles.ts`, `src/player/AnimationManifest.ts`, `src/bosses/bossCombatProfiles.ts` (every animation family name), `src/enemy/EnemyAnimationManifest.ts`, `tools/sprites/slice_sheet_to_atlas.py` (the general slicer; extend it), `scripts/sprites/build_omega_core_atlas.py` (a fixed strip builder; reference only), `scripts/sprites/derive_color_variants.py`, `scripts/sprites/build-image-prompts.mjs`, `assets/sprites/source/free-source-attribution.v1.json`, `assets/backgrounds/README.md`, `src/content/stageBackgroundCatalog.ts`, `src/ui/gameplay/TileSkin.ts`.
- Image generation is "available" only if `/Users/thristannewman/.codex/skills/imagegen/scripts/image_gen.py` is executable and `OPENAI_API_KEY` is set (`docs/content/sprite-imagegen.md`). Check both before planning. If unavailable, the recommended default is: you write the complete prompt pack (bosses, tiles, backgrounds, hero, portraits, effects) under `output/imagegen/prompts/` with the master template from 3.1, Craig renders outside the session and drops PNGs into `~/Downloads` for `npm run sprites:intake`, and each STOP that needs renders waits for that drop. The alternative is CC0 sheets. Craig picks at STOP 3.1.

## Outcome of this prompt

The game looks like one game. Nine biome tilesets and matching backgrounds replace the placeholder skin and the borrowed parallax packs. All ten bosses and four mini-boss archetypes have original action sheets that satisfy their combat-profile animation families, with portraits, and twelve speaker portraits exist for the dialogue overlay. The hero has an original public sprite that fits the existing body profiles. Enemies are re-skinned per biome. VFX and UI art exist for everything prompt 04 stages. The visual sweep enforces contrast, frame coverage and zero placeholders.

## Production rules

- Original art only for bodies. Downloads only for CC0 / CC-BY effects or reference, recorded in the attribution file before intake.
- Body art and effects stay separate. No baked backgrounds, labels or glows in body frames. Generate on flat magenta (`#FF00FF`) and remove it deterministically.
- Canonical facing east; mirror west at runtime. One locked facing value drives flip, muzzle anchors, hitboxes and projectiles (already true).
- Target cells: hero 48x48 (foot baseline y=44), enemies 32x32, mini-bosses 64x64, bosses 64x64 (foot baseline y=56), portraits 48x48, tiles 16x16, effects 32x32 or 64x64. Today's boss cells differ (rook 48x48, pyro 56x48, tide 52x50, omega 64x64), so every cell change updates the manifest `frame`, the boss presentation anchors in `BossController`, and re-runs `npm run sprites:validate` and the boss-room sweep captures. Omega stays 64x64; its new groups are generated against the existing sheet as the reference image.
- Pixel grid exact; no anti-aliased edges; 1px dark outline on characters.
- One pilot before any batch. Sentinel Rook proves grounded landing frames; Pyro Maw proves dash-through, projectile telegraph and persistent hazard frames.
- Every generated sheet keeps its prompt, seed if available, source PNG and cleanup command under `assets/sprites/source/<family>/`, with an attribution entry marked `original-generated`.

## Phase 3.1: Style sheet and pipeline hardening

Art leads; Engineer builds the tools.

1. `docs/art/style-sheet.md`: palette per biome (base, shadow, edge, accent, hazard, sky; eight wardens plus `relay` for tutorial and Omega); silhouette rules (readable at 1x on a 448px frame; each boss has one dominant shape: Rook a square, Pyro a maw, Tide a crescent, Volt a bolt, Basalt a slab, Ferro a blade, Mire a drip, Gale a wing, Glacier a shard, Omega a ring); outline and shading (three tones plus outline); what the 58px HUD band means for sprite height; the master image-generation prompt template (style words, negative words, the magenta background instruction, the grid layout instruction, cell size, view, upper-left light).
2. Extend `tools/sprites/slice_sheet_to_atlas.py` with `--chroma FF00FF` (mask with edge cleanup), `--baseline <y>` (per-frame foot alignment), empty-cell detection, and `--family bosses --id pyro_maw` naming that lands in `assets/sprites/bosses/<id>/` with the `<typeKey>/<animKey>/<index>` frame convention and a manifest update. Unit-test the pure parts (baseline alignment, chroma mask) with small fixtures in `tests/`.
3. Frame-count contracts (the old `VISUAL-001`): `src/assets/coverageRequirements.ts` gains required animation groups and minimum counts per family; for bosses derive them from `bossCombatProfiles.ts` animation families so a profile cannot name a family the atlas lacks. `npm run sprites:validate` fails on a missing group or short count. `Preload` and the boss animator must not silently clamp a multi-frame group to one frame: throw in dev, log and fall back in production.
4. Contact sheets: `scripts/sprites/contact_sheet.py --atlas <key>` renders every group as a labeled strip into `output/art-review/<key>.png`.

Ledger: `EVAL-P3-001` (style sheet plus two pilot renders), `EVAL-P3-002` (pipeline tests; the validator fails a deliberately broken fixture).

```
### STOP 3.1: Style sheet
Show: the style sheet, two test renders (one boss cell, one tile strip), the validator failing on the broken fixture.
Question for Craig: approve the look, and which image-generation path (in-session, render-outside, or CC0)?
Recommended: approve; in-session if available, otherwise render-outside.
```

## Phase 3.2: Biome tilesets and backgrounds

Art leads; Engineer wires `TileSkin`.

For each of nine biomes: a 16px tileset atlas `assets/sprites/tiles/<biome>/` with ground top, body, bottom, left and right caps, inner corners, wall face (for the walled segments), one-way platform (3 pieces), crumble variant, conveyor strip (4 frames), rail on/off, hazard strip (spikes, vent, acid, icicle as the biome needs), gate (closed, opening 3 frames, open), breakable wall (3 crack stages), and three to five decor props for the segments prompt 02 listed. `TileSkin` maps ground runs, walls and platform kinds to these tiles with a 3x3 autotile rule; the procedural generator stays as the fallback when an atlas is missing and is counted as a placeholder (3.6).

Backgrounds: replace the borrowed packs where they mismatch the fiction (Pyro is green today) with original three-layer parallax sets per biome at 448x194 (the playfield below the HUD), generated from the style sheet into `assets/backgrounds/original/<biome>/{far,mid,near}.png`. Keep CC packs only where the brief says they fit; keep their credits.

Sweep after each pair of biomes; open `start`, `mid` and one segment capture per stage.

Ledger: `EVAL-P3-003` (nine tilesets validate; zero placeholder tiles in the sweep), `EVAL-P3-004` (backgrounds per biome, review sheet).

```
### STOP 3.2: Two biomes dressed
Show: Pyro Maw and Glacier Ronin captures with tiles and backgrounds.
Question for Craig: approve, so the remaining seven proceed without a stop until 3.3? Recommended: yes.
```

## Phase 3.3: Bosses, mini-bosses, portraits, and fight readability

Art leads the sheets; Director leads readability; Engineer wires animation keys.

**Sheet contract per boss** (derive the exact list from that boss's combat profile; these are minimums): `intro` 4, `idle` 4, `move` 6, one `windup` / `active` / `recovery` set per distinct attack family the profile names (3 / 4 / 3), `jump` 2 and `land` 2 for grounded bosses or `hover` 4 for aerial ones, `hurt` 2, `phase_shift` 3, `defeat` 6. Portrait 48x48 facing three-quarter left, key `portrait_<bossId>`.

**Pilot**: Sentinel Rook and Pyro Maw. Generate, clean, slice, validate, wire the keys through the boss animator (`BossController` presentation path only; do not touch motion or attack selection), sweep the two stages, open boss-room and mid-attack captures, produce contact sheets.

```
### STOP 3.3a: Pilot bosses
Show: two contact sheets, two boss-room captures, one mid-attack capture each.
Question for Craig: approve the two before the remaining eight and the four mini-bosses? Recommended: yes.
```

**Batches**: Tide and Volt, Basalt and Ferro (then `STOP 3.3b`), Mire and Gale, Glacier and Omega's new groups, then the four mini-boss archetypes through `derive_color_variants.py` for their skins (then `STOP 3.3c`). Sweep after every batch.

**Readability pass** (Director, per boss, after its art lands): every attack tell visible for at least 300ms and distinct from idle; the vulnerability window has a visible cue; phase 2 changes palette or a costume element; a weakness hit uses a distinct `boss_hit_weak` sfx slot (prompt 04), a white flash twice as long, and a 200ms stagger; defeat plays the six-frame `defeat` group with the explosion burst and a 900ms freeze before the defeat dialogue. Findings in `docs/design/boss-readability.md`; fixes in the profile or the sheet, never in `Game.ts`.

Ledger: `EVAL-P3-005` (ten bosses and four mini-bosses validate against their profiles), `EVAL-P3-006` (readability sheet with Craig's replies).

## Phase 3.4: Hero and enemies

Art leads; Engineer keeps the runtime contract fixed.

**Hero.** Build WREN to the existing player atlas contract so no runtime code changes: the required groups and counts come from `src/assets/coverageRequirements.ts`, `src/player/PlayerAtlasBindings.ts` and `docs/content/sprites.md` (locomotion, dash, combat, slash, hurt, death). Design from the style sheet: recovery-unit silhouette, two-tone armor with one accent color that reads against all nine biomes, visible arm cannon, a saber that is a tool. Acceptance that protects the levels tuned in prompt 02: for `idle`, `run`, `jump`, `dash` and `wall_slide` the alpha bounds of every WREN frame sit inside the matching `PlayerBodyProfiles.ts` rect plus 3px on any side, checked by the atlas validator. Generate in three sheets (locomotion, combat, slash) with one seed and reference image; slice into `assets/sprites/player/main/`. The private Mega Man X override keeps working as the dev skin through the existing merge in `Preload`.

```
### STOP 3.4: Hero concept
Show: three concept renders (idle, run, slash) composited over a Pyro segment capture at 1x, not enlarged.
Question for Craig: which concept? Recommended: the one whose silhouette reads at 1x. Craig may keep playing as X
locally; the public build ships WREN.
```

**Enemies.** The twelve CC0-derived enemies get biome palette variants through `derive_color_variants.py` for the stages that use them (the briefs list which); any enemy that is a palette clone of another gets one distinguishing edit (check `enemy_fly_trap` and the drones first).

Ledger: `EVAL-P3-007` (hero atlas validates against the full contract and the bounds rule; player smoke 24 to 30 green on the new atlas), `EVAL-P3-008` (enemy variants validate; sweep green).

## Phase 3.5: VFX and UI art

Art leads.

- Effects atlas additions: small hit 6, medium explosion 8, large explosion 12, boss defeat burst 12, weapon-get burst 8, checkpoint flare 6, teleport-in beam 8, dust 4, wind streak 4, bubble 4, crack 3. Register in `coverageRequirements.ts`.
- Speaker portraits for the dialogue overlay: WREN, Iona Vale, OMEGA CORE, Sentinel Rook and the eight wardens (12, 48x48, key `portrait_<speakerId>` matching the `speakers` block of `dialogue.v2.json`).
- UI: title logo (two sizes), Stage Select tiles with the 32x32 portrait slot filled and locked / cleared treatments, dialogue portrait frame, weapon icons (Buster plus nine), medal, heart and sub-tank icons, armor and chip icons for the pause menu, difficulty pip glyph, gamepad button glyphs (for prompt 04's remap screen), eight district ending cards at 448x194.
- The Stage Select preview panel plays the selected boss's `idle` group at its authored fps; cleared tiles show `defeat` frame 6 tinted; locked tiles show the silhouette.
- Wire portraits into the overlay slot, tiles and preview into Stage Select, the logo into Title, the icons into the pause menu. Menu chrome stays in `menuTheme.ts`.

Ledger: `EVAL-P3-009` (effects and UI groups validate; Title, Stage Select, a dialogue line with a portrait, the pause menu, and an ending card reviewed).

```
### STOP 3.5: UI
Show: Title, Stage Select with the idle preview, a dialogue line with a portrait, the pause menu, one ending card.
Question for Craig: approve? Recommended: yes.
```

## Phase 3.6: Visual gates

QA leads.

- Definitions: `visuals.placeholderCount` counts `TileSkin` fallback tiles and any atlas produced by `scripts/sprites/generate-placeholder-atlases.py`; procedural pickup, HUD and menu textures are not placeholders. `visuals.missingAtlasCount` counts atlases the manifest names that failed to load. Both must be 0 in every sweep capture.
- Contrast heuristic: luminance difference between the player and boss silhouettes and the background band they stand on, computed from the PNG in the sweep script; the threshold is set once from the approved pilot captures at STOP 3.3a and written into the script with a comment.
- Blank-screen guard: measured on the playfield band only (y 58 to 252); a capture fails when more than 60% of its pixels sit within 4 RGB of one value; tune once at STOP 3.1 and comment the number.
- `scripts/check-dist-runtime-assets.mjs` fails if any `tiles/` or `backgrounds/original/` folder a biome references is missing from `dist/`.

Ledger: `EVAL-P3-010`.

## Exit Gate

- `EVAL-P3-001` through `EVAL-P3-010` are `PASS`.
- `npm run verify` and the full sweep result lines with artifact paths; contact sheets for ten bosses, four mini-bosses and the hero under `output/art-review/`.
- Attribution files updated for every asset; `assets/sprites/source/` holds every prompt and source PNG.
- `docs/content/sprites.md`, `docs/content/assets.md` and `docs/content/boss-sprite-guide.md` describe the pipeline and cells; `docs/README.md` indexes `docs/art/`.
- `wc -l src/scenes/Game.ts` at or below the prompt-02 exit value.
- `docs/prompts/handoff/03-art-animation-bosses.md` per the charter, with `Inputs for prompt 04` listing: effects group names, portrait keys per speaker, ending card keys, logo keys, gamepad glyph keys, weapon and item icon keys, the `boss_hit_weak` sfx slot, and any boss whose readability findings were deferred.

```
### STOP 3.EXIT
Show: the handoff, the ledger, the sweep summary, the contact sheets.
Question for Craig: open prompt 04? Recommended: yes.
```
