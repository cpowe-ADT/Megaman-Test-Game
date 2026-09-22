# Eval Ledger

One row per eval id. Status is `PASS`, `FAIL`, `SKIPPED (reason)`, or `PENDING`. Never rename or delete an id; add ids if a prompt needs more. Evidence is a command and its result line, plus an artifact path, plus the commit. Review rows quote Craig's reply verbatim.

Kinds: `gate` (a command with an exit code), `audit` (a script against a budget), `review` (Craig approves at a STOP).

Machine-checked by `npm run agents:check` from prompt 05 on: the status starts with one of the four words; a PASS row cites a commit git knows in its Commit cell (a short hash is fine) and has evidence. A review row's approval lives in `docs/prompts/DECISIONS.md` with Craig's reply verbatim; cite the decision id. Rows for prompts 01 to 04 and the planning and art supplements are in `docs/prompts/archive/EVAL_LEDGER-01-04.md`; they still count for entry checks.


## Plan v2 (2026-09-22). Prompts 02 to 04 are superseded; their pending rows stay as written and are not run.

## Prompt 05: Feel, hero, and camera

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P5-001 | gate | motor tests incl. the drag red/green pair | PENDING | | |
| EVAL-P5-002 | gate | 13d extended: dash-jump trace, drag 0, second dash inside 100ms | PENDING | | |
| EVAL-P5-003 | gate | combat feel tests plus 13c, 24, 9, 23, 3 | PENDING | | |
| EVAL-P5-004 | gate | camera deadzone, look-ahead, vertical-follow math; 18 extended | PENDING | | |
| EVAL-P5-005 | review | hero brief and three turnarounds; Craig picks | PENDING | | |
| EVAL-P5-006 | gate | hero coverage validator red then green; frame audit | PENDING | | |
| EVAL-P5-007 | gate | full smoke and sweep with the generated hero; ripped material gone | PENDING | | |
| EVAL-P5-008 | gate + review | profiles: three slots, name, export/import; smoke 41 | PENDING | | |
| EVAL-P5-009 | gate | the tutorial teaches: five teach locks, Rook's recorded prompts, UI key hints; smoke 49 | PENDING | | |
| EVAL-P5-010 | gate | harness and health: smoke continues past failures, timestamped evidence, stepFrames, loader directory imports, pins, requirements.txt; Game.ts at or below 3,400 | PENDING | | |

## Prompt 06: Levels, mechanics, and enemies

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P6-001 | gate | level v2 parity | PENDING | | |
| EVAL-P6-002 | audit | content audit table, report-only | PENDING | | |
| EVAL-P6-003 | gate | lint on parity stages; pit, wall-kick, vertical smoke | PENDING | | |
| EVAL-P6-004 | gate | mechanics library and lab, smoke 42 | PENDING | | |
| EVAL-P6-005 | gate | mini-bosses, smoke 43, miniboss_callout wired | PENDING | | |
| EVAL-P6-006 | gate | enemy behaviour and respawn tests and captures | PENDING | | |
| EVAL-P6-007 | gate + review | nine tilesets and backgrounds, zero placeholder skins | PENDING | | |
| EVAL-P6-008 | gate | twelve enemy families original; frame audit | PENDING | | |
| EVAL-P6-009 | gate + review | Pyro Maw pilot to budget; Craig plays | PENDING | | |
| EVAL-P6-010 | gate + review | nine non-Omega stages pass audit and lint | PENDING | | |
| EVAL-P6-011 | gate + review | Omega in three acts | PENDING | | |
| EVAL-P6-012 | gate | difficulty and death economy | PENDING | | |
| EVAL-P6-013 | gate | sweep v2 assertions; audit and lint in verify | PENDING | | |
| EVAL-P6-014 | gate | StageBuilder, PickupSystem and EnemyRuntime extracted; Game.ts at or below 3,000 | PENDING | | |

## Prompt 07: Bosses, weapons, and story

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P7-001 | gate | twelve hazard spawners; telegraphs drawn; watchdog gone | PENDING | | |
| EVAL-P7-002 | gate | phase kits, desperation, weakness stagger on Pyro and Tide | PENDING | | |
| EVAL-P7-003 | gate + review | intro and death presentation; smoke 44 | PENDING | | |
| EVAL-P7-004 | gate | weapon identities; weakness ring; no BLOCKED in Classic | PENDING | | |
| EVAL-P7-005 | gate + review | all ten fights; 44 across the sweep | PENDING | | |
| EVAL-P7-006 | gate | portraits and dialogue presentation | PENDING | | |
| EVAL-P7-007 | gate + review | every sequence id consumed; Craig reads the script | PENDING | | |
| EVAL-P7-008 | gate | boss beats, damage router, weapon runtime and hit wires extracted; Game.ts at or below 2,600 | PENDING | | |
| EVAL-P7-009 | gate + review | seven new dialogue triggers with fixtures, coverage, consumers and smoke assertions; water margin pilot | PENDING | | |

## Prompt 08: Audio, presentation, and release

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P8-001 | gate | cue map test; per-screen music | PENDING | | |
| EVAL-P8-002 | gate | credits check; loudness and loop table | PENDING | | |
| EVAL-P8-003 | gate + review | pixel font; four screens | PENDING | | |
| EVAL-P8-004 | gate | beats; smoke 45 | PENDING | | |
| EVAL-P8-005 | gate | gamepad, remap, options; smoke 46 | PENDING | | |
| EVAL-P8-006 | gate | public build check | PENDING | | |
| EVAL-P8-007 | gate | deploy workflow, verify:public, itch zip | PENDING | | |
| EVAL-P8-008 | gate | full campaign smoke 47, both variants | PENDING | | |
| EVAL-P8-009 | review | Craig's playtest sheet | PENDING | | |
| EVAL-P8-010 | gate | live URL after the tag | PENDING | | |
| EVAL-P8-011 | gate | perf budget scenario 51 on WebGL at scale 4 with a committed baseline | PENDING | | |

## Prompt 09: Footprint and performance

Evidence for 09a was produced on 2026-09-22 (Claude, planning session) and committed as `9390db8` (harness), `773e00d` (build), `14841ac` (runtime), `ee57454` (docs); 09b and 09c as `df30ca8`.

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P9-001 | gate | `npm run perf:footprint` exists, runs report-only for a baseline, writes JSON and Markdown, and checks `tests/perf-budget.json` | PASS | `PERF_REPORT_ONLY=1 PERF_LABEL=baseline node scripts/perf/footprint.mjs` -> `footprint: 8/20 within budget, 0 page errors` (`output/perf/footprint-baseline.{json,md}`; baseline is `7b9ff8e` plus the 9.1 chunk fix, because the unfixed build does not boot) | `9390db8` |
| EVAL-P9-002 | gate | the production build boots: 0 page errors in every footprint scenario | PASS | Red: `dist/` at `7b9ff8e` -> `ReferenceError: Cannot access 'b' before initialization` at `assets/boss-DljATAW1.js:1:2864`, Title never reached. Green: `PERF_LABEL=09a npm run perf:footprint` -> `footprint: 20/20 within budget, 0 page errors` (`output/perf/footprint-09a.json`) | `773e00d` |
| EVAL-P9-003 | audit | boot: download at or under 3MB, Title at or under 2.5s headless, decoded audio at Title at or under 16MB | PASS | `output/perf/footprint-09a.md`: `static.bootDownloadMB 2.11` (was 6.11), `boot.titleReadyMs 1065` (was 3583), `boot.decodedAudioMB 15.64` (was 86.31), `boot.textureMB 4.66` (was 13.52). `tests/music-residency.test.ts` 4/4 | `14841ac` |
| EVAL-P9-004 | audit | static: `dist/` at or under 12MB, maps at or under 0.5MB, JS gzip at or under 520KB, Phaser gzip at or under 300KB | PASS | `static.distTotalMB 7.98` (was 19.98), `static.distMapsMB 0` (was 11.61), `static.jsGzipKB 440.3` (was 482.8), `static.phaserChunkGzipKB 294.2` (was 337.3); `npm run build` -> `✓ built in 2.67s`, `Checked 153 runtime asset files and 2 emitted build refs in dist/.` (`output/phase-9a/verify.log`) | `773e00d` |
| EVAL-P9-005 | audit | running memory: stage decoded audio at or under 16MB, boss at or under 64MB, textures at or under 12MB | PASS | `stage.decodedAudioMB 15.11`, `boss.decodedAudioMB 61.19` (both were 86.31); `stage.textureMB 8.3` (was 22.14). `tests/stage-background-loading.test.ts` 4/4. Sweep captures opened: `output/mission-visual-sweep/pyro_maw/mid.png` (industrial layers), `glacier_ronin/boss-room.png` (snow layers), `omega_fortress/start.png` (dock and industrial layers, same fade as `output/phase-1-2/visual-sweep-final/omega_fortress/start.png`) | `14841ac` |
| EVAL-P9-006 | gate | hi-DPI canvas at or under 4,064,256 pixels; cap test; smoke `40-hd-render` | PASS | `hiDpi.maxCanvasPixels 4064256` (2560x1440@2x was 4480x2520, 45.2MB; now 2688x1512, 16.3MB); `tests/hd-render.test.ts` cap test green; smoke `40-hd-render` pass including the new menu-frame check (`output/phase-9a/full-smoke/40-hd-render/menus-2x.json` all empty; `menu-title-2x.png`, `menu-options-2x.png` opened: centred, HD text). Red before the `GAME_SIZE` fix: `output/perf/hd-check/title-2x.png`, `options-2x.png` (off centre) | `14841ac` |
| EVAL-P9-007 | gate | per-frame waste removed; settings cache tested; step p95 at or under 12ms; menu, boss-room and HD smoke green | PASS | `stage.stepP95Ms 6.8` (was 10.7), boss p95 8.4 (was 10.9), SwiftShader proxy; `tests/settings-cache.test.ts` 3/3; full smoke 51/51 includes `4-title-controls`, `8-boss-room-activation`, `38-options-persist`, `38b-pause-weapon-select`, `40-hd-render`. `Game.ts` 3,704 -> 3,639 lines | `14841ac` |
| EVAL-P9-008 | gate | revisit growth: heap at or under 4MB, textures 0, listeners 0; one set of Options and pause rows per visit | PASS | `revisit.heapGrowthMB -1.65`, `textureGrowth 0`, `listenerGrowth 0`; smoke `38-options-persist` (third visit: `rowObjects` equals rows, visible music value updates) and `38b-pause-weapon-select` (second pause: `rowBackplates` equals options) pass | `14841ac` |
| EVAL-P9-009 | gate + review | pools and batching (9.5) | PENDING | | |
| EVAL-P9-010 | gate + review | text and HUD cost (9.6) | PENDING | | |
| EVAL-P9-011 | review | disk footprint (9.7) | PENDING | measured, not acted on: `.git` 185MB loose, 111MB if packed | |
| EVAL-P9-012 | gate | exit: verify, sweep and footprint on the exit commit; budgets lowered to achieved plus 15% | PENDING (09a gates below are green) | 09a run: `npm run verify` exit 0 -> `Manifest valid (25 entries, 25 ready, 0 planned)`, `Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)`, `Test summary: 12 passed, 0 failed`, `# pass 268`, `# fail 0`, `✓ built in 2.67s`, smoke `pass {"pass":51}` (`output/phase-9a/verify.log`, `output/phase-9a/full-smoke/summary.json`); `npm run test:visual-sweep` exit 0, 10/10 pass (`output/phase-9a/sweep.log`, `output/mission-visual-sweep/summary.json`) | |
