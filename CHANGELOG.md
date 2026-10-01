# Changelog

All notable changes to OMEGA Relay. Versions follow the prompt batches in `docs/prompts/`; the ledger
(`docs/prompts/EVAL_LEDGER.md`) holds the evidence for each eval id named here.

## Unreleased: v1.0.0 candidate (prompts 12 and 13, 2026-09)

Prompt 12 (finish the game) and prompt 13 (polish from Craig's playtest, parts 13a to 13h) on top of 0.5.0.
`package.json`'s version is unchanged here; the v1.0.0 tag is Craig's to make.

### Added
- Seven more warden stages rebuilt to the Heat Works standard (Mire Wraith, Tide Reaver, Volt Hopper, Basalt
  Titan, Ferro Blade, Gale Vixen, Glacier Ronin), and the Central Core in three acts: a mechanic-remix act, the
  eight-door rematch hub, and the finale against OMEGA CORE — ten stages end to end (12d, 12e).
- Ten boss fights with phase kits, a weakness break and stagger, telegraphed attacks, an intro and death
  presentation, and per-boss arena hazards (12f).
- Nine weapons (the Buster plus eight warden specials), each with a charged form (its own move, double cost,
  triple boss damage), a 28-unit energy bar, and a weapon demo after the WEAPON GET card (12f, 13d).
- Pickups v2: new native-size Higgsfield art for health, weapon energy, heart and sub tanks, the capsule and
  the bonus drop; every placement grounded or explicitly marked floating; one extra life per warden stage
  (13e).
- The campaign beats: READY, the weapon-get card, stage results, a low-HP warning, LIVES, and a campaign
  record on the ending (12i); a pre-stage boss-intro card and a district return debrief after every warden
  clear (13g).
- Story beats at every capsule, weapon pickup, game over, warden phase and district return, with portraits
  and a dialogue typewriter (12g).
- A sound for every new action and music per stage and per boss with a phase-two layer, generated
  procedurally or sourced CC0 and credited (12h).
- Difficulty settings (Assist, Normal, Veteran) that change boss HP/damage and enemy damage, with death
  telemetry and heatmaps to retune any segment over three deaths per run (12i, 13c).
- Gamepad support with remap, touch controls with a weapon-cycle row, and a bundled pixel font for
  cross-platform text layout (12i).
- The public build, a GitHub Pages deploy workflow, an itch.io zip, and a performance budget gate (12i).
- Automation: smoke tiers (fast in CI, full and long on a schedule or tag), `content:audit` and
  `content:lint` in `verify`, the shot-contract scenario, and the full-campaign smoke that plays start to
  ending twice (13h).

### Changed
- `StageBuilder`, `EnemyRuntime`, `PickupSystem` and `OmegaActs` extracted out of `Game.ts` (1,655 to 1,396
  lines), with one `resolveHurtbox` shared by the sword, player shots and an enemy's melee hitbox (13h).
- Sentinel Rook, the tutorial boss, retuned to a fair first fight: 60 HP, 1 contact/hop damage, slower
  wind-ups, phase two at 40% (13c).
- Every weapon's range and energy cost rebalanced so a straight shot crosses the view and a bar lasts 7 to
  28 shots depending on the shot's cost (13d).
- Stage route data moved out of the JS bundle to load per stage, lowering `jsGzipKB` (12i, 13h,
  `EVAL-P12-005`).

### Fixed
- Stage music retries a failed load after 2 s instead of waiting for a key press; a production-build smoke
  scenario guards the regression (13b).
- No gap at the top of any vertical segment: the tutorial's wall-kick shaft and every tall room's backdrop
  now cover the camera's full vertical range (13b).
- The shot contract: one muzzle point per pose, a pellet that outruns the dash, hit-stop-aware shot age,
  a deflect/spark reaction on the boss, and lobs/boomerangs that finish their own arc instead of dying at
  the world edge (13b).
- The Glacier route's intermittent `TypeError` in the mini-boss's ground-shockwave frame index (13b).

## 0.5.0: the finish batch (branch `codex/05a-feel-hero-camera`, 2026-09)

Prompt 05 (feel, hero and camera) closed, prompt 06's tutorial pilot and the first finish work from
prompts 06, 07 and 12, on top of 0.1.0 on `main`.

### Feel and control (prompt 05, EVAL-P5-001 to P5-004, P5-010)
- The motor tells the truth: no drag, dash-jump, wall-kick grace, jump cut, ledge forgiveness.
- Combat feel: hit-stop on contact only, hurt lock, charge on press, landing squash, a death sequence and a shake budget.
- The camera leads the hero: a 64x40 deadzone, tweened 40px look-ahead, time-based lerp, a vertical window from stage bounds, whole-pixel scroll.
- Frame-exact input replay and recording for automation; `Game.ts` shed the dev UX, death sequence, camera director and run state into typed modules.

### The hero and the identity (EVAL-P5-005 to P5-007)
- WREN, the generated hero (design C2): 96 frames in 45 groups, a style sheet and an audited cell contract.
- The developer skin is retired: no ripped material ships or sits in the tree; the HUD shows the public identity in every build.

### Profiles and saves (EVAL-P5-008, EVAL-P12-002)
- Three pilot slots with a name (Title, slot picker, name entry, then New Campaign); CONTINUE resumes the active slot and is decided by `campaignStarted`, so an Options visit no longer skips the prologue.
- `{hero}` in dialogue and the HUD label say the pilot's name; a first-run page shows the eight keys once per profile.
- Export a slot to `omega-relay-<name>.json` and import it into an empty slot; per-stage best fields land for prompt 08.
- Saves carry `saveVersion`; every older `save.v1` shape found in git history migrates forward instead of being dropped.

### The tutorial and the playtest (EVAL-P5-009, P5-011, prompt 06 phase 6.P)
- The tutorial teaches: five room locks with required inputs, a wall-kick shaft, Rook's coach lines and key hints on the lane.
- Playtest fixes: HUD panels draw under WebGL, the boss label waits for the fight, overlays hang from the HUD band.
- Drill Hangar drawn from a per-biome tileset with two parallax layers; the dash room teaches without killing.

### Stages, combat and art (prompts 06 and 07, first finish work)
- Heat Works rebuilt to its brief (vents on a shared clock, a slag climb, crumbles, breakable walls) on pure mechanic modules.
- A three-hit saber combo and air spin with a per-frame sword hitbox, reflect, and hero combat effects.
- The custodian walker mini-boss.
- Tilesets and parallax for every district, speaker portraits, title key art, mechanic, pickup, HUD icon and boss frame art (all with provenance).

### Tooling
- CI runs smoke and the mission sweep on pull requests to `main` (EVAL-P12-001).
- Agent system: context packs, review packets, gates with one result line, the decision log and budgets.
