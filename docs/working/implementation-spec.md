# Implementation Spec (File-by-File)
- Status: working
- Owner scope: gameplay
- Last reviewed: 2026-03-06

## Stage Select UX + Input Contract
- `src/scenes/StageSelect.ts`
  - Rebuild layout with fixed regions (header, grid, preview, footer).
  - Reduce slot text density to codename + compact status line.
  - Enforce click contract: first click selects; second click confirms.
  - Keep Enter/NumpadEnter confirmation.
  - Expose debug state fields: `selectedBossId`, `canConfirm`.
- `src/scenes/stage-select/selectionContract.ts`
  - Add pure helpers:
    - `resolveSlotClick(currentIndex, clickedIndex)`
    - `truncateLabel(value, maxChars)`

## Render Text State for Automation
- `src/main.ts`
  - Extend `render_game_to_text` payload for Stage Select:
    - `selectedBossId`
    - `canConfirm`

## Sprite Manifest + Runtime Fallback
- `assets/sprites/manifest.v1.json`
  - Add v1 manifest for 9 bosses.
- `src/assets/types.ts`
  - Define manifest interfaces (`SpriteSheetManifestV1`, entry/source/frame contracts).
- `src/assets/validateManifest.ts`
  - Add strict validator with actionable errors.
- `src/assets/manifest.ts`
  - Add helper to derive runtime-loadable atlas entries.
- `src/scenes/Preload.ts`
  - Validate manifest.
  - Load ready runtime atlases when present.
  - Preserve generated placeholder fallback when missing/invalid.

## Sprite Tooling
- `scripts/sprites/validate-manifest.mjs`
  - CLI validator with summary output.
- `scripts/sprites/import-sprites.mjs`
  - Import remote atlas/data with dry-run support.
- `scripts/sprites/build-image-prompts.mjs`
  - Generate per-boss imagegen prompts from roster `spritePlan`.

## Documentation
- `docs/working/consultant-audit.md`
  - Severity-ranked findings and done rubric.
- `docs/content/sprite-imagegen.md`
  - Image generation workflow, fallback behavior, and CLI examples.

## Quality Gates + Scripts
- `package.json`
  - Add:
    - `sprites:validate`
    - `sprites:import`
    - `sprites:prompts`
  - Update `verify` to include `sprites:validate` before test/build/smoke.

## Tests
- `tests/stage-select-selection-contract.test.ts`
  - Verify click-select/confirm contract and truncation helper.
- `tests/sprite-manifest.test.ts`
  - Validate pass/fail manifest scenarios.
- `scripts/smoke-test.mjs`
  - Add scenario checks:
    - click-only stays in StageSelect and changes selected boss.
    - click + Enter transitions to Game.
