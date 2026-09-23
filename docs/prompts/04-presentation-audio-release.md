# 04. Presentation, Audio, and Release

Active seats: Orchestrator, Audio Director, Principal Game Engineer, Game Director (beats and options), Release Engineer, QA / Eval Lead.

This prompt is two sessions. Run it as `04a` (4.1 to 4.3) and `04b` (4.4 to 4.6).

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 04a | 4.1 Music and SFX | Audio | every screen has its own music; stings | P4-001, P4-002 | listen; replace any track |
| 04a | 4.2 The beats | Director | READY, boss door and WARNING, weapon-get, results, low-HP, ending record | P4-003 | approve timing |
| 04a | 4.3 Gamepad, remap, options, fullscreen, touch | Engineer | plays on a pad; options complete | P4-004 | touch: finish or hide |
| 04b | 4.4 Public build, bundle, deploy | Release | a URL | P4-005, P4-006, P4-007 | proceed |
| 04b | 4.5 Full-campaign automation and the human playthrough | QA | none | P4-008, P4-009 | play the whole game |
| 04b | 4.6 Release | Release | v1.0.0 | P4-010 | tag |

## Entry conditions

- Charter pasted. `docs/prompts/handoff/03-art-animation-bosses.md` exists with `Status: COMPLETE` and every `EVAL-P3-*` row is `PASS`. Otherwise print what is missing and stop.
- Read: the three handoffs, `src/audio/` in full, `assets/audio/credits/README.md`, `assets/audio/music/` (note `title_menu.ogg`, unreferenced and uncredited today), `src/scenes/game/StageIntroSequence.ts`, `src/ui/VictoryModal.ts`, the `PauseMenu` and `GameOverScene` from prompt 01, `src/scenes/ControlsScene.ts`, `src/input/InputActions.ts` (the action map from prompt 01), `src/ui/GameplayTouchControls.ts`, `src/systems/Settings.ts`, `vite.config.ts`, `index.html`, `scripts/check-dist-runtime-assets.mjs`, `scripts/smoke-test.mjs` `main()`, `docs/adr/0002-bundle-size-strategy.md`.

## Outcome of this prompt

The game sounds like a game and stages every beat a Mega Man player expects: stage intro with READY, boss door and WARNING, boss bar fill, weapon-get, stage results, low-health warning, game over and continue, ending with a campaign record, credits. It plays on a gamepad, in fullscreen, at integer scale. Options are complete. A public build with no private assets deploys to a URL. One automated scenario plays the entire campaign. Craig plays it through by hand. Version 1.0.0 is tagged.

## Phase 4.1: Music and SFX

Audio Director leads; Engineer wires cues.

**Cue map** (extend `MusicCueId` in `src/audio/musicLibrary.ts`): `title`, `stage_select`, `prologue`, `stage_tutorial`, one per warden (`stage_pyro_maw` ... `stage_glacier_ronin`), `miniboss`, `boss`, `omega_act1`, `omega_archive`, `omega_core`, `ending`, `credits`, `game_over`. Stings in `sfxLibrary.ts` (short, non-looping): `stage_intro`, `boss_warning`, `weapon_get`, `stage_clear`, `checkpoint`, `miniboss_activate`, `district_restored`, `boss_hit_weak`. `tests/audio-cue-map.test.ts` asserts every music cue has a distinct file that exists. Decide what `title_menu.ogg` becomes (use it for `title` or delete it); either way the credits and the file set agree.

**Sourcing.** CC0 chiptune and 16-bit style tracks (OpenGameArt and similar); prefer multi-track packs by one author so the stages sound related. Every track: verify the license on the source page, record author, title, URL, license and local path in `assets/audio/credits/README.md` before use. AI-generated music is allowed with the tool and prompt recorded and the entry marked `original-generated`. Normalize loudness with `ffmpeg` `loudnorm` to a documented target; export OGG. Loop check the agent can run: `ffmpeg -af astats` on the last and first 40ms, RMS delta under 3 dB, recorded in the ledger row. Listening is Craig's review at STOP 4.1.

If the session has no network: write `docs/audio/sourcing-list.md` (URL, license, target cue per track), print `STOP 4.1a` asking Craig to download into `assets/audio/incoming/`, then continue.

**SFX gaps.** Checkpoint chime, weapon-get, warning siren, dialogue blip, menu open and close, boss defeat explosion, gate open, teleport, crumble, conveyor tick, wind gust, crack, mini-boss activate, district restored, sub-tank drink, low-HP beep. Kenney CC0 packs cover most.

**Wiring.** `AudioService.playMusic` resolves the per-stage cue from the stage id in `Game.create`; boss activation crossfades to `boss` or `miniboss`; Omega acts pick their cues; `EndingScene` plays `ending` then `credits`; crossfade 600ms. Extend `16-music-cue-flow` to assert the per-stage cue and the boss crossfade.

Ledger: `EVAL-P4-001` (cue map test), `EVAL-P4-002` (`scripts/audio/check-credits.mjs` fails on any runtime audio file missing from the credits or any credited file missing on disk).

```
### STOP 4.1: Listen
Show: the cue map table with sources, the credits diff.
Ask Craig to run the game and listen to the title, one stage, one boss, the ending.
Question for Craig: any track to replace? Recommended: none.
```

## Phase 4.2: The beats

Director leads; Engineer implements in the modules prompt 01 created.

1. **Stage intro**: `StageIntroSequence` gains the `ready` phase: after the briefing, `READY` blinks three times over 1.2s with the `stage_intro` sting, then control. Checkpoint respawn plays a 600ms READY without the card.
2. **Boss door and WARNING**: the player touches the gate; input locks; the gate plays `opening` (3 frames, `gate_open` sfx); the player auto-walks 48px; the gate closes; camera lock; siren; `WARNING` band slides across the playfield twice; boss name and element card (1.2s); then the intro dialogue; then the boss bar fills 0 to max over 900ms with a tick; then control. State in `render_game_to_text().bossIntro`.
3. **Weapon-get**: after the defeat dialogue and before the victory return: a full-frame card with the weapon icon, name, the `weaponReward.tutorial` line from `src/bosses/roster.ts`, WREN's portrait, and the `weapon_get` sting; Enter continues. In randomizer mode the card shows whatever the placement gave. Presentation only; the location claim already happened.
4. **Capsule card**: a one-line effect card when a capsule is collected (the effect text from the upgrade table in prompt 01).
5. **Stage results**: time, secrets found (derived from the delta of `collectedChecks` for the stage's `heart_tank` and `sub_tank` ids between entry and clear; no new save field), lives used, difficulty; then the victory return.
6. **Low HP**: at or below 25% the health bar pulses and a soft beep plays every 1.5s (off under reduced flashing).
7. **Game over**: `game_over` cue, the Continue / Quit options from prompt 01 with a 5-second auto-select.
8. **District restored**: on Stage Select return after a clear, the tile flips with the sting and line.
9. **Ending**: the eight district cards, portraits, `ending` and `credits` cues; between the Iona / WREN close and the credits, the `CAMPAIGN RECORD` card: total play time, hearts 8/8, sub tanks 4/4, capsules 8/8, deaths, difficulty, a one-word rank; all from `SaveData.stats`. Credits scroll at a speed where the shortest line stays on screen at least 2.5s; a final `OMEGA RELAY` title card with the subtitle.
10. **Title attract**: after 20 seconds idle, cycle three stage backgrounds behind the logo. Optional; say so if skipped.

Smoke `42-beats-flow`: one stage from intro through door, WARNING, bar fill, defeat, weapon card, results, Stage Select flip; asserts each phase and captures each beat.

Ledger: `EVAL-P4-003`.

```
### STOP 4.2: Watch the beats
Show: READY, door and WARNING, bar fill, weapon-get, results, campaign record (6 PNGs).
Question for Craig: approve the timing? Recommended: yes.
```

## Phase 4.3: Gamepad, remap, options, fullscreen, touch

Engineer leads; Director signs off on the remap screen.

- **Gamepad**: add a Phaser `Input.Gamepad` source to the action map from prompt 01; default map A jump, X shoot and charge, Y saber, B dash, LB and RB cycle weapons, Start pause, Select options, d-pad and left stick move and aim, deadzone 0.25. Menus accept the pad.
- **Remap** (`ControlsScene` becomes the remap screen): keyboard and pad columns, press-to-bind, conflict detection, reset to default; persisted in `settings.v1`; glyphs from prompt 03.
- **Options** additions: `Fullscreen` (`scale.startFullscreen`), `Pixel scaling: Smooth / Integer` (Integer sets zoom to `floor(min(w/448, h/252))` and letterboxes), reduced flashing (caps the charge-ring and explosion flash frequency and disables the low-HP pulse). On `visibilitychange` hidden during `Game`, open the pause menu and stop the charge loop sfx.
- **Colorblind check**: every hazard strip carries a pattern, not only a color (prompt 03 tiles already do; verify each biome).
- **Touch**: decide at the STOP. Finish it (add `WPN` prev and next buttons beside pause; the pause menu works by tap; `4c-touch-controls` extended), or hide the touch layer behind an Options toggle that defaults to off with `Keyboard or gamepad recommended` in the README.
- Smoke `43-gamepad-and-remap`: Playwright cannot press a pad; add `stageDebug.injectPadState()` (automation-only) that feeds the same action path; assert jump and shoot; remap a key, reload, assert persistence; toggle integer scaling and assert the canvas size.

Ledger: `EVAL-P4-004`.

```
### STOP 4.3: Pad and options
Show: the remap screen, the options screen, a fullscreen capture.
Question for Craig: touch, finish or hide? Recommended: finish if the two buttons fit the layout, otherwise hide.
```

## Phase 4.4: Public build, bundle, deploy

Release Engineer leads.

- `npm run build:public`: sets `VITE_PUBLIC_BUILD=1`; `vite.config.ts` skips the private manifest merge and does not copy `assets/private`; `identity.ts` disables the dev skin. `scripts/check-public-build.mjs` fails if `dist/assets/private` exists, if any bundle matches the identity regex from prompt 01, if any atlas the manifest names is missing, or if `mechanics_lab` is reachable. Expect 130 runtime asset files plus the new tiles, backgrounds and audio.
- New script, `verify` unchanged: `"verify:public": "npm run sprites:validate && npm run test && npm run build:public && node scripts/check-public-build.mjs && SMOKE_SERVER=preview node scripts/smoke-test.mjs"`.
- Base path `base: './'` in `vite.config.ts` for GitHub Pages and itch.io; confirm the `index.html` CSP still allows the built assets.
- Bundle: record chunk sizes in `docs/adr/0002-bundle-size-strategy.md` as the v1.0 budget; `scripts/check-dist-runtime-assets.mjs` fails only if the total grows more than 15% over it. Lazy-load nothing unless it removes at least 200KB from first paint without touching `Preload` contracts.
- Deploy: `.github/workflows/deploy.yml` on tag `v*`: `npm ci`, `npm run verify:public`, `SMOKE_LONG=1` smoke (4.5), the sweep, then deploy `dist/` to GitHub Pages. Also `npm run package:itch` producing `output/release/omega-relay-<version>.zip` with `index.html` at the root.
- Performance: smoke `44-restart-leak` restarts a stage ten times and asserts listener and timer counts (`render_game_to_text().runtime = { listeners, timers }`) do not grow; average frame time over a 10-second run is recorded, not gated.

Ledger: `EVAL-P4-005` (public build check green), `EVAL-P4-006` (`SMOKE_SERVER=preview` smoke against the public build), `EVAL-P4-007` (`deploy.yml` present, `npm run verify:public` green, the itch zip exists).

```
### STOP 4.4: Public build
Show: the public-build check output, the chunk-size table, the zip path, the deploy workflow.
Question for Craig: GitHub Pages, itch.io, or both? Recommended: both; Pages from the tag, the zip uploaded by hand.
```

## Phase 4.5: Full-campaign automation and the human playthrough

QA leads.

- Smoke `45-full-campaign`, registered behind `SMOKE_LONG=1` so the default `npm run test:smoke` and `verify` stay fast; the deploy workflow and the pre-tag run set it. Flow: new classic campaign on Normal -> prologue -> tutorial (`stageDebug.warpTo` to the gate, `bossDebug.damage(999)`) -> the eight wardens in weakness order (each: stage intro, warp to the mid checkpoint to fire the radio, warp to the gate, door, WARNING, defeat, weapon card, results, Stage Select flip; assert the weapon was added and the medal counted) -> Omega act 1 -> act 2 all eight doors with one reload in the middle -> act 3 -> ending with the record -> credits -> Title. Final asserts: `gameCompleted`, `activeRun` null, `storyFlags` contains every required sequence id exactly once, weapons owned equals nine plus Buster, medals equals eight. Run it twice, skipping every dialogue and reading every line through `advanceDialogue`; the final save must be identical. Budget eight minutes. Document `SMOKE_LONG` in `TESTING.md`.
- `docs/testing/playtest-checklist.md`: one page Craig fills in while playing the whole game on Normal with a gamepad: per stage (length, fairness, secrets found, mini-boss readable, boss readable, any bug), plus shell items (options persist, remap, pause menu, sub tank, game over, ending, record, credits legible).

```
### STOP 4.5: Play the whole game
Show: the full-campaign smoke result and its artifact folder, the checklist.
Ask Craig to play through on a gamepad and return the sheet.
Question for Craig: any bug to fix before release? Recommended: fix everything reported, re-run the gates and 45.
```

Ledger: `EVAL-P4-008` (full-campaign smoke, both variants), `EVAL-P4-009` (Craig's sheet complete).

## Phase 4.6: Release

Release Engineer leads.

- `package.json` version `1.0.0`; `CHANGES.md` gets a v1.0.0 section listing the four prompts' outcomes; `README.md` rewritten for the finished game (title, one-paragraph pitch, keyboard and pad controls, how to play the public build, how to develop, the gates); `AGENTS.md` scene flow and high-value paths updated (Title, Prologue, PauseMenu, Ending; `src/mechanics/`, `src/content/levels/`, `src/scenes/game/`); `ARCHITECTURE.md` and `TESTING.md` updated for the new modules and every hook added since prompt 01 (`bossDebug`, `narrativeDebug`, `warpTo`, `injectPadState`, `storyIntro`, `SMOKE_LONG`, `SWEEP_ONLY`); `docs/README.md` archives superseded working docs into `docs/archive/` with redirect stubs per the doc-maintenance runbook and promotes `docs/story/`, `docs/design/`, `docs/art/` to canonical. Internal `robot_master` identifiers may be renamed here if time allows; otherwise list them as accepted debt.
- `progress.md`: a final entry `v1.0.0 release state` with the exact commands run, result lines, artifact paths, the deploy URL, and the accepted debt (`Game.ts` size and `@ts-nocheck`, the Phaser chunk).
- Tag `v1.0.0` only after Craig says so; the deploy workflow runs on the tag.

Ledger: `EVAL-P4-010` (live URL after the tag; allowed `PENDING` at STOP 4.EXIT).

## Exit Gate

- `EVAL-P4-001` through `EVAL-P4-009` are `PASS`; `EVAL-P4-010` may be `PENDING` until the tag.
- `npm run verify`, `npm run verify:public`, `npm run test:visual-sweep`, `npm run content:audit`, `npm run content:lint`, and `SMOKE_LONG=1 SMOKE_ONLY=45-full-campaign npm run test:smoke` result lines with artifact paths, all on the release commit.
- The charter's section 10 Definition of Final, checked item by item, each with the evidence path that proves it. Do not restate it; check it.
- `wc -l src/scenes/Game.ts` below 3,928 and `grep -rl "@ts-nocheck" src` prints only `src/scenes/Game.ts`.
- `docs/prompts/handoff/04-presentation-audio-release.md` per the charter, with `Inputs for a future v1.1` listing deferred items (character select from `docs/working/zero-character-select-backlog.md`, any track Craig wanted replaced, deferred readability findings, the attract mode if skipped, touch if hidden, the `robot_master` identifiers if not renamed).

```
### STOP 4.EXIT: Ship
Show: the handoff, the ledger with every row, the itch zip path, the deploy workflow.
Question for Craig: tag v1.0.0? Recommended: yes.
```
