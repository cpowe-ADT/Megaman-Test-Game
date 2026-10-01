# Handoff 06: Levels, mechanics and enemies

## Status: COMPLETE for content and gates; the human-review half of several rows (Craig's play-approval) is still open. This file is a pointer: 06 has no lane of its own and was finished across prompt 12's parts 12b to 12e and prompt 13's parts 13c and 13h.

Prompt 06 (`docs/prompts/06-levels-mechanics-and-enemies.md`) was never run as its own lane. Prompt 12's audit
folded its remaining phases into parts 12b (6.2 mechanics library), 12c (6.3 mini-bosses and enemy
behaviour), 12d (6.6 the other seven wardens and the tutorial), 12e (6.7 Omega Fortress in three acts),
13c (6.8 difficulty and death economy) and 13h.1/13h.3 (6.9 automation, plus the tutorial secret/crumble
and camera-relative spawn/respawn leftovers). Detail and evidence live in
`docs/prompts/handoff/12-finish-the-game.md` and `docs/prompts/handoff/13-polish-from-playtest.md`.

## Branch and final commit

Branch `codex/05a-feel-hero-camera` @ `fc1eab1` (the tip this docs pass branched from).

## What changed (by area, with file paths)

- Mechanics library (12b): twelve mechanics under `src/mechanics/` (conveyor, ice_floor, current_zone,
  timed_rail_group, wind_zone, rockfall, icicle plus the five from the Heat Works pilot), the lab stage and
  smoke 42.
- Mini-bosses and enemy behaviour (12c): `src/enemy/custodianWalker.ts` plus three more archetypes and
  two palette skins; charge, beam telegraph, ledge probe and shield-arc behaviour; smoke 43 and 64.
- Seven more warden stages plus the tutorial's secret and crumble group (12d, 13h.3a): every stage through
  the registry `src/content/stages/index.ts`.
- The Central Core in three acts (12e): `src/content/stages/omegaFortress.ts`, `src/content/omegaArchive.ts`,
  `src/scenes/game/OmegaActs.ts`.
- Difficulty and death economy (13c): `src/progression/difficulty.ts`, `docs/design/difficulty-curve.md`,
  `src/telemetry/segmentTelemetry.ts`, `scripts/content/heatmap.mjs`.
- Automation (13h.1/13h.3): `scripts/smoke/tiers.json`, `content:audit`/`content:lint`, sweep v2 assertions;
  `src/scenes/game/StageBuilder.ts` and `EnemyRuntime.ts` extracted from `Game.ts`.

## Decisions made (each with the reason and what it forecloses)

- D-017 (2026-09-24): Craig accepted the rebuilt tutorial/Heat Works as the standard every other stage
  repeats, closing the stage-brief question for 12d.
- D-018 to D-022 (2026-09-25): delegated finish decisions, including going ahead with 12b to 12i without a
  per-part STOP.

## Content inventory

See `docs/prompts/handoff/12-finish-the-game.md` and `13-polish-from-playtest.md` for stage/boss/mechanic
counts; this file does not duplicate them.

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

Ledger rows: `docs/prompts/EVAL_LEDGER.md` prompt 06 section (PASS: P6-004, P6-017, P6-018, P6-020, P6-021,
P6-022; PENDING: the other sixteen, most noted "left: Craig plays/reviews" rather than unbuilt work).

## Open risks and known debt

- Sixteen of twenty-two P6 ledger rows are PENDING on Craig's play, not on missing code; `npm run agents:facts`
  gives the live count.
- `EVAL-P6-001` (the level v2 parity snapshot) is proposed for dropping in prompt 13's Exit Gate: the stages
  were rebuilt through the stage registry instead of converted.

## Inputs for prompt 12 and 13 readers

- Read `docs/prompts/handoff/12-finish-the-game.md` and `13-polish-from-playtest.md` first; they carry the
  detail this pointer intentionally omits.
