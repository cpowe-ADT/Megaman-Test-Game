# Handoff 12: Finish the game

## Status: COMPLETE for content and automation gates. Several ledger rows stay PENDING on Craig's play rather than on missing work; prompt 13 (its own handoff) absorbed what 12 left (part 13h) and then polished what Craig played.

Run by Claude Code (Opus 5.5 orchestrating, game-implementer lanes, the full seat roster) from
2026-09-25. The plan is `docs/prompts/12-finish-the-game.md`, written from a six-seat finish audit
(`output/notes/finish-audit.md`). It sequenced the remainder of prompts 05 to 08 as parts 12a to 12i.

## Branch and final commit

Branch `codex/05a-feel-hero-camera` @ `fc1eab1` (the tip this docs pass branched from; 12's own parts land
across many intermediate commits named in the ledger, from `265976f` to `9dde2e9`).

## What changed (by area, with file paths)

- 12a, ship the branch: PR #59 merged with CI browser gates (`.github/workflows/ci.yml`); save migration
  (`src/systems/Save.ts`, `tests/save-migration.test.ts`); the 0.5.0 `CHANGELOG.md` entry.
- 12b, seven missing mechanics: `src/mechanics/` gains `conveyor`, `ice_floor`, `current_zone`,
  `timed_rail_group`, `wind_zone`, `rockfall`, `icicle`; the mechanics lab and smoke 42.
- 12c, the mini-boss roster: `relay_turret_nest`, `sentry_twins`, `drill_serpent`, plus Basalt and Glacier
  skins of `src/enemy/custodianWalker.ts`; `src/content/stages/minibossLab.ts`; smoke 43 and 64.
- 12d, seven warden stages: every district rebuilt to the Heat Works standard through
  `src/content/stages/index.ts` (route smokes 54 to 60).
- 12e, Omega Fortress in three acts: `src/content/stages/omegaFortress.ts`, `src/content/omegaArchive.ts`,
  `src/scenes/game/OmegaActs.ts`, save v6 (`omegaAct`, `rematchCleared`); smoke 61.
- 12f, boss fights: `BossBeats`, `BossDamageRouter`, `HitWires`, `WeaponRuntime`, `BossTelegraphs` out of
  `Game.ts`; thirteen hazard spawners; phase kits and the weakness break (`src/bosses/roster.ts`,
  `src/boss/bossBreak.ts`); eight weapon identities (`src/content/weapons.ts`); smoke 39, 44, 52, 53.
- 12g, story beats: the text pass, five new dialogue triggers, `src/scenes/game/StoryDirector.ts`,
  portraits and the typewriter.
- 12h, audio: `scripts/audio/compose.mjs`, `sfx-synth.mjs`; credits in `assets/audio/credits/README.md`.
- 12i, presentation/difficulty/release: the pixel font, Title/Stage Select art, the beats
  (`src/ui/StageClearCards.ts`), gamepad/remap/touch (D-020, D-021), `npm run build:public`,
  `.github/workflows/deploy.yml`, `npm run package:itch`.

## Decisions made (each with the reason and what it forecloses)

- D-015 (prior): ship the branch by PR rather than a direct push to `main`.
- D-017 (2026-09-24): Craig accepted the rebuilt tutorial/Heat Works as the standard every other stage
  repeats.
- D-018 to D-022 (2026-09-25): delegated finish decisions (go ahead without a per-part STOP; install
  `fontTools`; finish touch controls with an Options toggle; keep OMEGA's "hold" line).

## Content inventory

| Measure | Value |
| --- | --- |
| Stages | 10 (tutorial, 8 wardens, Central Core in 3 acts) |
| Boss fights | 10 (Sentinel Rook, 8 wardens, OMEGA CORE) |
| Mini-boss archetypes | 4 (custodian walker, relay turret nest, sentry twins, drill serpent), 3 palette skins |
| Mechanics | 12 (`src/mechanics/`) |
| Weapons | 9 (Buster plus 8 warden specials); charged forms added in 13d |
| `src/scenes/Game.ts` | 1,396 lines (from 3,704 at prompt 05's start), still `@ts-nocheck` |
| Declared tests | 872 in 153 files (plus 5 boss spec files) — `npm run agents:facts` for the live count |
| Smoke scenarios | 77 registered |
| Sweep missions | 10 |

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

- PASS, archived: `docs/prompts/archive/EVAL_LEDGER-pass-07-08-12.md` (P7-001, P7-002, P7-004, P7-008,
  P7-010; P8-001, P8-002, P8-004, P8-005; P12-001 to P12-004).
- PASS, live: `docs/prompts/EVAL_LEDGER.md` (P6-004, P6-017, P6-018, P6-020 to P6-022; P7-006; P8-006,
  P8-011).
- PENDING, live: the remaining P6 (16), P7 (4), P8 (5) and P12-005 rows, almost all noted "left: Craig
  plays/reviews" rather than unbuilt work; `npm run agents:facts` gives the current split.
- Representative full-tree gates during the batch: `npm run -s gate -- verify` on `9dde2e9` ->
  `PASS verify (448s)`, `# pass 650`, `Smoke test complete: 62 ran`, 0 failed
  (`output/smoke-runs/2026-09-25T07-48-20-983Z`); sweep pass; `footprint: 22/22 within budget`
  (`output/evidence/12-wave4/`).

## Open risks and known debt

- `EVAL-P12-005` (the JS bundle budget): `jsGzipKB` rose from 510 to 545 as stage route data moved inline;
  13h's stage-route extraction is meant to lower it again, and the row stays PENDING until a footprint run
  proves it.
- `EVAL-P6-001` (the level v2 parity snapshot) is proposed for dropping in prompt 13's Exit Gate, since
  stages were rebuilt through the registry instead of converted.
- `src/scenes/Game.ts` is still under `@ts-nocheck`; it shrank by more than half across prompts 05 to 12 but
  is not clean.
- Craig had not played the finished build when prompt 13 opened (his playtest, D-023, is what prompt 13
  answers); most PENDING rows above are his half of the gate, not engineering debt.

## Inputs for prompt 13

- Read `docs/prompts/13-polish-from-playtest.md` and its own handoff
  (`docs/prompts/handoff/13-polish-from-playtest.md`) for what Craig's playtest changed on top of this
  prompt's output.
- Keep `src/scenes/Game.ts` shrinking: the ceiling in `tests/agent-budget.json` goes down with each slice.
- `jsGzipKB` and `distTotalMB` ceilings in `tests/perf-budget.json` carry EVAL-P12-005's debt forward; lower
  them with evidence, never raise them without a ledger row.
- The eight warden weapon ids, stage ids and boss ids named in the content inventory above are the fixed
  vocabulary later docs and code should keep using.
