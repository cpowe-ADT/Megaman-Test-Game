# 06. Levels, Mechanics, and Enemies

Active seats: Orchestrator, Level Designer (route owner), Principal Game Engineer, Art Director (tiles, backgrounds, enemies), Game Director (mechanic feel), QA / Eval Lead.

Six to eight sessions: `06a` (6.1), `06b` (6.2 and 6.3), `06c` (6.4 art), `06d` (6.5 pilot), `06e` and `06f` (6.6 batches), `06g` (6.7 Omega), `06h` (6.8 and 6.9).

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 06a | 6.1 Level format v2, pits, walls, vertical, compiler, parity, audit, lint, sweep v2 | Engineer | none yet (parity) | P6-001, P6-002, P6-003 | accept parity |
| 06b | 6.2 Mechanics library | Engineer, Director | twelve mechanics in a lab stage | P6-004 | approve the lab |
| 06b | 6.3 Mini-bosses and enemy behaviour | Engineer | four mini-boss archetypes; enemies that charge, beam, respawn, patrol ledges | P6-005, P6-006 | approve |
| 06c | 6.4 Biome tilesets, backgrounds, enemy re-skins (Higgsfield) | Art | nine biomes dressed; enemies original | P6-007, P6-008 | approve two biomes and four enemies |
| 06d | 6.5 Pilot stage: Pyro Maw | Designer | one full stage | P6-009 | play Pyro Maw |
| 06e, 06f | 6.6 Seven wardens and the tutorial | Designer | the campaign | P6-010 | play each batch |
| 06g | 6.7 Omega Fortress in three acts | Designer | the ending | P6-011 | play Omega |
| 06h | 6.8 Difficulty and death economy; 6.9 Automation | Director, QA | none | P6-012, P6-013 | proceed |

## Entry conditions

- Charter and amendments. `docs/prompts/handoff/05-feel-hero-and-camera.md` is `COMPLETE`; every `EVAL-P5-*` row `PASS`. `PLAN_v2.md` read.
- Read: the 05 handoff (movement constants and the camera vertical-follow API are the physical truth every level is built against), `docs/prompts/02-levels-and-gameplay.md` in full (its route budget, `LevelV2` schema, mechanics table, mini-boss archetypes, difficulty and automation sections are reused verbatim below unless amended), `docs/design/stage-briefs.md`, `docs/story/story-bible.md`, `docs/working/enemy-ecology-and-variant-plan.md`, `src/content/campaign.ts`, `src/content/stageArenaLayout.ts`, `src/physics/PlatformCollisionSystem.ts`, `src/enemy/` in full, `src/progression/catalog.ts`, `src/content/stageBackgroundCatalog.ts`, `src/ui/gameplay/GameplayTextures.ts`, `scripts/mission-visual-sweep.mjs`, `docs/content/sprite-imagegen.md`.
- Ground truth (2026-09-22 audit): stages are TypeScript literals in `campaign.ts` (`CAMPAIGN_STAGES` then `STAGE_EXTENSION_PATCHES`, then a loop that bolts on the boss room); the route is 640px tutorial, 928px wardens, 1088px Omega (1.4 to 2.4 screens); one ground rectangle spans the world so no pit is possible and `allowFallOff` is dead; hazards are `{id,x,y}` at y=230 with the texture chosen by whether the id contains `lava`; platforms are 8px rectangles with an x-only tween the player does not ride; the only walls are the world edges; checkpoints are 150 to 250px apart; `radioSequenceId` is never set; no mini-boss, no secret, no mechanic, no `src/content/levels/`, no `src/mechanics/`; pickups float at y 128 to 144 from checkpoint offsets. Enemies: twelve CC0-sliced families with one 18-frame animation template, `charge` and `beam` fall through to melee, spawn triggers 56 to 180px ahead so enemies pop in on screen, retired markers never respawn, `EnemyMotor.atLedge` tests screen width. The sweep captures start, mid, pre-boss and boss room only.

## Outcome of this prompt

Ten stages that are levels: ten to fourteen screens each, pits, walls to kick off, at least one vertical or walled segment, two biome mechanics, a mini-boss behind a locked gate, two gated secrets, eighteen or more enemy placements of five or more families that behave as their catalog says, a boss room that fits the fight. Every biome has original tiles and backgrounds and re-skinned enemies. Omega Fortress is three acts. Difficulty and death economy are tuned. The content audit, the reachability lint and the sweep keep it true.

## Phase 6.1: Level format v2, pits, walls, vertical, compiler, parity, audit, lint, sweep v2

Engineer leads. Implement prompt 02 section "Phase 2.1" verbatim, with these amendments:

- **Break the floor first.** `GroundRun[]` per segment replaces the single ground rectangle in `Game.buildStage`; gaps are pits; the kill plane below the lowest run is real; `allowFallOff` means what it says. Pure test: a layout with a gap yields two solid bodies; smoke: falling into a pit kills and respawns at the checkpoint.
- **Walls.** `WallDef { x, y, height }` are solid vertical faces in `PlatformCollisionSystem`; the motor's wall slide and kick (tuned in 05) use them. Smoke: wall-kick up a two-wall shaft to a platform above the first screen.
- **Vertical.** `verticalScreens > 1` gives the segment a taller world and the camera the y-follow from 05. Sweep state shows `scrollY > 0` inside it.
- **Carry.** Grounded actors inherit a moving platform's per-frame delta (x and y).
- **Hazards are typed and timed** (`spikes | vent | acid | rail | icicle | rockfall` with `{ onMs, offMs, phaseMs }`); the id-string texture switch goes.
- **Camera-relative spawn and respawn** for enemies: a marker spawns when the camera edge is within one screen, respawns when the camera leaves its window by a screen and re-enters (`persistent: false` opts out), mini-boss and `room_lock` waves never respawn once cleared, death resets every marker except cleared locks. `tests/enemy-spawner-respawn.test.ts`; sweep asserts no enemy is inside the camera on its spawn frame.
- **Parity** against today's ten stages exactly as 02 describes (snapshot first). The audit runs `--report-only`; every current stage fails every floor, which is expected and is the baseline the ledger records.

Ledger: `EVAL-P6-001` (parity), `EVAL-P6-002` (audit table for all ten, report-only), `EVAL-P6-003` (lint green on parity stages; walls, pits and vertical smoke scenarios).

```
### STOP 6.1: Format and parity
Show: the parity test line, the audit table, the pit and wall-kick captures, one contact sheet.
Question for Craig: proceed with placeholder tiles until 6.4? Recommended: yes.
```

## Phase 6.2: Mechanics library

Implement prompt 02 "Phase 2.2" verbatim (the twelve-row table, pure modules under `src/mechanics/`, the `mechanics_lab` stage, smoke `39-mechanics-matrix` renumbered to `42-mechanics-matrix` because 39 to 41 exist). Add: `ice_floor` and `conveyor` interact with the 05 dash carry (dash on ice is +40% distance; a conveyor adds its velocity to a dash-jump). Every mechanic has a readable tell now, not only in 08: arming flash, shake, arrows, streaks, bubbles, surface line, crack stages.

Ledger: `EVAL-P6-004`.

## Phase 6.3: Mini-bosses and enemy behaviour

Implement prompt 02 "Phase 2.3" verbatim (four archetypes on the boss framework with `role: 'miniboss'`, smoke `43-miniboss-encounter`). The mini-boss body uses the grounding contract from `docs/architecture/boss-framework.md`. Wire `miniboss_callout` (eight authored lines in `dialogue.v2.json`, never played today) to the gate lock through the ticker.

Enemy behaviour, all in `src/enemy/`: `charge` consumes `chargeSpeed` (armored_bot, bouncer), `beam` is a timed line hitbox with a 400ms telegraph (laser_eye), `EnemyMotor.atLedge` probes the floor so walkers live on platforms and beside pits, `shield_drone` has a shield arc that blocks front shots, and the animation manifest is per family (hover, spawn, turn, stunned, explode keys point at frames that exist or are dropped). Tests in `tests/enemy-*.test.ts`; a sweep assertion that an armored_bot leaves its spawn during a charge.

Ledger: `EVAL-P6-005` (mini-bosses), `EVAL-P6-006` (enemy behaviour tests and captures).

```
### STOP 6.3: Lab and mini-bosses
Show: the mechanics lab contact sheet, one capture per mini-boss archetype, the enemy behaviour captures.
Question for Craig: approve? Recommended: yes.
```

## Phase 6.4: Biome tilesets, backgrounds, and enemy re-skins (Higgsfield)

Art leads. Implement prompt 03 "Phase 3.2" (tilesets and backgrounds) with the generation path replaced: Higgsfield `gpt_image_2`, the runbook in `docs/content/sprite-imagegen.md` section 2, prompts and job ids recorded per sheet.

- **Tiles.** One 16px tileset per biome (nine) as a labelled grid sheet: ground top/body/bottom/caps/inner corners, wall face, one-way platform (3), crumble (3 stages), conveyor strip (4 frames), rail on/off, the biome's hazard strip, gate (closed, 3 opening, open), breakable wall (3 crack stages), 3 to 5 decor props. `hf_sheet_to_atlas.py --category tiles --cell 16` with a named-cell map; `TileSkin` autotiles ground runs, walls and platforms (3x3 rule); the procedural skin stays as the fallback and counts as a placeholder.
- **Backgrounds.** Three-layer parallax per biome at 448x194 (`far`, `mid`, `near`) generated from the style words of `docs/art/style-sheet.md` (write it first, one page: palette per biome, silhouette words, what the HUD band means for sprite height); Pyro stops being a green city. CC packs retire; credits regenerate.
- **Enemies.** Twelve families as 4x3 sheets (idle 4, move 4, attack 4, plus a second sheet for hurt 2 and death 4 where the family dies on screen) on `#FF00FF`, one biome variant per family where the ecology plan calls for it, cut at 32px (48px for armored_bot and fly_trap). The CC0 slices retire. Every enemy family passes the frame audit from 05.
- **Style sheet** also fixes the boss silhouettes already generated (Rook square, Pyro maw, Tide crescent, Volt bolt, Basalt slab, Ferro blade, Mire drip, Gale wing, Glacier shard, Omega ring) so new art matches them.

Ledger: `EVAL-P6-007` (nine tilesets and backgrounds in the manifest; `sprites:validate` counts zero placeholder skins), `EVAL-P6-008` (twelve enemy families original; attribution file has no CC0 enemy entries; frame audit green).

```
### STOP 6.4: Two biomes and four enemies
Show: Pyro and Glacier dressed (segment captures), the tile sheets, four enemy contact sheets.
Question for Craig: approve the look? Recommended: approve; regenerate only what he names.
```

## Phase 6.5: Pilot stage, Pyro Maw

Designer leads. Implement prompt 02 "Phase 2.4" verbatim against the route budget (12 screens, 4 checkpoints, mini-boss `custodian_walker`, two gated secrets, `lane_vents` and `crumble_group` mechanics, one vertical segment of 2 screens, 18+ placements of 5+ families, 8+ hazards, 3+ pits, the `pillars` boss room). Checkpoint 2 carries the radio sequence id. The audit flips to enforcing for `pyro_maw` only.

Ledger: `EVAL-P6-009`.

```
### STOP 6.5: Play Pyro Maw
Show: the stage contact sheet, the audit row, the lint result, the first-clear time from an automated run.
Ask Craig to play it. Question: length, fairness, secrets findable, mini-boss readable? Recommended: fix his notes, then batch.
```

## Phase 6.6: The other seven wardens and the tutorial

Implement prompt 02 "Phase 2.5" verbatim (batches of two; each batch STOP shows contact sheets, audit rows and clear times; Craig plays one stage per batch). Tutorial: six screens, the wall-kick teach uses a real two-wall shaft, one secret. The audit becomes enforcing per stage as it lands.

Ledger: `EVAL-P6-010` (all nine non-Omega stages pass the audit and lint).

## Phase 6.7: Omega Fortress in three acts

Implement prompt 02 "Phase 2.6" verbatim: Act 1 Relay Spire (10 screens, remix of four mechanics, two vertical segments), Act 2 Warden Archive (hub plus eight rematch arenas, a checkpoint after every two), Act 3 the Core (4 screens, the `omega_core` room at `height_anchors`). The three-act structure in the story bible finally exists in `campaign.ts`.

Ledger: `EVAL-P6-011`.

```
### STOP 6.7: Omega
Show: three contact sheets, the audit rows, an automated full-fortress clear time.
Ask Craig to play Act 1 and Act 3. Recommended: fix his notes.
```

## Phase 6.8: Difficulty and death economy

Implement prompt 02 "Phase 2.7" verbatim (Assist, Normal, Veteran; enemy HP and damage tables; checkpoint rules per difficulty; the death-feel items not already done in 05).

Ledger: `EVAL-P6-012`.

## Phase 6.9: Automation that keeps this true

Implement prompt 02 "Phase 2.8" verbatim: per-segment sweep captures with assertions (every segment reachable by warp, every enemy spawns off screen, every hazard exposed at least once, every checkpoint radio fires once), `content:audit` and `content:lint` in `npm run verify`, the level contact sheets under `output/level-review/`.

Ledger: `EVAL-P6-013`.

## Exit Gate

- `EVAL-P6-001` to `EVAL-P6-013` `PASS`.
- `npm run verify` (now including `content:audit` and `content:lint`), `npm run test:visual-sweep` green on the exit commit.
- `git grep -l "opengameart\|kenney" assets/sprites/source/free-source-attribution.v1.json` shows only effects entries (or none).
- `wc -l src/scenes/Game.ts` at or below 3,400; stage building lives in `src/content/levels/` and `src/scenes/game/StageBuilder.ts`.
- Handoff with `Inputs for prompt 07`: per-stage boss room kinds and hazards, mini-boss ids, the enemy families per biome, the tile and background keys.

```
### STOP 6.EXIT
Show: the handoff, the ledger, the ten level contact sheets.
Question for Craig: start 07? Recommended: yes.
```
