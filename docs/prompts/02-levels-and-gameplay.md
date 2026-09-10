# 02. Levels and Gameplay Depth

Active seats: Orchestrator, Principal Game Engineer, Level Designer, Game Director, QA / Eval Lead. Narrative reviews radio placement only.

This prompt is five to seven sessions. Run it as `02a` (2.1 to 2.3), `02b` (2.4 and the first two batches of 2.5), `02c` (the last two batches of 2.5 and 2.6), `02d` (2.7 and 2.8). Each part re-reads the ledger on start.

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 02a | 2.1 Level format v2, compiler, tile skin, audit, lint, sweep v2 | Engineer | same stages, tiled ground, nothing else visible | P2-001, P2-002, P2-003a | accept placeholder palettes for the duration of 02 |
| 02a | 2.2 Mechanics library | Engineer | a dev lab stage with every mechanic | P2-004 | proceed |
| 02a | 2.3 Mini-boss system | Engineer | a locked room with a mini-boss | P2-005 | proceed |
| 02b | 2.4 Pilot: Pyro Maw | Level Designer | a full stage | P2-009 | play it and answer five questions |
| 02b, 02c | 2.5 Seven wardens and the tutorial | Level Designer | the campaign | P2-003b, P2-006, P2-010a to d | approve each batch's contact sheets |
| 02c | 2.6 Omega Fortress in three acts | Level Designer | the finale | P2-007 | approve the act map |
| 02d | 2.7 Difficulty and death feel | Director | Assist / Normal / Veteran | P2-008 | approve the multipliers |
| 02d | 2.8 Automation | QA | none | P2-011 | proceed to exit |

## Entry conditions

- Charter pasted. `docs/prompts/handoff/01-foundation-and-story.md` exists with `Status: COMPLETE` and every `EVAL-P1-*` row is `PASS` (or the allowed `PENDING`). If not, print what is missing and stop.
- Read: the handoff, `docs/design/stage-briefs.md`, `docs/story/script.md` (radio and mini-boss lines), `src/content/campaign.ts` in full, `src/content/stageArenaLayout.ts`, `src/physics/PlatformCollisionSystem.ts`, `src/enemy/EnemySpawner.ts`, `src/enemy/types.ts`, `src/bosses/BossController.ts`, `src/bosses/bossCombatProfiles.ts` (one boss fully), `src/player/PlayerMotor.ts`, `src/player/config.ts`, `src/player/PlayerBodyProfiles.ts`, `src/progression/catalog.ts`, `scripts/mission-visual-sweep.mjs` in full, `src/scenes/Game.ts:451` (camera bounds), `docs/working/full-game-sprint-plan.md` (feel table).
- Run `npm run test` and `npm run build` and paste the result lines before changing anything.

## Outcome of this prompt

Every stage becomes a real level: at least ten screens (target twelve to fourteen) of authored route with a teach-escalate-master rhythm, two biome mechanics, a mini-boss, four checkpoints, two secrets, at least one vertical or walled segment, and enemy encounters composed for the camera. The tutorial teaches the full move set in order. Omega Fortress becomes a three-act finale with a fair rematch gauntlet. Difficulty exists. The audit, lint and sweep prove all of it, and Craig has played the pilot stage.

Art stays placeholder in this prompt. Do not spend time on beauty; spend it on rhythm, readability and fairness.

## Route budget

| Metric | Tutorial | Warden stage | Omega Fortress |
| --- | --- | --- | --- |
| Screens of route before the boss room (448px each); `midboss` and `secret` rooms count | 6 | floor 10, target 12 to 14 | Act 1: 10; Act 2: hub plus 8 rematch arenas; Act 3: 4 |
| Checkpoints including start | 2 | 4 | 1 per act plus 1 after every 2 rematches |
| Mini-boss | 0 | 1 | 0 (the gauntlet is the mini-boss) |
| Secrets (`heart_tank` and `sub_tank` locations behind a gate) | 1 | 2 | 0 |
| Distinct biome mechanics | 0 | 2 or more | remix of at least 4 |
| Vertical (`verticalScreens > 1`) or walled segments | 1 (wall-jump teach) | 1 or more | 2 |
| Enemy placements / distinct types | 8 / 3 | 18 or more / 5 or more | 30 / 8 |
| Hazards | 3 | 8 or more | 12 |
| Pits (only where the brief allows falling) | 0 | 3 or more | 4 |
| Moving or carried platforms | 1 | 2 or more where the biome fits | 4 |
| Obstacle density (route length covered by hazards, enemies, platforms, mechanics) | | 60% or more, else the audit warns | |
| Target first-clear time on Normal | 3 min | 5 to 7 min | 15 min (Act 2 at most 12) |

These are floors. `npm run content:audit` (built in 2.1) fails any stage below a floor and warns below the density target. The floors live in `src/content/levels/routeBudget.ts`.

## Phase 2.1: Level format v2, compiler, placeholder tile skin, audit, lint, sweep v2

Engineer leads. This phase changes no stage content; it re-expresses the existing stages in the new format and proves parity.

**Format.** `src/content/levels/types.ts`:

```
LevelV2 { schemaVersion: '2', stageId, biome, tileSkin, segments: LevelSegment[],
  bossRoom: { variant: 'flat' | 'pillars' | 'pits' | 'rails', hazards?: HazardDef[] } }
LevelSegment { id, kind: 'intro' | 'teach' | 'escalate' | 'secret' | 'midboss' | 'master' | 'preboss',
  screens: number,
  verticalScreens?: number     // 1 by default; >1 enables camera Y follow inside this segment's bounds
  ground: GroundRun[]          // { x, width, y? } within the segment; gaps between runs are pits
  walls?: WallDef[]            // { x, y, height } solid vertical faces for wall jumps and pillars
  platforms: PlatformDef[]     // StagePlatformDefinition plus kinds 'crumble' | 'conveyor' | 'carry'
  hazards: HazardDef[]         // spikes | vent | acid | rail | icicle | rockfall, optional timing { onMs, offMs, phaseMs }
  mechanics: MechanicDef[]     // wind_zone | current_zone | rising_liquid | timed_rail_group | crumble_group | room_lock | breakable_wall | ice_floor
  enemies: EnemyLevelMarker[]  // x relative to the segment origin; typeKey carries the enemy_ prefix
  checkpoint?: { id, x, radioSequenceId? }
  pickups?: PickupDef[]        // { category, x, y, gate?: 'weapon:<id>' | 'dash_jump' | 'wall_jump' | 'breakable_wall' }
  minibossId?: MinibossArchetypeId
}
```

**Camera and walls.** `Game.ts:451` camera bounds become per-segment (x range from the compiled segment, y range from `verticalScreens`). `PlatformCollisionSystem` treats walls as solid faces the motor's wall-slide and wall-jump code already understands. Pure tests for both.

**Compiler.** `src/content/levels/compileLevel.ts`: `compileLevelV2(level) -> { arena, enemyMarkers, retention }` producing absolute coordinates in the shapes `campaign.ts` already consumes (`StageArenaDefinition`, `EnemyLevelMarker[]`, boss room through `buildDefaultBossRoom`). `campaign.ts` keeps exporting `CAMPAIGN_STAGES`, now built from `src/content/levels/<stageId>.level.ts` (TypeScript objects so ids type-check; a JSON export exists for the audit). `getStageContentRetentionReport` gains `screens`, `segments`, `mechanics`, `secrets`, `miniboss`, `pits`, `movingPlatforms`, `verticalSegments`, `density`; the sweep summary prints them.

**Pickup locations.** `src/progression/catalog.ts` currently invents pickup coordinates from checkpoint offsets. Replace with the compiled `pickups` positions so secrets are where the level designer put them. Location ids stay stable.

**Enemy respawn rule.** A marker respawns when the camera leaves its spawn window by one screen and re-enters, unless `persistent: false`; mini-bosses and `room_lock` waves never respawn once cleared; player death resets every marker except cleared locks. `tests/enemy-spawner-respawn.test.ts`.

**Parity.** Express all ten current stages 1:1 in v2. `tests/level-compile-parity.test.ts` asserts the compiled arena, markers, boss room and retention report equal the pre-refactor values (snapshot them before you start). Run the sweep and diff the retention numbers against the baseline run.

**Placeholder tile skin.** `src/ui/gameplay/TileSkin.ts` paints ground runs, walls and platforms from a procedural 16px tile texture per biome (top edge, body, caps, one-way lip, wall face), generated at runtime like `PickupTextures.ts`; it replaces the flat bars in `Game.buildStage` behind one call; palettes in `src/content/levels/biomes.ts`.

**Content audit.** `scripts/content/audit-levels.mjs`, `npm run content:audit`: a table per stage against the route budget, non-zero exit below any floor, a warning below the density target, and `route px / runSpeed` printed so padding is visible. Runs `--report-only` until 2.5 flips it to enforcing.

**Reachability lint.** `npm run content:lint`: for every consecutive pair of standable surfaces along the route, the horizontal gap is at most the dash-jump distance and the rise at most the jump, wall-jump or wall-pair reach, all derived from `PLAYER_GAMEPLAY_CONFIG` in `src/content/levels/reach.ts` and unit-tested against the motor simulation in `tests/player-motor.test.ts`. Gated secrets are checked against their gate. Pits wider than the dash-jump distance fail.

**Sweep v2 (needed by 2.4, so it lives here).** `stageDebug.warpTo(x)` generalizes the existing `crossBossGate()` (keep the old name as an alias). The sweep captures every segment (`segment-<id>.png`, `state-<id>.json`) by warping to the segment start and stepping 30 frames. `SWEEP_ONLY=<stageId>` filters missions. `scripts/content/contact-sheet.mjs` stitches a stage's segment captures into `output/level-review/<stageId>.png`. Assertions arrive in 2.8.

**Dev lab.** `src/content/levels/dev/mechanics_lab.level.ts`, loaded only with `?stage=mechanics_lab&automation=1`, excluded from `CAMPAIGN_STAGES`, the audit, and the public-build check (prompt 04).

Ledger: `EVAL-P2-001` (parity), `EVAL-P2-002` (audit reports every stage), `EVAL-P2-003a` (lint green on the parity stages).

```
### STOP 2.1: Format and parity
Show: the parity test, the audit table (report-only), tile-skin screenshots for two biomes, one contact sheet.
Question for Craig: accept the placeholder palettes for the duration of prompt 02? Recommended: yes.
```

## Phase 2.2: Mechanics library

Engineer leads; Director defines feel; QA writes pure tests first.

Each mechanic is a pure module in `src/mechanics/<name>.ts` with a small Phaser adapter in `src/mechanics/adapters/`, wired through one registry call in `Game.buildStage`. Tests in `tests/mechanics-<name>.test.ts` cover timing, edge cases and the player-facing rule.

| Mechanic | Rule | Readability |
| --- | --- | --- |
| `timed_rail_group` / timed `vent` | on/off cycles with a shared phase; 300ms arm telegraph before on | arming flash; audible tick in prompt 04 |
| `crumble_group` | platform shakes 350ms after landing, falls, respawns after 2.5s | shake, dust |
| `conveyor` | constant x velocity added to grounded actors and projectiles | animated arrows |
| `carry` | grounded player inherits the platform's per-frame delta (Arcade does not do this; implement in `PlatformCollisionSystem`) | none needed |
| `wind_zone` | timed horizontal force in a rect; airborne player affected more than grounded; projectiles curve | streak particles |
| `current_zone` | constant push in water; jump height minus 20% inside | bubbles |
| `rising_liquid` | a hazard plane rises from `startY` to `endY` over `durationMs` after a trigger x; heavy-tier damage; the segment must be escapable at max rise (lint checks it) | surface line |
| `ice_floor` | ground friction x0.35, dash distance +40% | none needed |
| `room_lock` | camera locks, gate closes, waves spawn from a list, gate opens on clear; `requiredInput` variant for the tutorial | gate art from prompt 03; bars now |
| `breakable_wall` | 3 saber hits or 1 charge-tier-3 shot; hides a secret | crack stages |
| `rockfall` / `icicle` | ceiling spawner with a 400ms telegraph, fall, shatter | shadow on the floor |

`fog_room` was cut on review: a visibility mask plus damage-unless-moving is the hardest mechanic to make fair and the most annoying to play. Mire uses acid pools, crumble over acid, and breakable walls.

Automation: `render_game_to_text().mechanics` lists active mechanics with phase and state. Smoke `39-mechanics-matrix` loads `mechanics_lab` and asserts every mechanic's state field.

Ledger: `EVAL-P2-004`.

## Phase 2.3: Mini-boss system

Engineer leads; Director designs the four archetypes.

Reuse `BossController` and the combat-profile format with `role: 'miniboss'`. Differences from a boss: gate lock with Iona's `miniboss_callout` on the radio ticker (no blocking dialogue), 14 to 18 HP, two attacks and one clear tell, a large health drop on defeat, no reward, no medal, no phase 2, camera lock on the segment, respawn if the player dies before the defeat. Archetypes (art in prompt 03; a tinted existing boss atlas now):

1. `custodian_walker`: heavy grounded stomper; Basalt, Pyro, Glacier skins.
2. `relay_turret_nest`: stationary tri-turret with a rotating shield; Tide, Volt, Ferro skins.
3. `drill_serpent`: segmented dasher that emerges from walls; Mire, Basalt skins.
4. `sentry_twins`: two small fast units that alternate; Gale, Volt skins.

Profiles in `src/bosses/minibossProfiles.ts` validated by the boss validator, tests in `tests/miniboss-profiles.test.ts`, smoke `40-miniboss-encounter` (gate locks, both attacks observed in `bossState.runtime`, defeat unlocks, no dialogue, no reward claim).

Ledger: `EVAL-P2-005`.

## Phase 2.4: Pilot stage, Pyro Maw

Level Designer leads. Build the whole stage from `docs/design/stage-briefs.md` before any other stage. This is the stage Craig plays.

Segment plan (adjust to the brief; keep the rhythm):
1. `intro` (1 screen): safe landing, first patrol, one vent idle.
2. `teach` (2 screens): vents on a slow cycle; jump timing; the `heart_tank` visible behind a `dash_jump` gap.
3. `escalate` (2 screens): faster vents, `enemy_slicer_bot` patrols, `enemy_rocket_bot` on ledges; checkpoint 2 with the radio line.
4. `secret` (1 screen, optional): a `breakable_wall` into the `sub_tank` room (`hp_refill_large` in classic for Pyro, per the placement table).
5. `midboss` (1 screen): `custodian_walker`, Pyro skin, in a locked room; checkpoint 3 after.
6. `master` (3 screens, `verticalScreens: 2`): the rising-slag climb between two wall faces; one-way platforms and wall jumps while the slag rises; vents on ledges; `enemy_mine_bot` and `enemy_fly_trap` on the ascent.
7. `preboss` (2 screens): a breather with pickups, one last vent lane at full speed, checkpoint 4, the boss gate.
8. Boss room variant `pillars` with two vent hazards from the combat profile.

Rules: every enemy is placed for the camera (spawn trigger at least 448px before its position); no blind drop lands on a hazard; every hazard has a telegraph or a safe first encounter; secrets are visible before they are reachable; a checkpoint never sits inside a mechanic's active area; the respawn rule from 2.1 applies.

Run `npm run content:audit` (Pyro meets every floor), `npm run content:lint`, `SWEEP_ONLY=pyro_maw npm run test:visual-sweep`, and the contact sheet.

```
### STOP 2.4: Play Pyro Maw
Show: the audit row, the lint result, the contact sheet, `npm run dev` instructions.
Ask Craig to play to the boss on Normal and answer: too long or too short; any unfair death; any place they did not
know where to go; was the mini-boss readable; did they find a secret.
Question for Craig: approve the rhythm before the other seven are built? Recommended: yes, with the answers recorded.
```

Record Craig's answers verbatim in `EVAL-P2-009` and act on them before 2.5.

## Phase 2.5: The other seven wardens and the tutorial

Level Designer leads. Batches of two; sweep, audit, lint and contact sheets after each; a STOP after each batch. Order by shared mechanics: Basalt and Glacier (walker skins, crumble, ice), Tide and Volt (turret nest, currents, rails), Ferro and Mire (conveyors, acid, serpent), Gale and the tutorial last.

Tutorial (`tutorial_sentinel`, 6 screens, five teach segments; move and jump share the first): each segment introduces one verb with a radio signpost, a safe enemy to try it on, and a `room_lock` with `requiredInput` that opens when the verb was used; the wall-jump segment uses walls; checkpoints are start plus one mid (the radio checkpoint); one secret (`capsule`, `hp_refill_large`); Sentinel Rook unchanged.

For every stage record in `docs/design/stage-briefs.md` what changed from the brief and why.

Ledger: `EVAL-P2-006` (audit enforcing for all ten stages), `EVAL-P2-003b` (lint all stages), `EVAL-P2-010a` to `d` (one row per batch; name the stages in the row).

```
### STOP 2.5a / 2.5b / 2.5c / 2.5d: Batch review (one per batch)
Show: the audit rows, the lint result, two contact sheets, one mid-stage capture per stage.
Question for Craig: approve this batch's rhythm and secrets? Recommended: yes, with any unfair spot named.
```

## Phase 2.6: Omega Fortress in three acts

Level Designer leads; Engineer owns act and rematch persistence.

Keep one stage id `omega_fortress`. Acts are segments with act-boundary checkpoints; `ActiveRunSaveData` gains `omegaAct: 1 | 2 | 3` and `rematchCleared: BossId[]`, validated in `validateActiveRun`.

- Act 1, Relay Spire (10 screens): a remix of at least four biome mechanics in ascending difficulty, two vertical segments, the OMEGA radio intrusions from the script, checkpoint at the end.
- Act 2, Warden Archive: a hub with eight doors labeled by element only. Each door starts a rematch against that warden's full profile at phase-2 cadence in a small arena; copies use `maxHp x0.7` and no weakness hint. After each clear the hub spawns a large HP and full weapon-energy refill; doors open in any order; a checkpoint after every second clear also saves sub-tank state. Implement by re-entering `Game` with `activeRun.omegaAct = 2` and the door index (consistent with checkpoints), not eight bosses in one scene. Target 90 seconds per rematch and 12 minutes for the act; record actual times from the full-campaign smoke (prompt 04) and cut HP again if Act 2 exceeds 15 minutes.
- Act 3, the Core (4 screens): a short approach with the finale mechanics, then `omega_core` unchanged in profile, with the three `finale_phase` lines wired to its phase transitions through the boss phase event.

Smoke `41-omega-three-acts`: act 1 checkpoint; act 2 clear two doors with `bossDebug.damage(999)`, save, reload, assert `rematchCleared` length 2 and the hub reflects it; finish the doors; act 3; ending. Sweep: Omega captures per act.

Ledger: `EVAL-P2-007`.

```
### STOP 2.6: Omega
Show: the act map, the hub capture, one rematch capture, the smoke result.
Question for Craig: approve the rematch rules (x0.7 HP, refills, any order)? Recommended: yes.
```

## Phase 2.7: Difficulty and death feel

Director leads.

`Settings.difficulty` (stored since prompt 01) applied through one pure `resolveDifficultyModifiers()` in `src/systems/difficulty.ts`:

| | Assist | Normal | Veteran |
| --- | --- | --- | --- |
| Damage taken | x0.5 | x1 | x1.5 |
| Boss and mini-boss HP | x0.85 | x1 | x1.25 |
| Respawn checkpoints | all | all | checkpoints 1 and 3 only; every checkpoint still fires its radio and saves progress |
| Game over continue | last checkpoint | last checkpoint | stage start |
| Stage Select weakness hint | shown | shown | hidden |

Changeable in options with a note that boss HP applies on next stage entry. `tests/difficulty.test.ts`.

Death: player explosion burst (effects atlas), 1.1s hold, fade, respawn at the checkpoint with a 400ms fade-in and 1s invulnerability; lives decrement stays; screen shake obeys the setting. Verify through `13c-unified-player-damage` fields plus a mid-burst screenshot. Checkpoint: a flag animation at x (chime in prompt 04).

Ledger: `EVAL-P2-008`.

```
### STOP 2.7: Difficulty
Show: the multiplier table, a death-burst screenshot, the Assist / Veteran options screen.
Question for Craig: approve the multipliers? Recommended: yes.
```

## Phase 2.8: Automation that keeps this true

QA leads.

- Sweep assertions per segment capture: player grounded, no actor above y=90, at least one enemy active in `escalate` and `master` captures, toast lane never over the HUD, retention equals authored, `verticalScreens` segments show the camera at a non-zero y.
- `npm run content:audit` and `npm run content:lint` join `npm run verify` and the CI push job.
- `docs/testing/quality-gates.md` gains rows for both commands; `TESTING.md` documents `warpTo`, `SWEEP_ONLY`, `?stage=`.

Ledger: `EVAL-P2-011`.

## Exit Gate

- `EVAL-P2-001` through `EVAL-P2-011` are `PASS` (review rows carry Craig's replies).
- `npm run content:audit` is enforcing and green for ten stages; paste the table.
- `npm run verify` and the full sweep result lines with artifact paths.
- `wc -l src/scenes/Game.ts` at or below the prompt-01 exit value.
- `docs/content/content-schemas.md` documents `LevelV2`, mechanics, pickups and mini-boss profiles; `ARCHITECTURE.md` gains `src/mechanics/` and `src/content/levels/`; `progress.md` has one entry per phase.
- `docs/prompts/handoff/02-levels-and-gameplay.md` per the charter, with `Inputs for prompt 03` listing: biome ids and palettes, the `TileSkin` tile ids it expects (including wall faces), the mini-boss archetypes with skins, the boss-room variants, segment ids that need decor, the mechanics that need art (gate, crumble, conveyor arrows, wind streaks, cracks), and the contact-sheet script.

```
### STOP 2.EXIT
Show: the audit table, ten contact sheets, the handoff.
Question for Craig: open prompt 03 in a new session? Recommended: yes.
```
