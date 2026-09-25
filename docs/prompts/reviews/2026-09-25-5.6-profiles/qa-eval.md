Seat: qa-eval
Commit: e9781ef
Scope: EVAL-P5-008 profiles, `docs/prompts/05-feel-hero-and-camera.md` section "Phase 5.6: Profiles" (lines 129-140) bullets against code and evidence
Artifacts opened: `git show e9781ef` diffs for `src/progression/profiles.ts`, `src/systems/Save.ts`, `src/scenes/ProfileScene.ts`, `src/scenes/Title.ts`, `NewCampaignScene.ts`, `ControlsScene.ts`, `StageSelect.ts`, `identity.ts`, `scripts/smoke/profiles.mjs`, `tests/save-profiles.test.ts`, `tests/save-migration.test.ts`, `TESTING.md`, `scripts/smoke-test.mjs`, `ProgressionDebugHooks.ts`; `output/evidence/12a/41-profiles/shot-1-slot-picker.png`, `shot-3-first-run-controls.png`, `state-6-title-continue.json`, `state-9-imported.json`; `output/evidence/12a/full-smoke-summary.json`
Tokens: 95K (16 tool calls)

Bullet verdicts, all PASS: (1) `profiles.v1`, three slots, `wardensCleared` derived (absent from `ProfileMeta`, computed in `summarizeSlot`), legacy `save.v1` to slot 1 `WREN`: `profiles.ts` and `save-profiles.test.ts`. (2) Slot picker, name grid, `NewCampaignScene`, `CONTINUE`: `ProfileScene.ts`, `Title.resumeActiveSlot`; `shot-1` shows three EMPTY cards. The three reported deviations are acceptable: export and import on the slot picker (E and I, not Options) is functionally equivalent and the file naming matches (`omega-relay-ava.json`); import only into an empty slot is a data-loss guard (OVERWRITE exists for used slots through name re-entry); the `?profiles=on` switch under automation is documented in the same commit's `TESTING.md` (AGENTS rule 9). (3) `{hero}` and the HUD follow the pilot: the identity resolver registered by `Save.ts`; `IDENTITY.HERO_CALLSIGN === 'AVA'` in `save-profiles.test.ts`. (4) Stage-best shape, `recordStageBest`, `StageSelect.formatBestTime` present; the write call is deferred to prompt 08 as the bullet says. (5) `stageDebug.setProfile` and the `profiles` payload: `ProgressionDebugHooks.ts` (Game scene only); live in `state-6` and `state-9`. Smoke `41-profiles` matches the scripted beats and is green. (6) `save-profiles.test.ts` covers migration, slots, name validation, the export and import round trip, name-grid input. (7) `campaignStarted`, not `Save.exists()`, drives new versus continue (`Title.ts`); `38c-title-continue-autosave` passes (`full-smoke-summary.json`). (8) The first-run controls page: eight rows, `controlsSeen`, replayable with T (`ControlsScene.ts`); `shot-3` shows exactly eight rows; the smoke asserts it shows once and not on re-entry.

Full smoke: `output/evidence/12a/full-smoke-summary.json`, 58/58 pass, `41-profiles` and `38c-title-continue-autosave` present and passing.

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MINOR | "HUD label follows the pilot" is asserted inline (`control.identity.heroLabel === 'AVA'`) with no capture around it, so no screenshot or state file shows `heroLabel: AVA` | `scripts/smoke/profiles.mjs` (between the briefing and checkpoint captures) | Add a capture at that assertion |
| MINOR | The commit body's "test 506/0" and "sweep complete" cite no artifact path in the evidence given | commit e9781ef message | Point each claim at its log or artifact in the ledger row |
| MINOR | The Options scene (the spec's original place for export and import) was out of scope; stale "Export/Import save" copy not ruled out | out of scope | Grep `Options.ts` in a follow-up |

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 4 |
| Failing check existed before the fix | 3 (the smoke-33 flake's before and after not isolated) |
| Artifacts opened and described | 5 |
| No regression in scenarios outside the slice | 5 |

Verdict: SHIP. Recommend EVAL-P5-008 PASS. No BLOCKs; all eight 5.6 bullets implemented and evidenced; the three deviations are sound and documented in the commit; the remaining gaps are minor evidence pointers.
