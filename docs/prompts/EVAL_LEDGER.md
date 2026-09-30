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
| EVAL-P6-004 | gate | mechanics library and lab, smoke 42 | PASS | 12 of 12 with tests: vent, rising_liquid, crumble_group, breakable_wall, verticalSegments (265976f) and conveyor, ice_floor, current_zone, timed_rail_group, wind_zone, rockfall, icicle (03c353e, a nine-screen lab, smoke 42 section 6); `npm run -s gate -- verify` on 08be26e -> `PASS verify (392s)`, `# pass 615`, `Smoke test complete: 60 ran`, 0 failed (`output/smoke-runs/2026-09-25T06-20-07-817Z`); sweep pass (`output/sweep-runs/2026-09-25T06-26-37-193Z`); `footprint: 22/22 within budget` (`output/evidence/12-wave3/`); Craig's lab approval (STOP 12b) is separate | 08be26e |
| EVAL-P6-005 | gate | mini-bosses, smoke 43, miniboss_callout wired | PENDING | 4 of 4 archetypes and 4 skins (custodian walker; relay turret nest, Ferro skin; sentry twins, Gale skin; drill serpent; walker skins Basalt and Glacier), `tests/miniboss-roster.test.ts`, smoke 43 a row per room in `miniboss_lab` (96456e6..62675c5); `npm run -s gate -- verify` on 6ac7a59 -> `PASS verify (402s)`, `Smoke test complete: 59 ran`, 0 failed (`output/smoke-runs/2026-09-25T05-33-58-145Z`); left: stage placement and callouts (12d), the large drop (12h-2), mini-boss HP resets when the hero dies; the large health drop (heal 6) replaces the small capsule on a mini-boss defeat (6db94e0, `output/evidence/12-wave3/pickups-contact.png`) |  |
| EVAL-P6-006 | gate | enemy behaviour and respawn tests and captures | PENDING | charge, the 400 ms beam, the ledge probe on real solids, the shield arc, the manifest per family, the Tide shield and Glacier slide variants (0a71f01; `tests/enemy-*.test.ts`, smoke 64, sweep 11/11); in `PASS verify (982s)` on 912fa4a; left: the camera-relative spawn and respawn tests of prompt 06 phase 6.1 (13h.3) |  |
| EVAL-P6-007 | gate + review | nine tilesets and backgrounds, zero placeholder skins | PENDING | | |
| EVAL-P6-008 | gate | twelve enemy families original; frame audit | PENDING | | |
| EVAL-P6-009 | gate + review | Pyro Maw pilot to budget; Craig plays | PENDING | built 2026-09-25: 12 screens, 20 placements of 5 types, 13 vents, 5 pits, 4 checkpoints, 3 secrets; 448 tests; smoke 40, 42, 49, 50 `output/smoke-runs/2026-09-25T00-08-32-926Z`; mini-boss is stand-ins until P6-005; Craig has not played it | |
| EVAL-P6-010 | gate + review | nine non-Omega stages pass audit and lint | PENDING | all eight warden stages rebuilt to the Heat Works standard through the stage registry (804c87e): Water, Medicine, Power, Public Archives, Structural Works, Transit Security, Weather (each 12 or 13 screens, its two mechanics, a defeat-locked mid-boss room with its callout, two gated secrets and the capsule, 18 or more placements, four checkpoints, a route smoke 54 to 60); the gate on 381455e -> `PASS verify (745s)`, `# pass 722`, `Smoke test complete: 69 ran`, 0 failed (`output/smoke-runs/2026-09-30T16-01-45-536Z`), sweep pass, `footprint: 22/22` (`output/evidence/12d/`); the review half is Craig's play (D-018 delegated the batch STOPs); boss rooms run in 12f wave 6 |  |
| EVAL-P6-011 | gate + review | Omega in three acts | PENDING | the Central Core in three acts (`src/content/stages/omegaFortress.ts`, `src/content/omegaArchive.ts`, `src/scenes/game/OmegaActs.ts`; save v6 with its v5 step, `tests/omega-save-migration.test.ts`); the principal-engineer review's five findings fixed (5c61cd8, 173d1d0); gate green on 481251a and in `PASS verify (982s)` on 912fa4a, 72 ran, 0 failed (`output/evidence/13-wave/verify-912fa4a.log`); supersedes EVAL-P2-007; left: the review half, Craig's play | |
| EVAL-P6-012 | gate | difficulty and death economy | PENDING | | |
| EVAL-P6-013 | gate | sweep v2 assertions; audit and lint in verify | PENDING | | |
| EVAL-P6-014 | gate | StageBuilder, PickupSystem and EnemyRuntime extracted; Game.ts at or below 3,000 | PENDING | | |
| EVAL-P6-015 | gate | hit contract: one resolveHurtbox for sword, shots and overlay; enemy melee vs the body profile; idempotent platform colliders; HitWires.ts; Game.ts at or below 2,700 | PENDING | | |
| EVAL-P6-016 | gate + review | eight warden base sheets regenerated (idle, move, attack, hurt, death) with a grounding capture per boss | PENDING | | |
| EVAL-P6-017 | gate | tiles drawn from a per-biome tileset (pure frame picking tested), rectangles as fallback, collisions unchanged; no boss framing in the HUD before the fight | PASS | ace741f: ground, ledges, walls, catwalks and spikes from the per-biome tileset (`src/stage/tileSkin.ts`, pure placement in `tests/tile-skin.test.ts`), per-stage atlas load and eviction (`src/scenes/game/stageTileLoading.ts`), rectangles as the fallback, physics bodies unchanged, no boss panel before the fight; every stage since draws from its tileset (nine sets under `assets/sprites/tiles/`); gate on 71d3965 -> `PASS test (25s): # pass 762`, 0 failing | ace741f |
| EVAL-P6-018 | gate + review | relay biome tileset and three-layer background from Higgsfield, cut, attributed | PASS | bde36c0, f817ff3: the relay 16px tileset (23 tiles, `assets/sprites/tiles/relay/`) and a far and a mid parallax layer (`assets/backgrounds/relay/`) over the biome sky fill, from Higgsfield gpt_image_2, cut by `scripts/sprites/cut_background_layer.py`, attributed in `assets/backgrounds/README.md` (prompts and job ids in `source/relay/relay_v1.prompts.md`); contrast fix after the STOP captures; review: Craig accepted the rebuilt tutorial as the standard to repeat (D-017) | f817ff3 |
| EVAL-P6-019 | gate + review | tutorial rebuilt: safe dash teach, spikes after the verb, roster, secret, crumble group; smoke 49 green | PENDING | ea9e54a: the dash room with a spike-free floor under the gap, spikes only after the verb, the enemy roster per the brief, the boss-gate checkpoint, smoke 49 replaying both gap outcomes; Craig accepted the tutorial as the standard (D-017); left: the secret and the crumble group (the tutorial patch has neither) | |
| EVAL-P6-020 | gate | hero combat (Craig): three-hit saber combo and air spin, per-frame hitbox, reflect, buster and saber art per charge; smoke 51 | PASS | `output/smoke-runs/2026-09-25T01-12-28-556Z/51-saber-combo/`: Rook HP 24 -> 22 -> 20 -> 16 over the three hits, dash cancel, a reflected shot damages the boss, charge aura visible; `Smoke test complete: 56 ran` all pass | 265976f |
| EVAL-P6-021 | gate | respawn holds (Craig: "kept on spawning in the lava and dying"): the body keeps its size under sprite scale | PASS | `tests/player-body-profiles.test.ts` (red without the lock); smoke 50 asserts the hero stands after a slag and a pit death; probe: one death per pit | 265976f |
| EVAL-P6-022 | gate | stage textures to budget: view-wide parallax, per-stage boss and mini-boss atlases | PASS | `output/perf/footprint-latest.json`: `footprint: 22/22 within budget`; stage 7.99MB (was 27), boot 3.51MB (was 6.52) | 265976f |

## Prompt 07: Bosses, weapons, and story

PASS rows P7-001, P7-002, P7-004, P7-008, P7-010 are in `docs/prompts/archive/EVAL_LEDGER-pass-07-08-12.md`.

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P7-003 | gate + review | intro and death presentation; smoke 44 | PENDING | gate green on 6ac7a59 (6233a5e, merge fix 6ac7a59): WARNING 1000 ms, name card 1200 ms, bar fill 18 ticks over 900 ms, death hit-stop 20 frames, 8 bursts, boss gone at 1533 ms, dialogue at 2433 ms; smoke 44 in `output/smoke-runs/2026-09-25T05-33-58-145Z`; review waits on Craig's play | |
| EVAL-P7-005 | gate + review | all ten fights; 44 across the sweep | PENDING | all eight warden boss rooms built as stage data (227c436 to c883075; `src/boss/bossRoomLayout.ts`, `tests/boss-room-layout.test.ts`, smoke 39 with a channel room and the Gale shaft); the sweep passes every fight (`2026-09-30T17-03-54-444Z`, 10 of 10); left: Craig plays the fights |  |
| EVAL-P7-006 | gate | portraits and dialogue presentation | PENDING | | |
| EVAL-P7-007 | gate + review | every sequence id consumed; Craig reads the script | PENDING | text pass A1-A6 and the panel text conditions done (verb stems 24/24, Central Core, Iona contractions; `tests/story-text-pass.test.ts`); left: item 12 needs a validator change, Craig reads the script, the new triggers (P7-009); item 12 done (e020edb: OMEGA answers Iona at milestone 4, the validator accepts it); the narrative seat's major on that line's verb 'hold' goes to Craig with the script read (`docs/prompts/reviews/2026-09-25-12g-story-lines/`) |  |
| EVAL-P7-009 | gate + review | seven new dialogue triggers with fixtures, coverage, consumers and smoke assertions; water margin pilot | PENDING | B items 8 to 13 done (e020edb, c42c8db, 6016466: capsule cache logs, OMEGA at phase two, the weapon registry, the game-over rotation, the epilogue secret; `tests/story-triggers.test.ts`, smoke 37b, also green on the production build: `output/gates/wave3b-preview-smoke.log`); item 7 landed in 05; left: the water margin pilot (item 14, with 12d's Water District) and Craig's review |  |

## Prompt 08: Audio, presentation, and release

PASS rows P8-001, P8-002, P8-004, P8-005 are in `docs/prompts/archive/EVAL_LEDGER-pass-07-08-12.md`.

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P8-003 | gate + review | pixel font; four screens | PENDING | the font half: OmegaPixel, an original 8px pixel font built by `scripts/fonts/build-pixel-font.py`, replaces MENU_FONT_* and the menu, HUD and results monospace (17a83ba, 86ccdec, 6a94695, d745442); `tests/pixel-font.test.ts`; smoke 4, 33, 40 green; left: the logo, Title and Stage Select art, and Craig's four-screen review |  |
| EVAL-P8-006 | gate | public build check | PASS | `npm run build:public` and `scripts/check-public-build.mjs` (no `dist/assets/private`, no identity-regex match in any bundle, every manifest atlas present, `mechanics_lab` unreachable), negative-tested with a planted private dir and name; `base: ./`; light gates on 921244f -> `# pass 790`, build green | 3de551f |
| EVAL-P8-007 | gate | deploy workflow, verify:public, itch zip | PENDING | `.github/workflows/deploy.yml` on tag `v*` (never triggered), `npm run package:itch` -> `output/release/omega-relay-0.5.0.zip` (351 files), `npm run verify:public` 71 of 72 with `58-glacier-route` failing alone (13b.4, EVAL-P13-005); left: that flake, then verify:public green |  |
| EVAL-P8-008 | gate | full campaign smoke 47, both variants | PENDING | | |
| EVAL-P8-009 | review | Craig's playtest sheet | PENDING | | |
| EVAL-P8-010 | gate | live URL after the tag | PENDING | | |
| EVAL-P8-011 | gate | perf budget scenario 51 on WebGL at scale 4 with a committed baseline | PASS | `window.perfDebug()` (`src/perf/frameStats.ts`), smoke `62-perf-budget` (51 was taken) on WebGL, the sweep snapshot per mission, `tests/perf-baseline.json` from a real run (p95 3.3 ms, p99 5.3 ms, textures 8.6 MB, Preload about 700 ms); render scale already capped at 6; smoke 62 and 63 pass (lane run `2026-09-30T16-59-58-091Z`) | 3de551f |

## Prompt 09: Footprint and performance

Complete; rows moved verbatim to `docs/prompts/archive/EVAL_LEDGER-09.md` on 2026-09-24.

## Prompt 10: The agent system

PASS rows P10-001 to P10-008 are in `docs/prompts/archive/EVAL_LEDGER-10.md`.

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P10-009 | review | (10b) retro at each prompt exit proposes at most one rule change as a DECISIONS row | PENDING | `npm run agents:retro -- --prompt 10` -> `output/retro/10.md: 9 ledger rows, 3 score rows, 2 decisions, 3 progress entries`; the first docs-steward retro proposal runs at 05's exit (with P11-008) | |

## Prompt 11: Token efficiency

Rows P11-001 to P11-008 (005, 007 and 008 PENDING; outside prompt 12's exit gate) are in `docs/prompts/archive/EVAL_LEDGER-11.md`.

## Prompt 12: Finish the game

PASS rows P12-001, P12-002, P12-003, P12-004 are in `docs/prompts/archive/EVAL_LEDGER-pass-07-08-12.md`.

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P12-005 | audit | the JS budget holds the finish features: `jsGzipKB` 510 -> 520 -> 545 (a raise needs this row) | PENDING | wave 4 (boss bodies, twelve spawners, pad and remap) measured 514.5 KB after the dialogue left the bundle (e71e3ec, -10 KB); the enemy catalog and manifest notes followed (-2.2 KB), leaving 512.3 KB; the rest is new code, so 520 (+2%) until part 12d loads stage data per stage, then the ceiling comes back down; `footprint: 22/22 within budget, 0 page errors` on 9dde2e9, `static.jsGzipKB 512.6 / 520` (`output/evidence/12-wave4/footprint-9dde2e9.json`); then the seven rebuilt stages carried it to 525.3 KB on 0ed1739 (Transit Security; about 3 KB of route data per stage, Weather and the Central Core still to come): 545 for now, and part 12i moves each stage's route data out of the bundle to load with its stage (as the dialogue and enemy catalog do), then lowers the ceiling; PASS when footprint is 22/22 on the verified head |  |

## Prompt 13: Polish from the playtest (D-023)

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P13-001 | audit | 13a: each playtest note reproduced or traced to file:line (`output/notes/13a/`) | PASS | four investigations on 102b003, each reproduced or traced to file:line: `output/notes/13a/13a-music-backdrop.md`, `13a-combat.md`, `13a-pickups-beats.md`, `13a-art-audit.md`; probes and captures in `output/probes/13a/` | 102b003 |
| EVAL-P13-002 | gate | first-level music plays on the production build, intro on and off | PENDING | | |
| EVAL-P13-003 | gate | no void at the top of any vertical segment; backdrop cover test | PENDING | | |
| EVAL-P13-004 | gate | the shot contract; smoke 65 | PENDING | | |
| EVAL-P13-005 | gate | 58-glacier-route passes five runs in a row | PENDING | | |
| EVAL-P13-006 | gate + review | Rook tuned: 30 to 40 s to kill; Craig plays | PENDING | | |
| EVAL-P13-007 | gate | weapon energy and range per the table | PENDING | | |
| EVAL-P13-008 | gate + review | a charged form per weapon with its art | PENDING | | |
| EVAL-P13-009 | gate + review | pickup art v2 from Higgsfield, credited | PENDING | | |
| EVAL-P13-010 | gate | pickups grounded or marked float; lint rule; PickupSystem | PENDING | | |
| EVAL-P13-011 | review | blind art review of the new art and top-of-segment captures | PENDING | | |
| EVAL-P13-012 | gate + review | boss intro on entering a stage | PENDING | | |
| EVAL-P13-013 | gate + review | weapon demo after the WEAPON GET card | PENDING | | |
| EVAL-P13-014 | gate + review | return lines after every warden clear | PENDING | | |
