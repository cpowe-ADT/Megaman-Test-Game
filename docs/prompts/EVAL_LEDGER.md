# Eval Ledger

One row per eval id. Status is `PASS`, `FAIL`, `SKIPPED (reason)`, or `PENDING`. Never rename or delete an id; add ids if a prompt needs more. Evidence is a command and its result line, plus an artifact path, plus the commit. Review rows quote Craig's reply verbatim.

Kinds: `gate` (a command with an exit code), `audit` (a script against a budget), `review` (Craig approves at a STOP).

## Prompt 01: Foundation and story

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P1-001 | gate | test, build, sprites:validate, smoke 38/38 with strict scenario-29 evidence, sweep 10/10 green on the checkpoint commit | PASS | Craig approved STOP 1.0 verbatim: "approved yes commit it and you remeber i want oen tha tworks on graphics where you use your chat gpt image or editign skils to create ebtter vwtor files and  asytem doto doi it if you ahve to pgoram somethign to do it you can". Checkpoint committed as `35a1fba`. `npm run test` → `Test summary: 12 passed, 0 failed`, `# pass 185`, `# fail 0` (`output/phase-1-0/09-final-test.log`); `npm run build` → `✓ built in 3.48s`, `Checked 153 runtime asset files and 5 emitted build refs in dist/.` (`output/phase-1-0/10-final-build.log`); `npm run sprites:validate` → `[sprites] Manifest valid (25 entries, 25 ready, 0 planned)`, `[sprites] Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)` (`output/phase-1-0/03-sprites-validate.log`); `npm run test:smoke` → `Full smoke summary: 38/38 pass, 0 fail, 0 skipped.` (`output/phase-1-0/11-final-smoke.log`, `output/phase-1-0/final-smoke/summary.json`); `npm run test:visual-sweep` → `Mission visual sweep complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/mission-visual-sweep` (10/10 pass, `output/phase-1-0/05-baseline-sweep.log`, `output/mission-visual-sweep/summary.json`). All five gates exit 0. Historical pellet miss did not reproduce; old false-positive evidence predicate produced `# pass 1`, `# fail 4` before repair (`06-pellet-evidence-red.log`), then `# pass 5`, `# fail 0` (`07-pellet-evidence-green.log`), both under `output/phase-1-0/`. Full result lines, focused run, screenshots, and review debt are in `docs/prompts/handoff/01-foundation-and-story.md`. | `35a1fba89ae77d5c900d65486994f5620df48834` |
| EVAL-P1-002 | gate | `.github/workflows/ci.yml` present; `npm run ci` green locally. The remote run URL is recorded after Craig pushes and is not required for PASS | PASS | `ruby output/phase-1-0/check-ci-workflow.rb` → `CI structure audit PASS: push/PR Node22 test+build; manual-only browser job; smoke port4400; always-upload output/.` (`output/phase-1-0/17-ci-structure-green.log`, exit 0). Missing workflow/script audit was red first (`16-ci-structure-red.log`). QA found ambient Node types; isolated typecheck failed with 7 errors (`19-ci-node-types-red.log`), then locked `@types/node@22.20.2` passed repository-only resolution (`21-ci-node-types-green.log`). Final `npm run ci` → `Test summary: 12 passed, 0 failed`, `# pass 185`, `# fail 0`, `✓ built in 3.55s`, `Checked 153 runtime asset files and 5 emitted build refs in dist/.` (`output/phase-1-0/22-ci-final.log`, exit 0). Remote run URL pending push, not required for this local gate. | `bf216acc9d7c872586ff35e6902af7c5d2f5dd6c` |
| EVAL-P1-003 | gate | `tests/progression-classic.test.ts`: eight open, own weapon, WeaknessTable, placement table, 8 medals, transport round trip, mode mismatch rejected, mode-less transport imports as randomizer | PASS | `output/phase-1-1/17-focused-tests-final.log` (# pass 65, # fail 0); `21-verify.log` (12 boss + 218 tests, build/sprites pass); `25-full-smoke-final.log` and `full-smoke/summary.json` (41/41 pass). Initial red and transport/legacy fixtures documented in partial handoff. | Phase 1.1 commit containing this row |
| EVAL-P1-004 | gate + review | smoke 33 classic Stage Select: reward `Flame Serpent`, weakness `???` then `Hydro Lance`, pips; 448x252 screenshot with no truncated text | PENDING | Automated gate PASS: `output/phase-1-1/full-smoke/33-classic-stage-select/` native PNG/JSON and layout assertions; full smoke 41/41. Director/Orchestrator visual review green. Await Craig’s STOP 1.1 approval of mode/placement tables. | Phase 1.1 commit containing this row |
| EVAL-P1-005 | gate | `tests/identity-strings.test.ts` (word-boundary regex) green; title screenshot shows `OMEGA RELAY` | PENDING | | |
| EVAL-P1-006 | gate + review | dialogue v2 validator covers the trigger table and every rule with a failing fixture each; Craig read the script | PENDING | | |
| EVAL-P1-007 | gate + review | smoke 34 to 37 green with `storyIntro=on`; six surface screenshots reviewed | PENDING | | |
| EVAL-P1-008 | gate | skip / full-read parity for story flags at unit and smoke level | PENDING | | |
| EVAL-P1-009 | gate + review | pause menu (weapon grid, sub tank) smoke 38b; options persist smoke 38; autosave scenarios adapted; game over continue; death economy | PENDING | | |
| EVAL-P1-010 | gate | `tests/input-actions.test.ts` green; `13d` and `4c` unchanged and green on the action map | PASS | Focused input/combat tests → `# pass 19`, `# fail 0` (`output/phase-1-0b/18-final-focused-tests.log`, exit 0). Unchanged 4c/13d plus 6/15: 4 pass, 34 filter skips (`13-focused-smoke.log`, `focused-touch-green/summary.json`); new 13e lifecycle: 1 pass, 38 filter skips (`17-lifecycle-smoke.log`, `lifecycle-green/summary.json`), all under `output/phase-1-0b/`. Full `npm run test` → `Test summary: 12 passed, 0 failed`, `# pass 198`, `# fail 0` (`19-full-test.log`); build → `✓ built in 3.43s`, `Checked 153 runtime asset files and 5 emitted build refs in dist/.` (`20-full-build.log`); sprites → `Manifest valid (25 entries, 25 ready, 0 planned)`, `Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)` (`21-sprites-validate.log`); full smoke → `Full smoke summary: 39/39 pass, 0 fail, 0 skipped.` (`22-full-smoke.log`, immutable `output/phase-1-0b/full-smoke/summary.json`). All exit 0; numbered logs are under `output/phase-1-0b/`. Skill client → `Skill client artifacts valid: Game state, shot-0.png, 0 browser-error files; player=(81,214), shots=1.` (`24-skill-client.log`). Budget/source audit → Game 3846 lines (-82), 0 raw scene key reads, 4c/13d functions unchanged (`25-source-audit.log`). Missing modules, fast-tap/remap/charge regressions, hitstop touch-dash loss and debug-hook reentry failed before repair; failed loader and fixture attempts are explicitly retained in the handoff. QA source review closed; Engineer, Orchestrator and Director opened all 44 final PNGs, indexed in `output/phase-1-0b/final-contact-manifest.txt`. | `fb0e5532fe552477f6b28c9fbf2d9e06cfe64341` |
| EVAL-P1-011 | gate | `tests/upgrades.test.ts`: every capsule and chip effect | PASS | `output/phase-1-1/17-focused-tests-final.log` (65 pass including actual combat/motor/fire/save consumers); `full-smoke/33b-classic-upgrade-runtime/evidence.json` fractional HP/no hurt, pellet damage, discounted energy, boss damage adapter, dialogue cancellation; `full-smoke/12-weapon-switch-energy/arc-evidence.json`; full verify components pass (`21-verify.log`, final `25-full-smoke-final.log`). | Phase 1.1 commit containing this row |

## Prompt 02: Levels and gameplay

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P2-001 | gate | level v2 compile parity snapshot; sweep retention unchanged | PENDING | | |
| EVAL-P2-002 | audit | `npm run content:audit` exists and reports every stage with density and `route px / runSpeed` | PENDING | | |
| EVAL-P2-003a | audit | `npm run content:lint` green on the parity stages | PENDING | | |
| EVAL-P2-003b | audit | `npm run content:lint` green on all rebuilt stages | PENDING | | |
| EVAL-P2-004 | gate | one pure test per mechanic; smoke 39 mechanics lab | PENDING | | |
| EVAL-P2-005 | gate | mini-boss profiles validate; smoke 40 encounter | PENDING | | |
| EVAL-P2-006 | audit | content audit enforcing and green for ten stages | PENDING | | |
| EVAL-P2-007 | gate | smoke 41 Omega three acts with reload; rematch rules | PENDING | | |
| EVAL-P2-008 | gate | difficulty tests; death feel screenshot | PENDING | | |
| EVAL-P2-009 | review | Craig played Pyro Maw; five answers recorded and acted on | PENDING | | |
| EVAL-P2-010a | review | batch 1 contact sheets approved (stages named in the row) | PENDING | | |
| EVAL-P2-010b | review | batch 2 contact sheets approved (stages named in the row) | PENDING | | |
| EVAL-P2-010c | review | batch 3 contact sheets approved (stages named in the row) | PENDING | | |
| EVAL-P2-010d | review | batch 4 contact sheets approved (stages named in the row) | PENDING | | |
| EVAL-P2-011 | gate | per-segment sweep assertions; audit and lint in verify and CI | PENDING | | |

## Prompt 03: Art, animation, bosses

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P3-001 | review | style sheet approved; two pilot renders; image-generation path chosen | PENDING | | |
| EVAL-P3-002 | gate | slicer extensions unit-tested; frame-count validation fails a broken fixture | PENDING | | |
| EVAL-P3-003 | gate | nine tilesets validate; zero placeholder tiles in sweep | PENDING | | |
| EVAL-P3-004 | review | backgrounds per biome approved | PENDING | | |
| EVAL-P3-005 | gate | ten bosses and four mini-bosses validate against profile animation families; cell changes reflected in the manifest | PENDING | | |
| EVAL-P3-006 | review | boss readability sheet with Craig's replies | PENDING | | |
| EVAL-P3-007 | gate | hero atlas validates against the full contract and the body-profile bounds rule; player smoke 24 to 30 green | PENDING | | |
| EVAL-P3-008 | gate | enemy biome variants validate; sweep green | PENDING | | |
| EVAL-P3-009 | gate + review | effects, twelve speaker portraits and UI groups validate; Title, Stage Select, dialogue, pause menu, ending card reviewed | PENDING | | |
| EVAL-P3-010 | gate | sweep placeholder, missing-atlas, contrast and blank-screen guards; dist tile and background checks | PENDING | | |

## Prompt 04: Presentation, audio, release

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P4-001 | gate | cue map uniqueness and file existence test; loop RMS check recorded | PENDING | | |
| EVAL-P4-002 | gate | audio credits check script green | PENDING | | |
| EVAL-P4-003 | gate + review | smoke 42 beats flow; six beat screenshots | PENDING | | |
| EVAL-P4-004 | gate + review | smoke 43 pad injection, remap persistence, integer scaling; touch decision recorded | PENDING | | |
| EVAL-P4-005 | gate | `scripts/check-public-build.mjs` green: no private assets, no franchise strings, no dev lab | PENDING | | |
| EVAL-P4-006 | gate | `SMOKE_SERVER=preview` smoke against the public build | PENDING | | |
| EVAL-P4-007 | gate | `deploy.yml` present; `npm run verify:public` green; itch zip exists | PENDING | | |
| EVAL-P4-008 | gate | smoke 45 full campaign under `SMOKE_LONG=1`, skip and read variants, identical final save | PENDING | | |
| EVAL-P4-009 | review | Craig's playtest checklist complete | PENDING | | |
| EVAL-P4-010 | gate | live URL after the tag (may stay PENDING at STOP 4.EXIT) | PENDING | | |

## Planning supplements

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-ENEMY-PLAN-001 | audit | Documentation completeness only: actual 12-family/10-stage inventory, proposed behavior/visual/telegraph/counterplay/routine, bounded pilot, architecture and graphics pipeline, future measurable acceptance and pending phase ownership. Not approval or working-monster evidence. | PASS | Pre-brief audit red: `Enemy plan documentation audit FAIL: 12 families, 10 stages, 0 future acceptance rows; 57 missing requirements.` (`output/enemy-design-plan/01-doc-audit-red.log`, exit 1; corrected one-family pilot fixture red in `02-synthesized-audit-red.log`). After Orchestrator/Director/QA draft review, `node output/enemy-design-plan/audit-enemy-plan.mjs` → `Enemy plan documentation audit PASS: 12 families, 10 stages, 10 future acceptance rows; 0 missing requirements.` (`03-doc-audit-green.log`, `audit-green.json`, exit 0). `npm run test` → `Test summary: 12 passed, 0 failed`, `# pass 198`, `# fail 0` (`04-docs-test.log`, exit 0). `npm run build` → `✓ built in 3.70s`, `Checked 153 runtime asset files and 5 emitted build refs in dist/.` (`05-docs-build.log`, exit 0). All numbered paths under `output/enemy-design-plan/`. Final text and log artifacts opened/inspected; no runtime, asset, screenshot or smoke changes. STOP 1.0b and all later STOPs remain pending; existing phase eval statuses unchanged. | Planning supplement commit containing this row; exact SHA reported after commit |
