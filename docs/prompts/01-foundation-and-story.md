# 01. Foundation, Campaign Spine, and Story

Active seats: Orchestrator, Principal Game Engineer, Game Director, Narrative Designer, QA / Eval Lead, Release Engineer (CI only).

This prompt is three sessions. Run them as `01a`, `01b`, `01c`; each part re-reads the ledger on start.

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 01a | 1.0 Baseline, commit, CI | Engineer | nothing visible; a trustworthy commit and CI | P1-001, P1-002 | commit the worktree; what to do with scratch folders |
| 01a | 1.0b Input action map | Engineer | identical controls, one input source | P1-010 | none needed; proceed question only |
| 01a | 1.1 Classic campaign mode | Director | beat a warden, get its weapon; the elemental wheel works; upgrades do things | P1-003, P1-004, P1-011 | approve the open-eight layout and the placement table |
| 01a | 1.2 One identity | Director | `OMEGA RELAY` everywhere | P1-005 | approve the title treatment |
| 01b | 1.3 Story bible v2 and script | Narrative | nothing yet; the whole story on paper | P1-006 | read the script; pick the hero callsign |
| 01b | 1.6 Stage design briefs | Director + Narrative | nothing yet; prompt 02's blueprint | review | approve mechanic pairs and difficulty ratings |
| 01c | 1.4 Narrative runtime surfaces | Engineer | prologue, stage card, briefing, radio, ending, credits (text-first) | P1-007, P1-008 | approve staging |
| 01c | 1.5 Pause menu, options, death economy | Director | weapon grid, sub tanks, options, autosave, game over | P1-009 | approve the pause menu |

## Entry conditions

- `docs/prompts/00-orchestrator-charter.md` was pasted this session and you have read it.
- No handoff is required. This is the first prompt.
- Read before writing anything: `README.md`, `AGENTS.md`, `TESTING.md`, `ARCHITECTURE.md`, `docs/README.md`, the last 300 lines of `progress.md`, `docs/working/narrative-story-bible.md`, `src/content/campaign.ts`, `src/progression/seed.ts`, `src/progression/catalog.ts`, `src/progression/state.ts` (top 200 lines and the counts near line 399), `src/systems/Save.ts` (top 120 lines), `src/content/dialogue/dialogue.v1.json`, `src/content/dialogue/validateDialogueContent.ts`, `src/narrative/DialoguePlayback.ts`, `src/ui/DialogueOverlayController.ts`, `src/scenes/Title.ts`, `src/scenes/PauseScene.ts`, `src/scenes/SystemMenu.ts`, `src/scenes/GameOverScene.ts`, `src/scenes/CompletionScene.ts`, `src/scenes/StageSelect.ts` (structure only), `src/input/InputActions.ts`, `src/main.ts`, `src/config/automation.ts`, and in `src/scenes/Game.ts` the ranges 296, 930-960, 1251-1470, 1827-1840, 2279, 2775, 3053, 3540-3552.

## Outcome of this prompt

When you are done the game has a trustworthy committed baseline with CI, one input source, a campaign that works the way a Mega Man player expects (beat a warden, take its weapon, the elemental wheel is real, capsules do something), one source of identity, a complete written story with every line of text the finished game will need, the narrative runtime surfaces working with text-only presentation and art slots reserved at their final sizes, a pause menu with a weapon grid and sub-tank use, autosave, options, and a death economy. Prompt 02 receives a per-stage design brief it can build levels from.

## Traps (read before 1.1)

- `ArcSlash` (Sentinel Rook's reward) is not a progression item. `VALID_PROGRESSION_ITEM_IDS` in `src/progression/state.ts` is built from `ROBOT_MASTER_WEAPON_IDS`, which excludes the tutorial, and `SPECIAL_WEAPON_ORDER` in `src/content/weapons.ts` filters `ArcSlash` out of the cycled weapons on purpose. No player code reads it; there is no charged-saber wave today. Scope in 1.1: on saber release with `arc_slash` in `save.upgradeUnlocks`, `PlayerCombat` spawns the `ArcSlash` projectile defined in `src/projectiles/definitions/coreProjectiles.ts` (damage 2, speed 260, lifetime 600ms). Add it to `12-weapon-switch-energy` as an assertion. If it does not fit the session, defer with a `SKIPPED` row and a reason Craig accepts.
- `OMEGA CORE` contains the substring `MEGA CORE`. The identity test in 1.2 uses word boundaries.
- Milestones already play; they are appended to the defeat dialogue inside `Game` (`getMilestone`). 1.4 moves them, it does not create them.
- The phase label lives in `Game.ts`, not `HUD.ts`; its text comes from roster attack names.
- `storyReplay` lives in `settings.v1` through `src/systems/Settings.ts` (built in 1.4 before anything reads it), never in `SaveData`.

## Phase 1.0: Baseline, commit, CI

Engineer leads. QA verifies.

1. Run `git status --short | wc -l` (expect 207), `git diff --stat | tail -1` (expect 107 files, +10,632 / -5,061), and `git ls-files --others --exclude-standard` (expect 100 untracked). Sample five modified files across `src/`, `scripts/`, `docs/` to confirm coherent work, not corruption. List the untracked folders: new `src/`, `tests/`, `docs/`, `scripts/` files and sprite sources are project work; `tmp/`, `output/`, `types/` are scratch.
2. Run, in this order, and paste each result line: `npm run test`, `npm run build`, `npm run sprites:validate`, `npm run test:smoke`, `npm run test:visual-sweep`. Expect smoke to stop at `29-pellet-hits-short-enemy` (the regression noted in the last `progress.md` entry). Fix it before continuing: the uncharged Buster's combat sensor must reach `enemy_mine_bot`'s hurtbox at floor height; definitions live in `src/projectiles/definitions/coreProjectiles.ts`, the router in `src/projectiles/collision/ProjectileCollisionRouter.ts`. Iterate with `SMOKE_ONLY=29-pellet-hits-short-enemy npm run test:smoke`, then run the full smoke.
3. Open and inspect `output/web-game-smoke/summary.json` and `output/mission-visual-sweep/summary.json`. Every scenario `pass`, every mission `pass`.
4. Document in `TESTING.md` the settings the charter lists as undocumented: `SMOKE_ONLY`, `SMOKE_PORT`, `SWEEP_PORT`, `?automation=1`, `?renderer=canvas`, `?startScene`, `bossDebug`, and the extra `stageDebug` hooks.

```
### STOP 1.0: Commit the baseline
Question for Craig: commit the 107 modified files and the untracked project files on the current branch as
"checkpoint: pre-completion baseline (gates green)", adding `tmp/` and `output/` to `.gitignore` first and
leaving `types/` in if the build needs it? Recommended: yes.
```

5. After approval, commit. Then add CI:
   - `.github/workflows/ci.yml`: on push and pull_request, Node 22, `npm ci`, `npm run test`, `npm run build`. A second job on `workflow_dispatch` installs Playwright (`npx playwright install --with-deps chromium`) and runs `npm run test:smoke` with `SMOKE_PORT=4400` and `npm run test:visual-sweep`, uploading `output/` as an artifact. Smoke does not run on push: headless-canvas flakes in CI are where solo projects lose days, and the local gates already exist.
   - `package.json`: `"ci": "npm run test && npm run build"`.
   - `TESTING.md`: a `## Continuous Integration` heading, five lines.

Ledger: `EVAL-P1-001` (baseline), `EVAL-P1-002` (workflow present and `npm run ci` green locally; the remote run URL is recorded after Craig pushes and is not required for PASS).

## Phase 1.0b: One input source

Engineer leads.

Build `src/input/InputActions.ts` into an action map: `moveLeft`, `moveRight`, `aimUp`, `aimDown`, `jump`, `dash`, `shoot`, `saber`, `weaponPrev`, `weaponNext`, `pause`, `confirm`, `cancel`. Sources: keyboard bindings (the defaults from `README.md`'s control table) and `DigitalButtonPad` (touch). `Game.ts` reads actions only; remove the `addKey` calls at `Game.ts:2279` and any other scene-owned key reads (grep `keydown-` and `addKey` in `src/scenes/`). Bindings persist in `settings.v1` (the remap screen arrives in prompt 04; the gamepad source too). Pure tests in `tests/input-actions.test.ts`: edge vs held, two sources agreeing, a rebound key. Smoke: `13d-movement-feel` and `4c-touch-controls` still pass unchanged.

Ledger: `EVAL-P1-010`.

## Phase 1.1: Classic campaign mode

Director leads design, Engineer implements, QA writes the tests first.

**Design memo, as a table. Write it into the handoff, then implement it.**

| Rule | Classic (default) | Relay Randomizer (kept as is) |
| --- | --- | --- |
| Stage access | after the tutorial all eight wardens are open | chain unlock from the seed |
| `boss_clear` reward | the warden's own `rewardWeaponId`; tutorial gives `arc_slash` (see Traps) | seeded placement |
| Weakness | from `WeaknessTable` in `src/bosses/types.ts`: Fire falls to Water, Water to Lightning, Lightning to Earth, Earth to Metal, Metal to Toxic, Toxic to Wind, Wind to Ice, Ice to Fire (one clean cycle; it is the intended play-order hint) | chain-derived |
| Final gate | 8 medals | seeded rules |
| `weaknessStrictness` | `weakness_and_buster` | unchanged |
| Other locations | fixed table below | seeded |
| Seed | the literal `classic` | generated, shown, `Reroll`; `?seed=` in the URL overrides for sharing; no text entry |
| Availability | always | after `gameCompleted`, or Shift on New Campaign |

All five location ids stay in every warden stage (`src/progression/catalog.ts` defines them and prompt 02 places them). Classic placements:

| Stage | `capsule` | `sub_tank` | `heart_tank` | `pickup_bonus` |
| --- | --- | --- | --- | --- |
| tutorial_sentinel | `hp_refill_large` | n/a | n/a | `hp_refill_large` |
| pyro_maw | `chip_buster_plus` | `hp_refill_large` | `heart_tank` | `hp_refill_large` |
| tide_reaver | `chip_quick_charge` | `sub_tank` | `heart_tank` | `hp_refill_large` |
| volt_hopper | `armor_legs` | `hp_refill_large` | `heart_tank` | `hp_refill_large` |
| basalt_titan | `armor_body` | `sub_tank` | `heart_tank` | `hp_refill_large` |
| ferro_blade | `armor_arms` | `hp_refill_large` | `heart_tank` | `hp_refill_large` |
| mire_wraith | `chip_weapon_plus` | `sub_tank` | `heart_tank` | `hp_refill_large` |
| gale_vixen | `chip_speedster` | `hp_refill_large` | `heart_tank` | `hp_refill_large` |
| glacier_ronin | `armor_helmet` | `sub_tank` | `heart_tank` | `hp_refill_large` |

Craig may swap cells at STOP 1.1. The two audited secrets per stage (prompt 02) are `heart_tank` and `sub_tank`; `capsule` sits on the main route.

**Every upgrade does one testable thing** through `resolveUpgradeModifiers(save)` in a new `src/progression/upgrades.ts`, consumed by the player and combat modules (today only `armor_arms` is read, at `Game.ts:3053`):

| Item | Effect |
| --- | --- |
| `armor_helmet` | no hitstun from contact damage |
| `armor_body` | damage taken x0.75 |
| `armor_arms` | charge tier 4 unlocked (already read; move the read here) |
| `armor_legs` | air dash |
| `chip_quick_charge` | charge thresholds x0.7 |
| `chip_speedster` | run and dash speed x1.12 |
| `chip_weapon_plus` | special-weapon energy cost minus 1 (floor 1) |
| `chip_buster_plus` | uncharged pellet damage 2 |
| `heart_tank` | already raises max HP; keep |
| `sub_tank` | usable from the pause menu (1.5) |

Tests in `tests/upgrades.test.ts`. The capsule pickup shows the effect in one line (the card art comes in prompt 04).

**First launch.** With no save present, New Campaign asks only difficulty (Normal preselected; the difficulty system itself arrives in prompt 02, so store the choice now and apply it then) and starts Classic. The randomizer appears in the chooser only when `gameCompleted` is true or Shift is held. This replaces the immediate `Save.clearAll()` on `N` (the old `SAVE-003` confirmation ticket).

**Implementation.**
- `src/progression/types.ts`: `progressionMode: 'classic' | 'relay_randomizer'` on `ProgressionWorldSnapshot`; absent means `relay_randomizer` (that is what old saves were generated with; say so in a comment).
- `src/progression/seed.ts`: `generateClassicWorld()` beside `generateProgressionWorld(seed)`; `startingStageIds` is tutorial plus all eight; `stageChain` is `ROBOT_MASTER_STAGE_IDS` in order (presentation only in classic).
- `src/progression/state.ts`: `createFreshProgressionState(seed, mode)`; `ensureProgressionState` respects the stored mode; add `arc_slash` to the valid item set; transport carries the mode and rejects a mismatch with a reason; old transports without a mode import as randomizer.
- `src/systems/Save.ts`: add `stats: { playTimeMs, deaths, clearTimeMsByStage, secretsFoundByStage }` (prompt 04's campaign record reads them; start counting now) and `storyFlags: string[]` (1.4).
- `src/content/campaign.ts`: add `difficultyRating: 1 | 2 | 3` per stage (provisional now, final values from the briefs in 1.6) and `district: string` (used by dialogue tokens in 1.3).
- `src/scenes/StageSelect.ts`: in classic, the tile footer shows `WEAK: ???` until the weapon is owned, then the weapon name; the reward line reads `REWARD: <weapon display name>`; header counts read `WARDENS 3/8`; each tile shows 1 to 3 difficulty pips; the preview panel's first line for an uncleared stage is Iona's `stage_briefing` hook line (from 1.3; until then the stage description). Fix the truncated tile titles (`BASALT TIT...`, `GLACIER RO...`) with a fitting size or two lines; no ellipsis. Reserve a 32x32 portrait slot at the tile's left edge (prompt 03 fills it) and draw it as an outlined box for now.
- Automation: `render_game_to_text().stageSelect.progressionMode` and `.progression.progressionMode` in `Game`; `stageDebug.grantWeapon(id)` and `stageDebug.grantUpgrade(id)` (automation-only).

**Tests, written first.** `tests/progression-classic.test.ts`: fresh classic save unlocks tutorial plus eight; each warden `boss_clear` placement is its own weapon; every weakness profile equals the `WeaknessTable` answer; the placement table above holds; final gate is exactly `[{ medals: 8 }]`; export then import round-trips the mode; importing a randomizer transport into a classic save is rejected with a reason; a transport without a mode imports as randomizer; existing randomizer tests still pass untouched.

**Smoke.** Add `33-classic-stage-select`: new classic campaign, clear the tutorial through the existing boss-clear path (`bossDebug.damage(999)`), assert `stageSelect.rewardLabel` for `pyro_maw` is `Flame Serpent` and `weaknessLabel` is `???`, `stageDebug.grantWeapon('HydroLance')`, assert `weaknessLabel` is `Hydro Lance`, assert the pips count for `pyro_maw`. `4b-stage-select-progression` keeps testing the randomizer and gains one assertion that `progressionMode` is `relay_randomizer`.

Ledger: `EVAL-P1-003` (classic world unit tests), `EVAL-P1-004` (Stage Select truth smoke plus a 448x252 screenshot with no truncated text), `EVAL-P1-011` (upgrade effects tests).

```
### STOP 1.1: Classic mode
Show: the design table, the placement table, the upgrade table, the Stage Select screenshot.
Question for Craig: approve all eight wardens open after the tutorial, and the placement table as written?
Recommended: yes; swap cells if a theme feels wrong.
```

## Phase 1.2: One identity

Director leads. Engineer implements.

1. Create `src/content/identity.ts` exporting one frozen object: `GAME_TITLE = 'OMEGA RELAY'`, `GAME_SUBTITLE = 'EIGHT WARDENS. ONE MANUFACTURED CRISIS.'`, `HERO_CALLSIGN = 'WREN'`, `HERO_UNIT = 'RECOVERY UNIT 09'`, `OPERATOR_NAME = 'Director Iona Vale'`, `ANTAGONIST_NAME = 'OMEGA CORE'`, `WARDEN_TERM = 'WARDEN'`, `WARDEN_TERM_PLURAL = 'WARDENS'`, plus `DEV_SKIN = { enabled, heroLabel: 'MEGA MAN X' }` where `enabled` is true only when `__PRIVATE_SPRITE_MANIFEST_DATA__` is non-null and `import.meta.env.VITE_PUBLIC_BUILD !== '1'`. The Narrative seat may change `HERO_CALLSIGN` in 1.3; it stays 4 to 6 characters, readable in the 8px HUD font, and is not a warden name.
2. Replace every hard-coded string: `src/scenes/Title.ts:43,50,62`, `src/ui/HUD.ts:85`, `src/scenes/Game.ts:2295`, `src/scenes/StageSelect.ts:265,273` (`WARDEN SELECT`, `8 WARDENS + OMEGA`), `README.md:1`, `index.html:10`, `package.json` name (`omega-relay`), and the comment at `src/player/config.ts:136`. The `{hero}` token at `Game.ts:939` resolves from `identity.ts`.
3. `tests/identity-strings.test.ts`: scans `src/**/*.ts` (excluding `identity.ts` and `__tests__`) with the regex `/\b(MEGA MAN|MEGA CORE|ROBOT MASTER|Robot Master|Mega Man|Capcom)\b/` over string literals and comments; word boundaries keep `OMEGA CORE` legal. Internal snake-case identifiers (`robot_master`, `ROBOT_MASTER_STAGE_IDS`, `robot_master_clear_count`) are exempt; renaming them is prompt-04 debt, noted in the handoff.
4. Regenerate the title screenshot through `SMOKE_ONLY=4-title-controls npm run test:smoke` and open `output/web-game-smoke/4-title-controls/shot-0.png`.

Ledger: `EVAL-P1-005`.

```
### STOP 1.2: Identity
Show: the title screenshot and the HUD label in a stage capture.
Question for Craig: approve the title treatment and subtitle? Recommended: yes.
```

## Phase 1.3: Story bible v2 and the complete script

Narrative Designer leads; Director reviews for readability; Engineer only adds validation.

Read `docs/working/narrative-story-bible.md` and `dialogue.v1.json` first. Keep what is good: the premise (OMEGA manufactured the crisis to prove only permanent central control keeps people safe), the wardens as coerced custodians, Iona Vale as the operator, the order-independent reveal structure, and the closing line "Then we leave it a choice." Then make it a story a player will remember. Write these files:

**`docs/story/story-bible.md`** (120 to 180 lines; the script is the game, the bible is the reference):
- Logline, theme (coordination without coercion), tone (urgent, hopeful, short lines).
- World: the city, eight districts, one table for the eight wardens with columns district, day job, what OMEGA told them, the forged evidence they hold, how relief sounds when freed.
- Cast, one paragraph each, with a want, a wound and a voice rule: WREN (built inside the same program as OMEGA, skeptical of imposed certainty, says less than Iona, never sermonizes, gets exactly one line per game that is about WREN); Iona Vale (calm, precise; she wrote part of OMEGA's coordination layer and believed in it; her arc runs from defending the design to choosing the districts, and it turns on screen at milestone 4); OMEGA CORE (lucid, composed, never monstrous; believes uncertainty is harm; present throughout the game through radio intrusions, not only at the end); Sentinel Rook.
- Structure: prologue, tutorial, eight order-independent warden arcs, milestones at 1 / 4 / 8, Omega Fortress in three acts (Relay Spire: OMEGA broadcasts the crisis live; Warden Archive: OMEGA replays corrupted copies of the freed wardens, the rematch gauntlet; the Core: three-phase exchange in which OMEGA offers WREN a place in the lattice and WREN refuses in one line, which sets up the last line), epilogue, credits.
- Rules for order independence (a warden's lines reference only local evidence, OMEGA's override, the current reward, and count-based milestones; never another named warden).
- Tokens: `{hero}`, `{rewardLabel}`, `{clearedCount}`, `{remainingCount}`, plus `{districtName}` and `{wardenName}`. The Engineer adds both to `DIALOGUE_INTERPOLATION_TOKENS` in `src/content/dialogue/types.ts`; `buildDialogueLines` resolves `districtName` from the new `district` field on the stage and `wardenName` from the roster codename.
- Ending promise, and what the last screen of the game shows.

**`docs/story/script.md`**: every line the finished game displays, grouped by trigger, in play order, with speaker and a one-line staging note. Line limits: 180 characters; boss intro and defeat 2 to 4 lines; briefing 2 to 3 lines; radio 1 to 2 lines; prologue and epilogue up to 12 lines each; OMEGA intrusions 1 line. Required coverage:

| Trigger | Count | Notes |
| --- | --- | --- |
| `prologue` | 1 sequence | Title -> New Campaign; skippable; shown once |
| `stage_briefing` | 10 | before control; Iona states the district, the failure, the civilian stake, one tactical hint; the first line doubles as the Stage Select hook line |
| `radio` | 10 | fires at a mid-stage checkpoint; alternates Iona evidence with an OMEGA intrusion |
| `miniboss_callout` | 8 | one Iona line when the mini-boss gate locks (prompt 02 builds the mini-boss) |
| `boss_intro` | 10 | rewrite of v1 for voice; keep the beats |
| `boss_defeat` | 10 | acknowledge the reward, never grant it |
| `district_restored` | 8 | one line on the Stage Select tile after a clear |
| `milestone` | 4 | at 1, 4 (Iona's turn: she admits her authorship of the layer and says which side she is on now, 2 lines), 8, plus `first_weakness` when the player first hits a weakness |
| `finale_phase` | 3 | one OMEGA line per Core phase transition; phase 3 is the offer and WREN's refusal |
| `epilogue` | 1 sequence | eight district cards, then the Iona / WREN close ending on "Then we leave it a choice." |
| `credits` | 1 | authored role and thanks lines only; asset credits come from a generated file (1.4), never from this JSON |

**`docs/story/style-guide.md`**: 30 lines: voice per character, banned words (franchise terms, "robot master"), writing for an 8px font, keeping a line order-independent, writing an OMEGA line (measured, declarative, never threatens, always offers certainty), the WREN rule.

**`src/content/dialogue/dialogue.v2.json`** and validator changes in `validateDialogueContent.ts` and `types.ts`: the new triggers above; `stage_briefing`, `radio`, `miniboss_callout`, `district_restored` carry `stageId`; `prologue`, `epilogue`, `credits`, `finale_phase` do not; `finale_phase` carries `phase: 1 | 2 | 3`; `milestone` keeps `clearedBossCount` and gains `kind: 'first_weakness'`. Validation fails on: a missing required sequence per the table, a line over 180 characters, an unknown token, a warden display name inside another warden stage's sequences (except in `omega_fortress`, `epilogue`, `credits`), a `boss_defeat` line containing "grant", "unlock" or "receive". Keep `dialogue.v1.json` on disk until 1.4 lands, then delete it and update `DialogueRegistry.ts` and tests.

Tests: extend `tests/dialogue-content.test.ts` with the coverage table and one failing fixture per rule.

Ledger: `EVAL-P1-006`.

```
### STOP 1.3: Read the story
Show: story-bible.md, script.md, style-guide.md. Ask Craig to read script.md end to end; it is the game.
Question for Craig: hero callsign, and approval of the script before it is wired? Recommended: WREN; approve.
```

## Phase 1.6: Design briefs for prompt 02 (done in 01b, right after 1.3)

Director and Narrative co-write `docs/design/stage-briefs.md`: one section per stage (tutorial, eight wardens, Omega with three acts). Each section, 25 to 40 lines: fiction (what the district is, what the player walks through), the two biome mechanics with their fiction (Pyro: timed flame vents and a rising-slag climb; Tide: current zones and water-level gates; Volt: timed electrified rails and lane-swapping platforms; Basalt: crumbling footing and falling rock; Ferro: conveyors and magnet lifts; Mire: acid pools, crumbling platforms over acid, breakable walls; Gale: timed wind gusts and carried moving platforms; Glacier: ice friction and falling icicles), the enemy palette (5 to 6 of the 12 types, by runtime `typeKey` with the `enemy_` prefix, with a reason each), the mini-boss archetype and skin, where the two secrets hide and what gates them (a weapon, a dash jump, a wall jump, a breakable wall), which segment scrolls vertically or uses walls, the radio beat and where it fires, the boss-room variant, and the final `difficultyRating` (1 to 3). The Omega section defines the three acts and the rematch rules. Update `campaign.ts` `difficultyRating` values from the briefs.

```
### STOP 1.6: Read the briefs
Show: stage-briefs.md.
Question for Craig: approve the mechanic pairs, secrets and difficulty ratings as prompt 02's blueprint? Recommended: yes.
```

## Phase 1.4: Narrative runtime surfaces (text first, art later)

Engineer leads; Narrative reviews staging; QA writes smoke.

Build each surface as a small typed module plus a thin Phaser presenter, following `src/narrative/DialoguePlayback.ts` and `src/ui/DialogueOverlayController.ts`. Presentation uses `src/ui/menu/menuTheme.ts`. Art slots are reserved now at their final sizes and drawn as outlined boxes, so prompt 03 fills them without a relayout: the dialogue overlay reserves a 48x48 portrait at x=8 and wraps text at width minus 72; epilogue pages reserve the top 120px for the district card and place text in the lower 74px; the Stage Select tile already reserves 32x32.

0. **Settings first.** `src/systems/Settings.ts` with storage key `settings.v1`, validation, defaults, and `Settings.get()` / `Settings.update()`; fields for now: `musicVolume`, `sfxVolume`, `screenShake`, `storyReplay`, `difficulty`, `bindings`. `AudioService` reads volumes live. 1.5 adds the UI.
1. **Automation switch.** URL param `storyIntro=off` (default `on`) skips prologue, stage card, briefing, radio and milestones. `scripts/smoke-test.mjs` and `scripts/mission-visual-sweep.mjs` append `&storyIntro=off` to their base URLs; the new scenarios below pass `storyIntro=on`. Document in `TESTING.md` and `docs/testing/quality-gates.md` in the same commit.
2. **Story flags.** `SaveData.storyFlags: string[]` of sequence ids seen; sanitized in `ensureProgressionState` (unknown ids dropped); imported through the transport only if the id exists in the registry. When a sequence was seen and `Settings.storyReplay` is false, blocking sequences auto-skip in one frame and non-blocking ones do not fire; `boss_intro`, `boss_defeat` and milestones obey the same rule. Skip and full-read produce identical flags (extend the existing playback parity test).
3. **`PrologueScene`** (`src/scenes/PrologueScene.ts`, registered in `main.ts`): launched from Title's New Campaign after the difficulty choice; text pages over a dark tinted backdrop with `bg_dock_0` drifting; Enter advances, Esc skips; ends in the tutorial. `render_game_to_text().prologue = { pageIndex, pageCount, sequenceId }`; `window.narrativeDebug.advance()/skip()` following the `stageDebug` pattern, documented.
4. **`StageIntroSequence`** (`src/scenes/game/StageIntroSequence.ts` pure; presenter `src/ui/StageIntroPresenter.ts`): in `Game.create` before control: black -> stage card (`introCallout` over `title`, 900ms) -> briefing lines (blocking, through the dialogue overlay) -> fade in -> control. Checkpoint respawn skips card and briefing. Phase enum `card | briefing | ready | done` with `ready` left empty for prompt 04's READY blink. `render_game_to_text().stageIntro = { phase, active }`.
5. **Radio ticker** (`src/ui/RadioTicker.ts`): a non-blocking one- or two-line banner at the bottom of the playfield (y 226 to 248, never over the HUD), 4.5 seconds per line, speaker label, gameplay continues; bound through `checkpoints[].radioSequenceId?` (prompt 02 rebinds to segments). One toast lane with a queue shared by the ticker and the gate toast, so `BOSS GATE ADVANCE` and `Checkpoint 2` can never overlap again (they do today in `output/mission-visual-sweep/pyro_maw/mid.png`).
6. **District restored** on Stage Select: cleared tiles show the `district_restored` line in the preview panel instead of `MISSION RECORD COMPLETE`.
7. **`EndingScene`** (`src/scenes/EndingScene.ts`) replaces `CompletionScene` as the route after `omega_fortress:boss_clear` (the location claim stays the only authority; `Game` only routes): eight district card pages, the Iona / WREN close, a `CAMPAIGN RECORD` page placeholder (prompt 04 fills it from `SaveData.stats`), then a credits scroll built from the `credits` sequence plus `src/content/credits.generated.ts`, produced by `scripts/credits/build-credits.mjs` (`npm run credits:build`) from `assets/audio/credits/README.md` and the sprite attribution file. Enter advances, Esc skips to credits, any key at the end returns to Title. `render_game_to_text().ending = { page, pageCount, phase }`.
8. **Milestones** move from the defeat dialogue in `Game` (`getMilestone`, `Game.ts:952`, `:2775`) to the Stage Select return after the qualifying clear: once, blocking, skippable. `first_weakness` fires from the boss-damage weakness result through an event, never from dialogue.
9. **Phase label**: add `shortName` (max 12 characters, validated) to roster attack entries in `src/bosses/roster.ts`; `Game.ts` `phaseLabel` uses it; remove the `slice(0, 12)`.
10. **`Game.ts` budget**: this phase adds call sites. Extract the debug-hook block (`Game.ts:1251-1470`) into `src/scenes/game/GameDebugHooks.ts` in the same phase so the net is negative.

Smoke scenarios (each with a screenshot Craig opens):
- `34-prologue-flow`: Title -> New Campaign -> Normal -> prologue pages -> skip -> tutorial stage card -> briefing -> control; assert `storyFlags` contains `prologue` and the tutorial briefing id.
- `35-radio-ticker`: reach the tutorial mid checkpoint, assert the `radio` line visible in state and gameplay not paused, assert ticker and gate toast never co-exist.
- `36-ending-flow`: drive the Omega defeat path used by `14-completion-return-flow`, assert `EndingScene` pages, credits, return to Title, `gameCompleted` true, `activeRun` null.
- `37-story-replay-skip`: replay a cleared stage with `storyReplay` false, assert no blocking sequence fired; toggle it on, assert it did.

Ledger: `EVAL-P1-007` (surfaces smoke), `EVAL-P1-008` (skip / full-read parity, unit and smoke).

```
### STOP 1.4: See the surfaces
Show: prologue page, stage card, briefing with the empty portrait box, radio ticker, ending card, credits (6 PNGs).
Question for Craig: approve the staging and the reserved slot sizes? Recommended: yes.
```

## Phase 1.5: Pause menu, options, autosave, death economy

Director leads; Engineer implements.

1. **One `PauseMenu`** replaces `PauseScene` and the in-game `SystemMenu`. Top band: the weapon grid (Buster plus owned specials with energy bars; cursor selects and equips), sub tanks (fill percentage; Enter drinks one: refills HP over 900ms, empties the tank; tanks fill from health pickups collected at full HP), heart count, armor and chip icons (icon art in prompt 03; labels now). Bottom band: Resume / Options / Quit to Warden Select. State in `render_game_to_text().pauseMenu`. Smoke `38b-pause-weapon-select` (equip a weapon from the grid, drink a tank, assert HP and tank state).
2. **Autosave.** Remove `save_game`, `load_game`, `new_game` and `progression` from the in-game menu. Save at checkpoints, on boss clear, and on Stage Select return. Title's primary line reads `CONTINUE  WARDENS 3/8  1H 12M` from `stats.playTimeMs`. `ProgressionSummaryScene` stays reachable only in automation mode. Adapt `13-load-save-restores-weapon-energy`, `13b-corrupt-save-rejected`, `4b` and `4d` to the autosave semantics (they exercise the same active-run path; only the menu route changes).
3. **Options** (from the pause menu and Title): music and SFX volume (0 to 10), screen shake, story replay, difficulty (stored; applied in prompt 02), delete all data with a typed `DELETE` confirmation. Remap, gamepad, fullscreen and scaling arrive in prompt 04; leave labeled slots.
4. **Death economy.** Three lives per stage entry; no 1-up drops. Losing a life respawns at the checkpoint with full HP and weapon energy kept. Game over on Normal and Assist: Continue from the last checkpoint with lives reset, sub tanks kept; on Veteran: Continue from stage start (prompt 02 wires the difficulty). `GameOverScene` offers Continue and Quit with a 5-second auto-select of Continue. The HUD lives readout becomes `RETRY x03`.
5. Smoke `38-options-persist`: change two settings, reload, assert persistence and that the audio debug state reflects the volume.

Ledger: `EVAL-P1-009`.

```
### STOP 1.5: Pause menu and options
Show: the pause menu with a weapon equipped and a tank drunk, the options screen, the game-over screen.
Question for Craig: approve the pause menu layout? Recommended: yes.
```

## Exit Gate

All ledger rows `EVAL-P1-001` through `EVAL-P1-011` are `PASS` (`P1-002` may stay `PENDING` on the remote run URL), plus:
- `npm run verify` and `npm run test:visual-sweep` result lines with artifact paths.
- `wc -l src/scenes/Game.ts` at or below the baseline commit's value (paste both).
- `progress.md` has one entry per phase.
- `docs/README.md` indexes `docs/story/` and `docs/design/`.
- `docs/prompts/handoff/01-foundation-and-story.md` per the charter, with `Inputs for prompt 02` listing: `docs/design/stage-briefs.md`, `docs/story/script.md`, `src/content/identity.ts`, the classic-mode tables, the radio binding contract, the toast-lane queue, the `stageIntro` phase enum, the `storyIntro` switch, the `Settings` fields, the death-economy rules, the input action names, and the last smoke scenario number you used.

```
### STOP 1.EXIT
Show: the handoff, the ledger, the two summary.json paths, six screenshots.
Question for Craig: push the branch and open prompt 02 in a new session? Recommended: yes.
```
