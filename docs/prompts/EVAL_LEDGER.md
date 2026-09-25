# Eval Ledger

One row per eval id. Status is `PASS`, `FAIL`, `SKIPPED (reason)`, or `PENDING`. Never rename or delete an id; add ids if a prompt needs more. Evidence is a command and its result line, plus an artifact path, plus the commit. Review rows quote Craig's reply verbatim.

Kinds: `gate` (a command with an exit code), `audit` (a script against a budget), `review` (Craig approves at a STOP).

Machine-checked by `npm run agents:check` from prompt 05 on: the status starts with one of the four words; a PASS row cites a commit git knows in its Commit cell (a short hash is fine) and has evidence. A review row's approval lives in `docs/prompts/DECISIONS.md` with Craig's reply verbatim; cite the decision id. Rows for prompts 01 to 04 and the planning and art supplements are in `docs/prompts/archive/EVAL_LEDGER-01-04.md`; they still count for entry checks. At each prompt's exit its rows move verbatim to `docs/prompts/archive/EVAL_LEDGER-<NN>.md` the same way, so this file holds only live prompts.


## Plan v2 (2026-09-22). Prompts 02 to 04 are superseded; their pending rows stay as written and are not run.

## Prompt 06: Levels, mechanics, and enemies

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P6-001 | gate | level v2 parity | PENDING | | |
| EVAL-P6-002 | audit | content audit table, report-only | PENDING | | |
| EVAL-P6-003 | gate | lint on parity stages; pit, wall-kick, vertical smoke | PENDING | | |
| EVAL-P6-004 | gate | mechanics library and lab, smoke 42 | PENDING | 5 of 12 built and drawn (vent, rising_liquid, crumble_group, breakable_wall, verticalSegments; `mechanics_v1` art, gate signs; 265976f, smoke 42); left: conveyor, ice_floor, current_zone, timed_rail_group, wind_zone, rockfall, icicle | |
| EVAL-P6-005 | gate | mini-bosses, smoke 43, miniboss_callout wired | PENDING | 4 of 4 archetypes and 4 skins (custodian walker; relay turret nest, Ferro skin; sentry twins, Gale skin; drill serpent; walker skins Basalt and Glacier), `tests/miniboss-roster.test.ts`, smoke 43 a row per room in `miniboss_lab` (96456e6..62675c5); `npm run -s gate -- verify` on 6ac7a59 -> `PASS verify (402s)`, `Smoke test complete: 59 ran`, 0 failed (`output/smoke-runs/2026-09-25T05-33-58-145Z`); left: stage placement and callouts (12d), the large drop (12h-2), mini-boss HP resets when the hero dies | |
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
| EVAL-P7-001 | gate | twelve hazard spawners; telegraphs drawn; watchdog gone | PENDING | telegraphs drawn for all 31 roster attacks and the watchdog retired (a02ac2c; `output/evidence/a02ac2c/52-boss-telegraphs/`, `tests/boss-telegraphs.test.ts`); left: the hazard spawners |  |
| EVAL-P7-002 | gate | phase kits, desperation, weakness stagger on Pyro and Tide | PASS | all nine wardens and the Core (0e90883): phase two retires, retimes and adds one attack, desperation at 20% adds one, weakness >=1.4 stuns 200 ms; `tests/boss-phase-kits.test.ts` and smoke `44-boss-beats` (Pyro, Tide); `npm run -s gate -- verify` -> `PASS verify (402s)`, `Smoke test complete: 59 ran`, 0 failed (`output/smoke-runs/2026-09-25T05-33-58-145Z`); sweep pass (`output/sweep-runs/2026-09-25T05-39-48-188Z`); `footprint: 22/22` on 6233a5e (`output/evidence/12-wave2/`) | 6ac7a59 |
| EVAL-P7-003 | gate + review | intro and death presentation; smoke 44 | PENDING | gate green on 6ac7a59 (6233a5e, merge fix 6ac7a59): WARNING 1000 ms, name card 1200 ms, bar fill 18 ticks over 900 ms, death hit-stop 20 frames, 8 bursts, boss gone at 1533 ms, dialogue at 2433 ms; smoke 44 in `output/smoke-runs/2026-09-25T05-33-58-145Z`; review waits on Craig's play | |
| EVAL-P7-004 | gate | weapon identities; weakness ring; no BLOCKED in Classic | PENDING | | |
| EVAL-P7-005 | gate + review | all ten fights; 44 across the sweep | PENDING | | |
| EVAL-P7-006 | gate | portraits and dialogue presentation | PENDING | | |
| EVAL-P7-007 | gate + review | every sequence id consumed; Craig reads the script | PENDING | text pass A1-A6 and the panel text conditions done (verb stems 24/24, Central Core, Iona contractions; `tests/story-text-pass.test.ts`); left: item 12 needs a validator change, Craig reads the script, the new triggers (P7-009) |  |
| EVAL-P7-008 | gate | boss beats, damage router, weapon runtime and hit wires extracted; Game.ts at or below 2,600 | PASS | `wc -l src/scenes/Game.ts` -> 1930 (from 2763); BossBeats, BossDamageRouter, HitWires, WeaponRuntime, BossTelegraphs, combatRules in `src/scenes/game/`; `output/evidence/a02ac2c/full-smoke-summary.json`: 56 of 57 pass (33 flakes on the parent too) | a02ac2c |
| EVAL-P7-009 | gate + review | seven new dialogue triggers with fixtures, coverage, consumers and smoke assertions; water margin pilot | PENDING | | |
| EVAL-P7-010 | gate | bosses split into floor body, hurtbox and per-phase attack hitboxes (roster.ts, BossDamageRouter); projectiles hit platforms by body | PENDING | | |

## Prompt 08: Audio, presentation, and release

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P8-001 | gate | cue map test; per-screen music | PENDING | `tests/audio-cue-map.test.ts` (every stage and boss has its own track and phase-two layer; every played key and boss attack resolves) green on 6ac7a59; per-screen music waits on Game passing stage and boss ids (lane 12h-2) | |
| EVAL-P8-002 | gate | credits check; loudness and loop table | PASS | `npm run audio:check` inside verify on 6ac7a59 -> `audio:check PASS: 86 audio files, 86 credited, 33 music files at -16±1 LUFS, TP<=-1dBTP, seam<=3dB, 1 waived, 0 failures` (`output/evidence/12-wave2/check-credits.md`); the waiver is the shared CC0 `stage_loop` (9.09 dB seam), retired once Game passes stage ids | 6ac7a59 |
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

## Prompt 12: Finish the game

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P12-001 | gate | CI runs smoke and sweep on every pull request, not only by hand | PENDING | `.github/workflows/ci.yml` runs smoke and the sweep on pull requests to main (e9781ef); PR #59 run 36097946115 on 66a0abd: test-and-build pass, browser-gates `Smoke test complete: 58 ran`, 2 failed on Linux only (`4-title-controls`, `33-classic-stage-select`: the menu fonts are macOS and Windows system fonts; fix is prompt 08 phase 8.2's bundled font; ad6541b prints the bounds) |  |
| EVAL-P12-002 | gate | saves migrate forward: a versioned migrate step with fixture tests | PASS | `tests/save-migration.test.ts`: a fixture per historical save shape (five, from git history) migrates forward; `# pass 506` on the commit | e9781ef |
| EVAL-P12-003 | gate | version and changelog: package version bumps with a CHANGELOG entry per release | PASS | `output/evidence/12a/version.txt`: `node -p "require('./package.json').version"` -> 0.5.0 and the `CHANGELOG.md` 0.5.0 entry | e9781ef |
| EVAL-P12-004 | gate | a sound for every new action (combo hits, air spin, reflect, vents, slag, walls, crumbles, gates, mini-bosses); unknown SFX keys throw in development | PENDING | 23 generated keys (`scripts/audio/sfx-synth.mjs`, seeds in `assets/audio/sfx/generated/sfx-params.json`); unknown keys throw in development (`resolveSfxKey`); vents, slag, walls, crumbles, gates, rails, rockfall, icicles and gusts wired (1d965ee..9c58106); combo, air spin, reflect, mini-boss and boss call sites wait on lane 12h-2 | |
