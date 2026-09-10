# Eval Ledger

One row per eval id. Status is `PASS`, `FAIL`, `SKIPPED (reason)`, or `PENDING`. Never rename or delete an id; add ids if a prompt needs more. Evidence is a command and its result line, plus an artifact path, plus the commit. Review rows quote Craig's reply verbatim.

Kinds: `gate` (a command with an exit code), `audit` (a script against a budget), `review` (Craig approves at a STOP).

## Prompt 01: Foundation and story

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P1-001 | gate | test, build, sprites:validate, smoke 38/38 with strict scenario-29 evidence, sweep 10/10 green on the checkpoint commit | PENDING | Gates green; checkpoint awaits STOP 1.0 approval. `npm run test` → `Test summary: 12 passed, 0 failed`, `# pass 185`, `# fail 0` (`output/phase-1-0/09-final-test.log`); `npm run build` → `✓ built in 3.48s`, `Checked 153 runtime asset files and 5 emitted build refs in dist/.` (`output/phase-1-0/10-final-build.log`); `npm run sprites:validate` → `[sprites] Manifest valid (25 entries, 25 ready, 0 planned)`, `[sprites] Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)` (`output/phase-1-0/03-sprites-validate.log`); `npm run test:smoke` → `Full smoke summary: 38/38 pass, 0 fail, 0 skipped.` (`output/phase-1-0/11-final-smoke.log`, `output/web-game-smoke/summary.json`); `npm run test:visual-sweep` → `Mission visual sweep complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/mission-visual-sweep` (10/10 pass, `output/phase-1-0/05-baseline-sweep.log`, `output/mission-visual-sweep/summary.json`). All five gates exit 0. Historical pellet miss did not reproduce; old false-positive evidence predicate produced `# pass 1`, `# fail 4` before repair (`06-pellet-evidence-red.log`), then `# pass 5`, `# fail 0` (`07-pellet-evidence-green.log`), both under `output/phase-1-0/`. Full result lines, focused run, screenshots, and review debt are in `docs/prompts/handoff/01-foundation-and-story.md`. | Pending Craig approval; current HEAD `34bde56` |
| EVAL-P1-002 | gate | `.github/workflows/ci.yml` present; `npm run ci` green locally. The remote run URL is recorded after Craig pushes and is not required for PASS | PENDING | | |
| EVAL-P1-003 | gate | `tests/progression-classic.test.ts`: eight open, own weapon, WeaknessTable, placement table, 8 medals, transport round trip, mode mismatch rejected, mode-less transport imports as randomizer | PENDING | | |
| EVAL-P1-004 | gate + review | smoke 33 classic Stage Select: reward `Flame Serpent`, weakness `???` then `Hydro Lance`, pips; 448x252 screenshot with no truncated text | PENDING | | |
| EVAL-P1-005 | gate | `tests/identity-strings.test.ts` (word-boundary regex) green; title screenshot shows `OMEGA RELAY` | PENDING | | |
| EVAL-P1-006 | gate + review | dialogue v2 validator covers the trigger table and every rule with a failing fixture each; Craig read the script | PENDING | | |
| EVAL-P1-007 | gate + review | smoke 34 to 37 green with `storyIntro=on`; six surface screenshots reviewed | PENDING | | |
| EVAL-P1-008 | gate | skip / full-read parity for story flags at unit and smoke level | PENDING | | |
| EVAL-P1-009 | gate + review | pause menu (weapon grid, sub tank) smoke 38b; options persist smoke 38; autosave scenarios adapted; game over continue; death economy | PENDING | | |
| EVAL-P1-010 | gate | `tests/input-actions.test.ts` green; `13d` and `4c` unchanged and green on the action map | PENDING | | |
| EVAL-P1-011 | gate | `tests/upgrades.test.ts`: every capsule and chip effect | PENDING | | |

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
