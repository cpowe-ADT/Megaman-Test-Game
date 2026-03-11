# MegaMan Recovery Prompt v2 (Historical)
- Status: historical
- Owner scope: repo
- Last reviewed: 2026-03-06
- Canonical replacement: `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `TESTING.md`, `ARCHITECTURE.md`, `docs/README.md`

This file is preserved as a prior prompt-driven implementation brief. It is not a current source of truth for repo workflow or architecture.

You are a senior gameplay + tools engineer working in an existing Phaser 3 + TypeScript repo.

## Mission

Make the game stable and shippable with minimal-risk changes while extending:

1. Boss death/victory flow stability.
2. Global ESC navigation and scene cleanup.
3. Enemy framework completion (12 archetypes, data-driven).
4. HiDPI render quality fixes.
5. ChatGPT image -> atlas import pipeline.

## Repo Facts (must respect)

- Scene entry: `src/main.ts`
- Main gameplay: `src/scenes/Game.ts`
- Stage Select: `src/scenes/StageSelect.ts`
- Save abstraction: `src/systems/Save.ts`
- Boss runtime + visuals: `src/bosses/BossController.ts`, `src/scenes/Game.ts`
- Existing enemy framework (already present): `src/enemy/*`
- Existing sprite manifest system: `assets/sprites/manifest.v1.json`, `src/assets/*`, `scripts/sprites/*`
- Verify gate: `npm run verify` (`sprites:validate` + tests + build + smoke)

## Non-Regression Requirements

- Keep current Stage Select readability improvements intact.
- Keep local placeholder sprite fallback working.
- Keep boss manifest atlas loading path working.
- Do not break `window.render_game_to_text` debug payload.
- Keep `npm run verify` passing at each milestone.

## Highest Priority Fix First

### Boss Death Crash + Victory Modal

Implement a one-shot boss death pipeline:

- Add explicit state guard: `bossDeathHandled` (or equivalent).
- Disable boss hitbox/collision before teardown.
- Cancel/clear combat timers and outgoing event listeners.
- Freeze combat input while modal is shown.
- Show modal:
  - title: `Boss Defeated`
  - body: `You have defeated <bossName>.`
  - subtext: `Select another stage to continue.`
  - action: `Next`
- On `Next`: call centralized `returnToStageSelect('victory')`.

### Central Navigation Helper

Add a shared helper module (minimal API):

- `returnToStageSelect(scene, reason?)`
  - stop/cleanup gameplay and overlays
  - clear keyboard/gamepad pressed states
  - clear timers/tweens
  - normalize pause/timeScale
  - start StageSelect fresh
- `showToast(scene, msg, durationMs?)`

### Post-Victory Stage Select

- Mark defeated tile with badge/ribbon (`DEFEATED`).
- Show toast: `<bossName> defeated!`.
- Keep keyboard/mouse focus predictable.

## ESC Navigation (Global)

- ESC in gameplay always returns to Stage Select.
- If modal/overlay is open: handle overlay close/action first.
- Must work for stacked scenes.
- Must not leak stuck input state.

## HiDPI + Pixelation Fix

- Add central runtime flags for render quality.
- Default: HiDPI enabled, PostFX disabled.
- Ensure no forced pixelated canvas CSS.
- Keep canvas sizing and DPR consistent.
- Avoid blurry text and avoid overlap regressions.

## Enemy Framework Completion

Existing enemy framework is already present. Finish integration instead of rewriting:

- Ensure 12 required enemy types exist in `EnemyCatalog`.
- Ensure placeholder sprite path if atlas missing.
- Ensure spawn from level markers + debug spawn path.
- Ensure combat integration with player blaster + sword.
- Keep enemy framework OFF by default unless level data requests spawn.

## Sprite Import Pipeline (Tooling)

Create/finish a CLI tool in `tools/` that supports:

- `--in <png>`
- `--out <folder>`
- `--typeKey <id>`
- `--grid CxR` or `--cell WxH` or explicit slices
- `--anims "idle=0-5,run=6-13,attack=14-19"`

Outputs:

- atlas PNG + atlas JSON
- frame naming: `<typeKey>/<animKey>/<frameIndex>`
- runtime files under:
  - `assets/sprites/player/main/`
  - `assets/sprites/bosses/<bossId>/`
  - `assets/sprites/enemies/<typeKey>/`
- update central manifest automatically
- fail safely with placeholder fallback

## Source Image Intake + Naming (Required)

Before atlas slicing, all raw generated images must be copied into repo source folders and renamed:

- source folders:
  - `assets/sprites/source/player/`
  - `assets/sprites/source/bosses/`
  - `assets/sprites/source/enemies/`
  - `assets/sprites/source/projectiles/`
  - `assets/sprites/source/ui/`
- filename format:
  - `<category>_<subject>_sheet_<variant>_<yyyymmdd>_<hhmmss>.png`
  - example: `enemy_laser_turret_sheet_v1_20260207_204857.png`

Use intake automation:

```bash
npm run sprites:intake
```

Intake output manifest must be generated at:

- `assets/sprites/source/source-images.manifest.json`

## Feature Flags (centralized)

Defaults:

- `enableEnemyFramework: false`
- `enableEnemyAI: false`
- `enableEnemyProjectiles: false`
- `enableEnemyDrops: false`
- `enableEnemyDebug: false`
- `enableHiDPI: true`
- `enablePostFX: false`
- `enableDevCrashOverlay: false`

## Acceptance Checklist

1. Boot -> Stage Select readable, no overlap.
2. Enter game -> ESC returns to Stage Select cleanly.
3. Kill boss -> no crash -> Victory modal -> Next -> Stage Select.
4. Defeated badge visible + toast shown.
5. Missing atlas never crashes (placeholder shown).
6. Enemy spawn path works for each required type.
7. Source images are in correct folders with normalized names (no `ChatGPT Image ...` names inside repo).
8. Sprite import CLI generates atlas + updates manifest.
9. `npm run verify` passes.

## Delivery Format

- Discovery summary (scene paths, transitions, manifests, verify scripts)
- Small diffs grouped by purpose
- Test notes and manual checklist
- Flags and defaults documented
