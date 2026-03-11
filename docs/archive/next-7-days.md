# Next 7 Days Execution Plan (Feb 13-19, 2026)
- Status: historical
- Owner scope: repo
- Last reviewed: 2026-03-06
- Canonical replacement: `docs/testing/quality-gates.md`, `ARCHITECTURE.md`, `docs/README.md`

## Day 1 - Friday, Feb 13, 2026
- Owner: RL + SET
- Lock Phase 0 gate artifacts and baseline snapshot bundle.
- Verify debug overlay parity (HP/cooldowns/hit events) in one full smoke pass.
- Exit criteria: `npm run verify` green, baseline snapshots stored.

## Day 2 - Saturday, Feb 14, 2026
- Owner: RL + GE
- Complete runtime wiring of unified `HitResolver` behind `VITE_REFACTOR_COMBAT_V2`.
- Add adapter bridge for legacy sprite HP/i-frames into `Combatant` wrappers.
- Exit criteria: combat flag ON/OFF parity smoke checks pass.

## Day 3 - Sunday, Feb 15, 2026
- Owner: CE + GE + SET
- Finish pilot enemy vertical slice (`enemy_gunner_bot`) fully data-driven.
- Validate state transitions (`idle -> windup -> active -> recovery`) with deterministic tests.
- Exit criteria: pilot enemy on v2, all other enemies on legacy/adapter, build runnable.

## Day 4 - Monday, Feb 16, 2026
- Owner: CE + GE
- Convert remaining enemy catalog to generated/validated content pipeline (12 total IDs).
- Wire startup validation fail-fast in dev mode.
- Exit criteria: all 12 enemy configs load/validate and spawn in automated scenario.

## Day 5 - Tuesday, Feb 17, 2026
- Owner: CE + GE + UIE
- Convert one pilot boss end-to-end with phase config and weighted attacks.
- Bind boss HP UI exclusively to v2 combat state for pilot path.
- Exit criteria: pilot boss defeated in manual run + phase tests green.

## Day 6 - Wednesday, Feb 18, 2026
- Owner: CE + GE + SET
- Replace migrated actor animation loading with manifest-driven pipeline.
- Add strict animation manifest key validation and fail-fast diagnostics.
- Exit criteria: migrated player/enemy/boss animation paths run from manifests.

## Day 7 - Thursday, Feb 19, 2026
- Owner: RL + SET + UIE
- Run cleanup gate prep: dead code candidate list, adapter retirement plan, CI gate checklist run.
- Execute full refactor gate and rollback drill (toggle + restore).
- Exit criteria: ready to enter final cleanup phase with documented rollback confidence.
