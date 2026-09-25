# Changelog

All notable changes to OMEGA Relay. Versions follow the prompt batches in `docs/prompts/`; the ledger
(`docs/prompts/EVAL_LEDGER.md`) holds the evidence for each eval id named here.

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
