# Eval Ledger

One row per eval id. Status is `PASS`, `FAIL`, `SKIPPED (reason)`, or `PENDING`. Never rename or delete an id; add ids if a prompt needs more. Evidence is a command and its result line, plus an artifact path, plus the commit. Review rows quote Craig's reply verbatim.

Kinds: `gate` (a command with an exit code), `audit` (a script against a budget), `review` (Craig approves at a STOP).

Machine-checked by `npm run agents:check` from prompt 05 on: the status starts with one of the four words; a PASS row cites a commit git knows in its Commit cell (a short hash is fine) and has evidence. A review row's approval lives in `docs/prompts/DECISIONS.md` with Craig's reply verbatim; cite the decision id. Rows for prompts 01 to 04 and the planning and art supplements are in `docs/prompts/archive/EVAL_LEDGER-01-04.md`; they still count for entry checks. At each prompt's exit its rows move verbatim to `docs/prompts/archive/EVAL_LEDGER-<NN>.md` the same way, so this file holds only live prompts.


## Plan v2 (2026-09-22). Prompts 02 to 04 are superseded; their pending rows stay as written and are not run.

## Prompt 05: Feel, hero, and camera

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P5-001 | gate | motor tests incl. the drag red/green pair | PASS | tests/player-motor.test.ts: 17 motor tests red before, green after (`output/notes/05a-5.1-red.log`, `05a-5.1-green.log`; constants in `output/notes/05a-5.1-constants.md`); drag 0, dash-jump carry, 280ms dash with 60ms cooldown from the dash end, wall-kick grace and buffered wall jumps, jump cut with -400/+250 hero gravity, ledge forgiveness, crouch stop, time-based hit-stop at 30/60/144fps; `npm run -s gate -- test build` -> PASS (310 at c47fc38, 318 at a15d18e). Reviews `docs/prompts/reviews/2026-09-23-5.1-motor/` (director FIX: short-hop nonlinearity; QA FIX: ledge-probe guard), both fixes carried into 5.2. | c47fc38 |
| EVAL-P5-002 | gate | 13d extended: dash-jump trace, drag 0, second dash inside 100ms | PASS | 13d runs from frame-exact input scripts (`scripts/smoke/inputs/dash-basic.json`, `dash-jump.json`; `stageDebug.replayInputs`, `src/config/frameStepping.ts`): drag 0, separate takeoff and apex reads at vx 320 with `!grounded`, a second dash inside 100ms, 2px position tolerances; passes three times in a row (`output/smoke-runs/2026-09-23T14-57-30-045Z` onward) and inside the full run `output/smoke-runs/2026-09-24T15-07-37-134Z/summary.json` (51/51 at c9da679). Reviews `docs/prompts/reviews/2026-09-23-5.1b-replay/` (QA SHIP; principal-engineer FIX, fixed in 577fb6b: sleep once / wake once, loud failures, cleanup, release of held actions). Open: the in-engine hop-height ladder is not yet recorded in dash-traces.json (unit numbers only). | 577fb6b |
| EVAL-P5-003 | gate | combat feel tests plus 13c, 24, 9, 23, 3 | PASS | `5.2-N` tests red then green in tests/player-combat.test.ts, tests/player-motor.test.ts, tests/death-sequence.test.ts, tests/game-host-seams.test.ts: hit-stop on contact only (sword 5/4, pellet 2, boss weakness 8, never on IMMUNE or BLOCKED), hurt lock with blink, charge on press with a frame-time clock, landing squash and 80ms lock, death sequence (freeze 250, burst, fade at 600, beam-in at 900, READY), shake cap 0.016 never stacked, probe guard, one gravity constant, 144fps landing, 3-frame minimum hold (36/36/42/65/142px). `npm run -s gate -- agents:check test build` -> PASS (349 tests, Game.ts 2,920). Full smoke 51/51 at c9da679 (`output/smoke-runs/2026-09-24T15-07-37-134Z/summary.json`; 13f and 20 updated to the new rules); sweep 10/10 (`output/sweep-runs/2026-09-24T15-19-09-811Z/summary.json`, with the sampled hero invulnerable, 4027ade); footprint 22/22 at 9f3497c. Death capture `output/smoke-runs/2026-09-23T15-20-36-509Z/9-checkpoint-respawn/death-burst.png`. Reviews `docs/prompts/reviews/2026-09-23-5.2-combat/` (director FIX and QA FIX, both fixed in c9da679). | c9da679 |
| EVAL-P5-004 | gate | camera deadzone, look-ahead, vertical-follow math; 18 extended | PASS | Pure `stepCameraFollow` (`src/scenes/game/cameraFollow.ts`: 64px trailing window, 40px look-ahead, vertical window when bounds are taller, capped easing, whole-pixel writes); `camera` block in render_game_to_text; charge ring under `reducedFlashing`. Tests `tests/camera-follow.test.ts`, `tests/camera-director.test.ts`, `tests/hitFeel.test.ts`. Smoke 18 mid-stage lead 40; 40 identity 1.0 with a 2x lead of 37 (`output/smoke-runs/2026-09-24T17-16-17-443Z/40-hd-render/camera-2x.json`). Reviews `docs/prompts/reviews/2026-09-24-5.3-camera/MERGED.md` (fixes 4eff688, 1b7be84, 9e76329). Full smoke 52/52 (`output/smoke-runs/2026-09-24T17-28-43-801Z/summary.json`), sweep pass (`output/sweep-runs/2026-09-24T17-33-03-299Z/summary.json`), footprint 22/22 (`output/perf/footprint-latest.json`). | df941b3 |
| EVAL-P5-005 | review | hero brief and three turnarounds; Craig picks | PASS | `docs/art/style-sheet.md` and `docs/art/hero-brief.md`; four turnarounds through the Higgsfield MCP (`assets/sprites/source/player/hero_turnaround_v1_2026-09-24_{a,b,c,c2}.png`, prompts and job ids in the `.prompts.md`); contact sheet with a 42px silhouette row `output/art-review/hero-turnarounds.png`. Art Director review `docs/prompts/reviews/2026-09-24-5.4-hero/MERGED.md`: FIX, the MAJOR on C (Mega Man ear-fin helmet) fixed by excluding C and redrawing C2. Craig picks at STOP 5.4 (D-014). | 77a3a23 |
| EVAL-P5-006 | gate | hero coverage validator red then green; frame audit | PASS | red: `tests/sprites-coverage.test.ts:83` (a missing hero group fails); green: `:46` and `npm run sprites:validate` on the real atlas (coverage valid, 48 hero groups; frame audit passed, 106 frames) | 265976f |
| EVAL-P5-007 | gate | full smoke and sweep with the generated hero; ripped material gone | PASS | full smoke 56/56 `output/smoke-runs/2026-09-25T01-12-28-556Z`; sweep complete `output/sweep-runs/2026-09-25T01-18-47-293Z`; no franchise strings in `src/` or the dist bundle; `assets/private` deleted | 265976f |
| EVAL-P5-008 | gate + review | profiles: three slots, name, export/import; smoke 41 | PENDING | | |
| EVAL-P5-009 | gate | the tutorial teaches: five teach locks, Rook's recorded prompts, UI key hints; smoke 49 | PASS | Six-screen tutorial, five `roomLocks` (jump, dash over 216px, wall-kick shaft, charge, saber), checkpoints 44/928/1392/2450; `src/mechanics/roomLock.ts` and adapter; `tutorial_coach` (5 Rook lines) and lane key hints. Tests `tests/room-lock.test.ts`, `tests/tutorial-layout.test.ts`, `tests/toast-lane.test.ts`, `tests/dialogue-content.test.ts`. Smoke 49: wrong input first per lock, no-warp shaft climb, Rook's line per lock, radio at the shaft exit (`output/smoke-runs/2026-09-24T17-28-43-801Z/49-tutorial-verbs/`). Reviews `docs/prompts/reviews/2026-09-24-5.7-tutorial/MERGED.md` (fixes bf3b51a, 44f6c51). Deferred to 06: roster, secret, crumble group, lane box. Full smoke and sweep as P5-004. | df941b3 |
| EVAL-P5-010 | gate | harness and health: smoke continues past failures, timestamped evidence, stepFrames, loader directory imports, pins, requirements.txt; Game.ts at or below 3,400 | PASS | Commits fc2aa99 (harness, stepFrames, loader, pins), aa4f34f (lockfile after the release seat's BLOCK), 55c22d6 (extraction: Game.ts 3,639 to 2,930), 99d6b16 (type-only Phaser, 8 seam tests, stageId fix), 8791f37 (synchronous hook install after the QA MAJOR). `SMOKE_FORCE_FAIL=4-title-controls` run: exit 1 with both scenarios recorded (`output/smoke-runs/2026-09-23T08-56-25-071Z/summary.json`); `npm run -s gate -- agents:check test build` -> PASS (318 tests), Game.ts 2,923; quiet-tree full smoke 51/51 (`output/smoke-runs/2026-09-23T14-57-30-045Z/summary.json`) and sweep 10/10 (`output/sweep-runs/2026-09-23T15-00-32-110Z/summary.json`) at a15d18e. Open: the process-group dev-server stop has local evidence only until Craig pushes and dispatches CI browser-gates (QA MAJOR, `docs/prompts/reviews/2026-09-23-5.0-harness/MERGED.md`). Reviews: 5.0-harness, 5.0c-extraction, 5.0d-seams. | 8791f37 |
| EVAL-P5-011 | gate + review | 5.8 playtest fixes: HUD drawn under WebGL, overlays off the floor row, TARGET label | PASS | Craig: no boss, text over the hero (Retina Safari). `BakedGraphics` rebuilds its DynamicTexture (3.90 `setSize` kept a 1x1 target); panel and lane hang from the HUD band (`src/ui/overlayLayout.ts`). Smoke 40 red `0/38 points differ from the band` then green 38/38, lead 33 and 36 (`output/smoke-runs/2026-09-24T18-21-25-047Z`); 49 briefing panel bottom 149 above the hero (`...18-15-57-142Z/49-tutorial-verbs/`); lane guard test red then green; `gate agents:check test build` PASS (381). After-shot `output/probes/tutorial-boss-after/b3.png`. Reviews `docs/prompts/reviews/2026-09-24-5.8-playtest/MERGED.md` (director SHIP, QA FIX fixed in c353c9c). | c353c9c |

## Prompt 06: Levels, mechanics, and enemies

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P6-001 | gate | level v2 parity | PENDING | | |
| EVAL-P6-002 | audit | content audit table, report-only | PENDING | | |
| EVAL-P6-003 | gate | lint on parity stages; pit, wall-kick, vertical smoke | PENDING | | |
| EVAL-P6-004 | gate | mechanics library and lab, smoke 42 | PENDING | 5 of 12 built and drawn (vent, rising_liquid, crumble_group, breakable_wall, verticalSegments; `mechanics_v1` art, gate signs; 265976f, smoke 42); left: conveyor, ice_floor, current_zone, timed_rail_group, wind_zone, rockfall, icicle | |
| EVAL-P6-005 | gate | mini-bosses, smoke 43, miniboss_callout wired | PENDING | 1 of 4 archetypes: custodian_walker in Heat Works, callout wired, smoke 43 (265976f); left: relay_turret_nest, sentry_twins, drill_serpent, walker skins | |
| EVAL-P6-006 | gate | enemy behaviour and respawn tests and captures | PENDING | | |
| EVAL-P6-007 | gate + review | nine tilesets and backgrounds, zero placeholder skins | PENDING | | |
| EVAL-P6-008 | gate | twelve enemy families original; frame audit | PENDING | | |
| EVAL-P6-009 | gate + review | Pyro Maw pilot to budget; Craig plays | PENDING | built 2026-09-25: 12 screens, 20 placements of 5 types, 13 vents, 5 pits, 4 checkpoints, 3 secrets; 448 tests; smoke 40, 42, 49, 50 `output/smoke-runs/2026-09-25T00-08-32-926Z`; mini-boss is stand-ins until P6-005; Craig has not played it | |
| EVAL-P6-010 | gate + review | nine non-Omega stages pass audit and lint | PENDING | | |
| EVAL-P6-011 | gate + review | Omega in three acts | PENDING | | |
| EVAL-P6-012 | gate | difficulty and death economy | PENDING | | |
| EVAL-P6-013 | gate | sweep v2 assertions; audit and lint in verify | PENDING | | |
| EVAL-P6-014 | gate | StageBuilder, PickupSystem and EnemyRuntime extracted; Game.ts at or below 3,000 | PENDING | | |
| EVAL-P6-015 | gate | hit contract: one resolveHurtbox for sword, shots and overlay; enemy melee vs the body profile; idempotent platform colliders; HitWires.ts; Game.ts at or below 2,700 | PENDING | | |
| EVAL-P6-016 | gate + review | eight warden base sheets regenerated (idle, move, attack, hurt, death) with a grounding capture per boss | PENDING | | |
| EVAL-P6-017 | gate | tiles drawn from a per-biome tileset (pure frame picking tested), rectangles as fallback, collisions unchanged; no boss framing in the HUD before the fight | PENDING | | |
| EVAL-P6-018 | gate + review | relay biome tileset and three-layer background from Higgsfield, cut, attributed | PENDING | | |
| EVAL-P6-019 | gate + review | tutorial rebuilt: safe dash teach, spikes after the verb, roster, secret, crumble group; smoke 49 green | PENDING | | |
| EVAL-P6-020 | gate | hero combat (Craig): three-hit saber combo and air spin, per-frame hitbox, reflect, buster and saber art per charge; smoke 51 | PASS | `output/smoke-runs/2026-09-25T01-12-28-556Z/51-saber-combo/`: Rook HP 24 -> 22 -> 20 -> 16 over the three hits, dash cancel, a reflected shot damages the boss, charge aura visible; `Smoke test complete: 56 ran` all pass | 265976f |
| EVAL-P6-021 | gate | respawn holds (Craig: "kept on spawning in the lava and dying"): the body keeps its size under sprite scale | PASS | `tests/player-body-profiles.test.ts` (red without the lock); smoke 50 asserts the hero stands after a slag and a pit death; probe: one death per pit | 265976f |
| EVAL-P6-022 | gate | stage textures to budget: view-wide parallax, per-stage boss and mini-boss atlases | PASS | `output/perf/footprint-latest.json`: `footprint: 22/22 within budget`; stage 7.99MB (was 27), boot 3.51MB (was 6.52) | 265976f |

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
| EVAL-P7-010 | gate | bosses split into floor body, hurtbox and per-phase attack hitboxes (roster.ts, BossDamageRouter); projectiles hit platforms by body | PENDING | | |

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

Complete; rows moved verbatim to `docs/prompts/archive/EVAL_LEDGER-09.md` on 2026-09-24.

## Prompt 10: The agent system

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P10-001 | gate | `npm run agents:check` exists, is part of `verify`, is green, and each rule has a failing fixture | PASS | `npm run agents:check` -> `agents:check: 0 errors, 9 legacy warnings` inside `npm run verify` exit 0 (`output/phase-9-exit/final-verify.log`); `tests/agents-checks.test.ts` 16 fixtures pass within `# pass 286`; the seat review found four ways the first version passed bad input, each now has a fixture | `0da4f40`, `275a3c0` |
| EVAL-P10-002 | audit | a context pack for every part, under 30K tokens, with the right phases | PASS | `npm run agents:context -- --part 05a` -> `~11315 tokens (budget 30000)` with phases 5.0, 5.1, 5.2, prompt 05's ledger rows, handoff 01's inputs, open decisions and live facts (`output/context/05a.md`); every part of 05 to 10 built between 5.8K and 11.3K; `partPhases` fixture covers 06e/06f, 06h, 09a ranges | `275a3c0` |
| EVAL-P10-003 | gate | `progress.md` rotated losslessly, under budget, with Now and the template | PASS | The docs-steward seat checked the archive is byte-identical to the old file after a 4-line header (`docs/prompts/reviews/2026-09-22-10a/docs-steward.md`); `npm run agents:check` doc budgets PASS (`output/phase-9-exit/final-verify.log`) | `0da4f40` |
| EVAL-P10-004 | gate + review | three or more blind seats reviewed 10a; merged, scored, acted on | PASS | `npm run agents:reviews -- docs/prompts/reviews/2026-09-22-10a --expect docs-steward,qa-eval,principal-engineer` -> `3 reviews, 31 evidenced findings (2 BLOCK), 0 format problems` (`docs/prompts/reviews/2026-09-22-10a/MERGED.md`, `docs/prompts/reviews/SCORES.md`); both BLOCKs and the MAJORs fixed in `275a3c0`, resolution in `docs/prompts/handoff/10a-agent-system.md` | `275a3c0` |
| EVAL-P10-005 | gate | always-read files within budget, stale facts gone, doc paths resolve, handoff 01 corrected | PASS | `npm run agents:check` -> doc budgets, doc paths, handoffs PASS (`output/phase-9-exit/final-verify.log`); `AGENTS.md` 84 lines, `CLAUDE.md` 10; counts point at `npm run agents:facts`; handoff 01 status corrected with `D-003` open and blocking entry 5 | `275a3c0` |
| EVAL-P10-006 | gate | (10b) CI runs `npm run agents:check` on every push | PASS | `.github/workflows/ci.yml:25` runs `npm run agents:check` before `npm ci`, with `fetch-depth: 0` so commit cells resolve; `D-011` DECIDED by panel (`docs/prompts/reviews/2026-09-22-decisions/MERGED.md`); first GitHub run happens on Craig's next push | `67d2d34` |
| EVAL-P10-007 | gate | (10b) evidence tied to commits: summaries carry `commit` and `dirty`; per-eval snapshots | PASS | `scripts/lib/provenance.mjs` spread into the smoke and sweep summaries; `npm run agents:evidence` wrote `docs/prompts/evidence/EVAL-P1-007.json` (commit, dirty, file hashes) and `output/evidence/EVAL-P1-007/` | `67d2d34` |
| EVAL-P10-008 | gate | (10b) a test builds every part's pack under 30K; 06 and 08 carry the sections they cite from 02 and 04 | PASS | `tests/context-packs.test.ts` builds every part of 05 to 11 under 30K inside `npm run -s gate -- test` -> `# pass 291` (`output/gates/test.log`); `sharedSections` in `tests/agent-budget.json` adds 02 Route budget and 03 Production rules | `67d2d34` |
| EVAL-P10-009 | review | (10b) retro at each prompt exit proposes at most one rule change as a DECISIONS row | PENDING | `npm run agents:retro -- --prompt 10` -> `output/retro/10.md: 9 ledger rows, 3 score rows, 2 decisions, 3 progress entries`; the first docs-steward retro proposal runs at 05's exit (with P11-008) | |

## Prompt 11: Token efficiency

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P11-001 | gate | `npm run agents:packet` writes a packet (brief, format, scope, diff) and exits 1 over budget naming the largest parts | PASS | `npm run agents:packet -- --seat qa-eval --scope ... --diff HEAD` -> `~22167 tokens (budget 20000)`, exit 1, `largest parts: Diff HEAD ~21412, ...`; a scoped packet with one excerpt and one image -> `~1402 tokens` (`output/packets/qa-eval-2026-09-230110-qa-eval.md` is the over-budget one, written before the exit) | `67d2d34` |
| EVAL-P11-002 | gate | `parseTokens` fixture; `SCORES.md` Tokens column; merges warn over budget | PASS | `tests/agents-checks.test.ts` "parseTokens reads the Tokens header" inside `# pass 291` (`output/gates/test.log`); `merge-reviews.mjs` rewrites the SCORES header with Tokens; `merge-decisions.mjs` warns over `tokens.panelSeat` | `67d2d34` |
| EVAL-P11-003 | gate | every `.claude/agents/*.md` has a `model:` line; runner and implementer exist; README tier tables match | PASS | `grep -h '^model:' .claude/agents/*.md` -> 10 sonnet, 1 opus, 1 haiku; `docs/prompts/seats/README.md` "Model tiers" and the risk-tier table | `67d2d34` |
| EVAL-P11-004 | review | one fast-tier worker run from a task card returns a valid result card | PASS | haiku worker, runner brief, card for `npm run test` and `agents:check` -> `Outcome: DONE`, `# pass 291 # fail 0`, `0 errors, 5 legacy warnings` (`output/runner/test.log`); 7 calls, 57K tokens: the measurement that set the calls-times-context rule and the gate wrapper | `67d2d34` |
| EVAL-P11-005 | review | (11b) first R2 review of 05a with packets: each seat at most 60K tokens and 5 calls, findings evidenced, Tokens in `SCORES.md` | PENDING | | |
| EVAL-P11-006 | gate | a quiet gate wrapper keeps full logs in `output/gates/` and prints one result line per script | PASS | `npm run -s gate -- test agents:check` -> `PASS test (11s): # pass 291 ... # fail 0 (output/gates/test.log)` and `PASS agents:check (0s): agents:check: 0 errors, 5 legacy warnings ...` | `67d2d34` |
| EVAL-P11-007 | gate | (11b) `run-seats.sh --diff` through Codex with `CODEX_MODEL`, merged green | PENDING | | |
| EVAL-P11-008 | review | (11b) 05 exit retro compares Tokens per seat with the 2026-09-22 audit and proposes at most one budget change | PENDING | | |
