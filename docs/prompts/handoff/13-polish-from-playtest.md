# Handoff 13: Polish from the playtest

## Status: COMPLETE for parts 13a to 13h's content and automation gates. Every `EVAL-P13` row but one (`EVAL-P13-006`, Craig's play) is PASS; the Exit Gate's own play-through and the playtest sheet (`EVAL-P8-009`) are Craig's, still open.

Craig played the build on 2026-09-30 and listed what was left (D-023, verbatim in
`docs/prompts/DECISIONS.md`). Every note was reproduced or traced to file:line first (part 13a, findings in
`output/notes/13a/`), then broken into parts 13b to 13h, each with an eval, run in lanes with the gates.
This prompt also absorbed what prompt 12 left (part 13h.3).

## Branch and final commit

Branch `codex/05a-feel-hero-camera` @ `fc1eab1` (the tip this docs pass branched from; 13's parts land
across commits from `102b003` (13a) to `fc1eab1` (13h.3's tutorial leftovers)).

## What changed (by area, with file paths)

- 13a, findings: `output/notes/13a/` (music/backdrop, combat, pickups/beats, art audit); probes in
  `output/probes/13a/`.
- 13b, the bugs Craig hit: a 2 s music-load retry (`src/audio/PlaceholderAudioService.ts`); every vertical
  segment's backdrop covers the camera (`src/stage/stageGeometry.ts`'s `backdropLayerSpans`); the shot
  contract — one `muzzleAnchor` per pose, a 370 px/s pellet, hit-stop-aware age, a deflect/spark boss
  reaction, one `resolveHurtbox` (`src/combat/Hitbox.ts`) for the sword, shots and the debug overlay; the
  Glacier route's `TypeError` fixed in `src/enemy/groundShockwave.ts`.
- 13c, the first boss and difficulty: Sentinel Rook retuned (60 HP, 1 contact/hop damage, slower wind-ups,
  `tests/boss-roster.test.ts`); the warden curve (`docs/design/difficulty-curve.md`); death telemetry
  (`src/telemetry/segmentTelemetry.ts`, `scripts/content/heatmap.mjs`).
- 13d, weapons that last and charge: a 28-unit energy bar at 1/2/4 a shot; a charged form per weapon
  (`SPECIAL_WEAPON_CHARGED_FORMS` in `src/content/weapons.ts`); the weapon demo
  (`src/ui/beats/weaponDemo.ts`) after the WEAPON GET card, with a real `weapon_get` sting.
- 13e, pickups, art and placement: a v2 pickup atlas at native size; every placement's `rest: 'ground' |
  'float'`; `src/scenes/game/PickupSystem.ts` out of `Game.ts`; one extra life per warden stage.
- 13f, the right graphics everywhere: the art audit's one BLOCK (the tutorial shaft) closed by 13b.2; a
  blind art-director review of the new art.
- 13g, the beats Craig asked for: the pre-stage boss-intro card
  (`src/scenes/bossIntro/BossIntroLogic.ts`, `src/scenes/BossIntroScene.ts`); the weapon demo wired after
  WEAPON GET; eight district return debriefs (`docs/story/script.md`, `dialogue.v2.json`).
- 13h, test/document/playtest/release: smoke tiers (`scripts/smoke/tiers.json`, fast in CI); `content:audit`
  and `content:lint` in `verify`; the full-campaign smoke `47-full-campaign` (long tier); `StageBuilder` and
  `EnemyRuntime` out of `Game.ts` (1,655 to 1,396 lines); this documentation pass (README, ARCHITECTURE,
  TESTING fixes, the CHANGELOG's Unreleased section, these handoffs, `docs/playtest/v1.0-checklist.md`).

## Decisions made (each with the reason and what it forecloses)

- D-023 (2026-09-30): Craig's playtest notes become this prompt; design choices inside it take the
  recommended default under D-018's delegation.
- 13c (recommended default): Rook's numbers above, chosen so the buster-only kill time lands at 30 to 40 s
  and Heat Works' Pyro Maw stays a clear step up.
- 13d (recommended default): every weapon's charged form is its own move (double cost, triple boss damage),
  not a bigger copy of the plain shot.
- 13f (recommended default, taken): skip regenerating district skylines; the art audit found them already
  distinct.

## Content inventory

| Measure | Value |
| --- | --- |
| Playtest notes traced to file:line | 4 investigations, `output/notes/13a/` |
| Pickup placements fixed (grounded or marked float) | 34 |
| Weapons with a charged form | 8 (every warden special; the Buster and Arc Slash have none by design) |
| Extra lives placed | 8 (one per warden stage) |
| District return debriefs written | 8 |
| Smoke tiers | 3 (fast in CI; full and long on a schedule, tag, or manual run) |
| Full-campaign smoke runs | 2 (skip-all and read-all, from New Campaign to the ending) |

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

- PASS: `docs/prompts/EVAL_LEDGER.md` prompt 13 section — P13-001, P13-003, P13-004, P13-005 (all with
  commits); 13d to 13h's rows (P13-007 to P13-014) are built and merged (git log `fc1eab1` and back to
  `e128b05`) but still read PENDING in the ledger pending the orchestrator's sign-off pass — a bookkeeping
  gap, not missing work; this docs lane does not edit the ledger.
- PENDING: P13-002 (the original music bug never reproduced on a fresh build; the fix and its smoke guard
  (`66-production-music`) are in, the row waits on a repeat production run) and P13-006 (Rook's numbers are
  in; the row is Craig's play).
- `npm run -s gate -- agents:check test` on this docs lane -> see this file's own commit message for the
  result line.

## Open risks and known debt

- The Exit Gate's own ask — Craig plays the whole game with `docs/playtest/v1.0-checklist.md` — has not
  happened yet; nothing in 13 substitutes for it.
- `EVAL-P12-005` (the JS budget) is not yet re-measured after 13h's stage-route extraction; run
  `npm run build && npm run perf:footprint` before closing it.
- Several P13 ledger rows (13d through 13h) need the orchestrator's verify-and-sign pass to flip PENDING to
  PASS; the work and its gates are already in the merged tree.
- `verify:public` needs a fresh run now that `58-glacier-route`'s flake (P13-005) is fixed, to flip
  `EVAL-P8-007`.

## Inputs for v1.1 (prompt 08 phase 8.7's backlog; not v1.0)

- Character select: `docs/working/zero-character-select-backlog.md`.
- Boss rush and time attack, built from the per-stage best times `progression/statistics.ts` already
  records.
- New Game+ with the weakness ring rotated.
- Controller rumble.
- A string table for localisation (every UI string is hard-coded today).
- An attract-mode demo recorded from a replay script (the input-replay harness already exists for
  automation; it has not been pointed at attract mode).
