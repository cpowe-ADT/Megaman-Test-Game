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
- Read: the 05 handoff (movement constants and the camera vertical-follow API are the physical truth every level is built against), the sections of `docs/prompts/02-levels-and-gameplay.md` each phase cites (they are reused verbatim unless amended; `npm run agents:context -- --part <part>` includes them with 02's route budget, so do not read 02 in full), `docs/design/stage-briefs.md`, `docs/story/story-bible.md`, `docs/working/enemy-ecology-and-variant-plan.md`, `src/content/campaign.ts`, `src/content/stageArenaLayout.ts`, `src/physics/PlatformCollisionSystem.ts`, `src/enemy/` in full, `src/progression/catalog.ts`, `src/content/stageBackgroundCatalog.ts`, `src/ui/gameplay/GameplayTextures.ts`, `scripts/mission-visual-sweep.mjs`, `docs/content/sprite-imagegen.md`.
- Ground truth (2026-09-22 audit): stages are TypeScript literals in `campaign.ts` (`CAMPAIGN_STAGES` then `STAGE_EXTENSION_PATCHES`, then a loop that bolts on the boss room); the route is 640px tutorial, 928px wardens, 1088px Omega (1.4 to 2.4 screens); one ground rectangle spans the world so no pit is possible and `allowFallOff` is dead; hazards are `{id,x,y}` at y=230 with the texture chosen by whether the id contains `lava`; platforms are 8px rectangles with an x-only tween the player does not ride; the only walls are the world edges; checkpoints are 150 to 250px apart; `radioSequenceId` is never set; no mini-boss, no secret, no mechanic, no `src/content/levels/`, no `src/mechanics/`; pickups float at y 128 to 144 from checkpoint offsets. Enemies: twelve CC0-sliced families with one 18-frame animation template, `charge` and `beam` fall through to melee, spawn triggers 56 to 180px ahead so enemies pop in on screen, retired markers never respawn, `EnemyMotor.atLedge` tests screen width. The sweep captures start, mid, pre-boss and boss room only.

## Outcome of this prompt

Ten stages that are levels: ten to fourteen screens each, pits, walls to kick off, at least one vertical or walled segment, two biome mechanics, a mini-boss behind a locked gate, two gated secrets, eighteen or more enemy placements of five or more families that behave as their catalog says, a boss room that fits the fight. Every biome has original tiles and backgrounds and re-skinned enemies. Omega Fortress is three acts. Difficulty and death economy are tuned. The content audit, the reachability lint and the sweep keep it true.

## Additions from the 2026-09-24 overhaul audit (Craig: "better enemies, bosses, graphics, ledges, background ... hit boxes ... animations ... have agents work on each")

Four blind seats (art, director, level, code review) read the sweep and the code: `output/notes/05c-overhaul-audit.md`; findings kept in `docs/prompts/reviews/2026-09-24-overhaul-audit/`. Art, level and director found the plan already covers ledges, backgrounds, tiles, enemy re-skins and behaviour; what it lacked:

- **6.0 adds the hit contract (EVAL-P6-015).** One `resolveHurtbox(entity)` read by the sword, shots and the debug overlay (today the sword uses the drawn frame, `Game.ts:1960`, shots the body, `EnemyMotor.ts:88`, and the catalog hurtbox is never read); enemy melee tests against the player body profile, not `getBounds()` (`EnemyCombat.ts:163`), with `tests/enemy-melee-hitbox.test.ts`; `installEntityPlatformCollisions` made idempotent (called at four sites, `PlatformCollisionSystem.attachActor` never detaches); dead `applySaberDamage` deleted; the overlap wiring moves to `src/scenes/game/HitWires.ts` here, not in 7.0. EVAL-P6-014's target drops to 2,700 lines.
- **6.1 hazards carry their own box and damage** (every hazard is 28x10 for 1 today, `Game.ts:1401`).
- **6.3 regular enemies get a hurt tell:** a short white flash and a stagger on damage, as 7.2 gives bosses.
- **6.4 regenerates the eight warden base sheets (EVAL-P6-016)** (idle, move, attack, hurt, death) through the same Higgsfield pipeline, before 7.2's STOP, so telegraphs are not judged on blob art (Pyro in `27-boss-sword-hit/shot-1.png`); the 6.4 STOP shows a grounding capture (feet on the floor line) for every regenerated boss. Backgrounds first (they fill the frame), then enemies, then tiles; 6.1 geometry lands before 6.4 tiles.
- **6.9 automation reports every hurtbox and hitbox** in `render_game_to_text` and lints boxes that are empty or outside the idle frame's opaque pixels (rule 9: `scripts/` and `TESTING.md` in the same commit).
- **Lanes.** The orchestrator runs three lanes at once where files do not overlap: engineer (6.0, 6.1, hit contract), art (Higgsfield sheets: writes only `assets/` and the manifests), level (after 6.1). One writer per file set; each lane gets a task card and a packet.
- **Carried from 05b:** the tutorial's enemy roster, the secret behind the saber wall and the crumble group (`docs/design/stage-briefs.md`); rename the smoke 49 capture `shot-wall-kick.png` (it shows the charge hint); coach lines carry ordinals in prose, so reordering locks means editing text. The lane box over the hero was fixed in 5.8 (EVAL-P5-011).

## Phase 6.0: Extract before building (added on final review)

Half a session. Move stage building, camera bounds, the boss gate barrier, platform colliders and backgrounds (about 340 lines) into `src/scenes/game/StageBuilder.ts`, and progression pickups, checkpoints, consumables, enemy drops and restores (about 480 lines) into `src/scenes/game/PickupSystem.ts`, with the enemy framework init into `src/scenes/game/EnemyRuntime.ts`. `create()` shrinks by their wiring. Without this the 3,400 ceiling is not reachable, because everything 6.1 adds lands in these blocks. Ledger: `EVAL-P6-014` (`Game.ts` at or below 3,000 after this phase; full smoke green).

## Phase 6.1: Level format v2, pits, walls, vertical, compiler, parity, audit, lint, sweep v2

Engineer leads. Implement prompt 02 section "Phase 2.1" verbatim, with these amendments:

- **Break the floor first.** `GroundRun[]` per segment replaces the single ground rectangle in `Game.buildStage`; gaps are pits; the kill plane below the lowest run is real; `allowFallOff` means what it says. Pure test: a layout with a gap yields two solid bodies; smoke: falling into a pit kills and respawns at the checkpoint.
- **Walls.** `WallDef { x, y, height }` are solid vertical faces in `PlatformCollisionSystem`; the motor's wall slide and kick (tuned in 05) use them. Smoke: wall-kick up a two-wall shaft to a platform above the first screen.
- **Vertical.** `verticalScreens > 1` gives the segment a taller world and the camera the y-follow from 05. Sweep state shows `scrollY > 0` inside it.
- **Carry.** Grounded actors inherit a moving platform's per-frame delta (x and y).
- **Hazards are typed and timed** (`spikes | vent | acid | rail | icicle | rockfall` with `{ onMs, offMs, phaseMs }`); the id-string texture switch goes.
- **Camera-relative spawn and respawn** for enemies: a marker spawns when the camera edge is within one screen, respawns when the camera leaves its window by a screen and re-enters (`persistent: false` opts out), mini-boss and `room_lock` waves never respawn once cleared, death resets every marker except cleared locks. `tests/enemy-spawner-respawn.test.ts`; sweep asserts no enemy is inside the camera on its spawn frame.
- **Boss room variants** (added on review): `flat | pillars | pits | rails | shaft`. `shaft` is a two-screen-tall room with wall faces on both sides and no floor platforms except the entry ledge: the wall-jumping boss level Craig asked for. Gale Vixen's room is a `shaft` (wind zones push the player off the walls; the fight is in 07). The camera lock uses the vertical bounds from 05.
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
- **Mini-bosses** (added on review): four archetype sheets (`custodian_walker`, `relay_turret_nest`, `drill_serpent`, `sentry_twins`) at 64px through Higgsfield with the style sheet, plus one palette variant per skin the briefs name; cut like bosses (idle, move, attack) and grounded by the same contract. The tinted-boss stand-in from 6.3 retires here.
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

Balance from data, not taste (added on review): `stageDebug.telemetry()` accumulates per-segment deaths, damage taken, time, and which enemy or hazard killed, for automated runs and for Craig's play (written to `output/telemetry/<profile>-<stage>-<date>.json` through the export path from 05.6). `scripts/content/heatmap.mjs` paints deaths over each stage contact sheet into `output/level-review/<stageId>-heat.png`. The difficulty STOP shows the heatmaps from an automated Normal run and from Craig's session; any segment over three deaths per run on Normal is retuned or its tell strengthened.

Ledger: `EVAL-P6-012`.

## Phase 6.9: Automation that keeps this true

Smoke tiers (added on review): the suite is over fifty scenarios and will pass eighty. `SMOKE_TIER=fast` (about twenty scenarios, under three minutes: boot, input, one stage, one boss, profiles, HD render) runs in `npm run verify` and on every pull request in `.github/workflows/ci.yml`; `full` plus the sweep run nightly on a schedule and on `v*` tags, uploading `output/`. Today the browser gates run nowhere automatically. `TESTING.md` lists the tiers.

Implement prompt 02 "Phase 2.8" verbatim: per-segment sweep captures with assertions (every segment reachable by warp, every enemy spawns off screen, every hazard exposed at least once, every checkpoint radio fires once), `content:audit` and `content:lint` in `npm run verify`, the level contact sheets under `output/level-review/`.

Ledger: `EVAL-P6-013`.

## Panel conditions (2026-09-22, delegated decisions)

From the level-designer panel on the briefs (`D-001`, `docs/design/stage-briefs.md` answers the three open questions):
- Before 06e, 6.2 gives `rising_liquid` a cycle and direction and `wind_zone` a vertical axis, each lab-tested, or the Tide and Ferro briefs drop those mechanics.
- Gale's boss room is `shaft` (briefs corrected). In 6.5, `lane_vents` means the library's timed `vent`. Add a Ferro row (quench nozzle variant of `enemy_frost_turret`) to `docs/working/enemy-ecology-and-variant-plan.md` before 6.4 generates re-skins.
- Lint every master segment with base movement and no capsule (stages play in any order).
From the art-director panel (`D-002`): 6.4's backgrounds give Gale Vixen and Glacier Ronin enough contrast against sky and snow; check it in the boss-room sweep captures.

## Exit Gate

- `EVAL-P6-001` to `EVAL-P6-014` `PASS`.
- `npm run verify` (now including `content:audit` and `content:lint`), `npm run test:visual-sweep` green on the exit commit.
- `git grep -l "opengameart\|kenney" assets/sprites/source/free-source-attribution.v1.json` shows only effects entries (or none).
- `wc -l src/scenes/Game.ts` at or below 3,000 (6.0 extracts about 800 lines; content lands in `src/content/levels/`, `src/scenes/game/StageBuilder.ts` and `PickupSystem.ts`, not in `Game.ts`).
- Handoff with `Inputs for prompt 07`: per-stage boss room kinds and hazards, mini-boss ids, the enemy families per biome, the tile and background keys.

```
### STOP 6.EXIT
Show: the handoff, the ledger, the ten level contact sheets.
Question for Craig: start 07? Recommended: yes.
```
