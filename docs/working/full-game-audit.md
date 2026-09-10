# Full Game Audit
- Status: working
- Owner scope: gameplay/progression
- Last reviewed: 2026-04-23

This audit records the current release-sprint facts that must stay true while story, presentation, content, physics, and refactor work continue. Treat this file as a Phase 1 working contract; canonical API/schema details live in `docs/content/content-schemas.md`, `TESTING.md`, and `ARCHITECTURE.md`.

## Baseline
- `FACT-BASELINE-001`: Phase 0 smoke and visual sweep automation now produce readable summary JSON artifacts and pass on the current workspace baseline.
- `FACT-BASELINE-002`: `window.render_game_to_text` and `window.advanceTime` remain the automation authority for browser and smoke inspection.
- `FACT-BASELINE-003`: `Preload` remains responsible for stage-select-visible and gameplay-critical assets.
- `FACT-BASELINE-004`: `Game.ts` remains the main scene integration hotspot and still needs seam extraction later in the sprint.

## Progression Contracts
- `DEC-PROG-001`: Seeded progression is canonical. Static boss metadata is fallback presentation only, not progression truth.
- `DEC-PROG-002`: Fresh saves are created through `createFreshProgressionState(seed)` and normalized by `ensureProgressionState(save)`.
- `DEC-PROG-003`: Boss-clear rewards come from `progressionWorld.placements[stageId:boss_clear]`, not from `stage.rewardWeaponId`.
- `DEC-PROG-004`: Stage Select weakness text comes from `getBossWeaknessProfile(save, bossId)`.
- `DEC-PROG-005`: Final-route access is decided only by `evaluateFinalGate(save)`.

## Flow Contracts
- `FACT-FLOW-001`: Fresh save path opens tutorial plus the seeded first robot-master stage via `stageAccessUnlocked`.
- `FACT-FLOW-002`: Tutorial boss clear claims `tutorial_sentinel:boss_clear`, applies that placement, sets `tutorialCleared`, and does not append tutorial to `clearedBosses`.
- `FACT-FLOW-003`: Robot-master clear claims `<stageId>:boss_clear`, applies that placement, and appends the stage to `clearedBosses` once.
- `FACT-FLOW-004`: Final boss clear claims `omega_fortress:boss_clear`, sets `finalBossCleared`, sets `gameCompleted`, and routes to `CompletionScene`.
- `FACT-FLOW-005`: Active-run resume loads from `Save.loadActiveRun()` through the system menu; boss victory clears `activeRun` before victory return.
- `FACT-FLOW-006`: Completion return state is save-backed; `gameCompleted` is the durable flag for shell presentation.

## Presentation Truth
- `FACT-UI-001`: `StageSelect` now uses progression presentation helpers for weakness, boss-clear reward, and final-gate footer/status text.
- `FACT-UI-002`: `render_game_to_text().stageSelect` exposes `weaknessLabel`, `rewardLabel`, and `finalGateText` for deterministic smoke assertions.
- `RISK-UI-001`: Stage Select remains dense at 448x252. Phase 3 should redesign hierarchy rather than only shorten labels.

## Current Evals
- `EVAL-PROG-001`: `tests/progression-state.test.ts` covers seeded weakness labels, boss-clear reward labels, and final-gate presentation labels.
- `EVAL-PROG-002`: `tests/save-system.test.ts` covers save persistence, final route unlock, checkpoint selection, and progression transport import/export.
- `EVAL-PROG-003`: `tests/stage-select-logic.test.ts` covers Stage Select transition basics; runtime shell coverage remains smoke-owned.

## Follow-Up Risks
- `RISK-PROG-001`: Legacy `Save.markBossCleared()` and `Save.markTutorialCleared()` still mutate legacy fields directly. Runtime victory uses progression locations, but future callers should prefer the progression claim path.
- `RISK-PROG-002`: Story flags are not yet part of the save contract. Add them only when Phase 5 story surfaces land.
- `RISK-REF-001`: `Game.ts` still mixes victory, progression, reward application, scene transition, and active-run cleanup. Phase 6 should extract those seams without changing update order.
