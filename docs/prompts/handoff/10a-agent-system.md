# Handoff 10a: The agent system

## Status: COMPLETE for 10a. 10b (CI enforcement, evidence tied to commits, prompt trims, retro) is not started; its work order is in `docs/prompts/10-agent-system.md`.

Built by Claude (Opus 5.5) on 2026-09-22 after Craig asked for an agent architecture that is token-efficient, logged so a new model can resume, and built on eight patterns: prompt chaining, orchestrator and workers, AI reviewers, human checkpoints, code checks, evals, RAG and context engineering, for both Claude and ChatGPT/Codex.

## Branch and final commit

Branch `codex/mega-runtime-and-assets-pass`: `0da4f40` (10a), `275a3c0` (fixes from the 10a seat review), then the records commit that adds this file.

## What changed (by area, with file paths)

- Checks: `scripts/agents/check.mjs`, `scripts/agents/checks.mjs` (`npm run agents:check`, first step of `npm run verify`): ledger status words and PASS evidence and commits, handoff contract, prompt-chain entry including OPEN decisions that block it (`--entry N`), `Game.ts` ceiling and the `@ts-nocheck` pragma, byte and line budgets of always-read files, backticked paths in core docs, the decisions log. Budgets and chain rules: `tests/agent-budget.json`.
- Evals of the agent system: `tests/agents-checks.test.ts` (a failing fixture per rule, 16 tests), `tests/music-service.test.ts` (service wiring, mutation-checked).
- Context: `scripts/agents/context-pack.mjs` (`npm run agents:context -- --part <part>`), `scripts/agents/facts.mjs` (`npm run agents:facts`), `scripts/agents/rotate-progress.mjs`.
- Human checkpoints: `docs/prompts/DECISIONS.md` (12 rows, Blocks column).
- Seats and reviews: `docs/prompts/seats/` (11 personas, `REVIEW_FORMAT.md`, README), `.claude/agents/game-*.md` (10 read-only subagents), `scripts/agents/run-seats.sh` (Codex), `scripts/agents/merge-reviews.mjs` (`npm run agents:reviews`), `docs/prompts/reviews/SCORES.md`.
- Entry and logs: `AGENTS.md` rewritten (routing, 14 hard rules, gates, token discipline, task map, logs), `CLAUDE.md` (imports it), `docs/prompts/START.md` (blocks A to G), `progress.md` (Now, template, recent entries; history in `docs/archive/progress/`), ledger rows for 01 to 04 in `docs/prompts/archive/EVAL_LEDGER-01-04.md`, charter amendments and rule 15, `docs/prompts/README.md` as an index, `docs/runbooks/agent-handoff.md`.

## Decisions made (each with the reason and what it forecloses)

- One rules file (`AGENTS.md`) for every tool; `CLAUDE.md` only imports it and adds Claude specifics. Forecloses per-tool rule drift.
- Counts live in commands (`agents:facts`) and budget files, never in prose. Forecloses the stale-fact class the audits found thirteen of.
- Legacy ledger rows (01 to 04) only warn; rules are enforced from prompt 05. Rewriting old evidence was not worth the risk of inventing it.
- Seat briefs are shared files; tool wrappers only point at them. Forecloses Claude and Codex reviewing differently.
- Handoff 01's status was corrected to COMPLETE from its own exit evidence, but prompt 05 stays blocked until Craig answers `D-001` to `D-003`.

## Content inventory

| Item | Count |
| --- | ---: |
| Check groups in `agents:check` | 7 (ledger, handoffs, code budget, doc budgets, doc paths, decisions, entry) |
| Fixture tests for them | 16 |
| Seats | 11 (10 Claude subagent wrappers) |
| Open decisions | 12 |
| Context pack, part 05a | about 11K tokens (budget 30K); every part of 05 to 10 under 12K |
| `progress.md` | 201KB before, about 10KB after |
| Ledger read each session | 33KB before, about 12KB after |

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

EVAL-P10-001 to P10-005 in `docs/prompts/EVAL_LEDGER.md`. The 10a seat review: `docs/prompts/reviews/2026-09-22-10a/MERGED.md` (3 seats, 31 evidenced findings, 2 BLOCK, all FIX), acted on in `275a3c0`.

### Seat review of 10a and what was done (`docs/prompts/reviews/2026-09-22-10a/MERGED.md`)

| Seat and finding | Resolution in `275a3c0` |
| --- | --- |
| docs-steward BLOCK: logs contradict each other, no 09b or 10a entries | entries written, Now names the blockers, START and handoff statuses agree (records commit) |
| qa-eval BLOCK: Phaser gzip ceiling raised 300 to 305 without a row | restored to 300 |
| `--entry 5` passed with D-001..D-003 open | Blocks column; `openBlockers` fails the entry check; fixture |
| Ledger evidence could be any 20 characters; any known sha counted | artifact path and result required; commit must be an ancestor of HEAD; P9-008 fixed |
| Review parser: bold BLOCK dropped, bare backticks counted | severity emphasis stripped, unknown severities fail, evidence must be path:line, artifact or command -> result |
| Failed seats looked clean | `--expect` in the merge, per-PID wait in `run-seats.sh` |
| `@ts-nocheck` matched prose, skipped untracked files, would crash at zero | pragma-only pattern, `--untracked`, exit 1 means none |
| Packs dropped phases (06e/06f, 06h, 5.7, 7.0) and 10b's work order | `partPhases` from the sessions sentence and every listing row; part-named sections; fail when nothing found |
| Footprint dropped missing metrics, ignored hi-DPI errors | missing metric fails, row count checked, hi-DPI errors collected |
| Late-decode eviction untested at the service level | `tests/music-service.test.ts`, fails when the eviction is removed |
| Smoke 40 could pass having inspected nothing | asserts at least one Text inspected |
| rotate-progress broke fences and dropped blank lines; clean-artifacts would trash today's evidence | fence-aware, verbatim; untracked docs honoured, runs under three days kept |
| AGREED by file only; re-merge duplicated scores | same file within ten lines; slice rows replaced |
| WebGL context restore could blank the baked HUD | HUD rebakes on `restorewebgl` |
| Stale counts in charter text the pack injects; step 8 "per slice" vs "per session" | counts point to `agents:facts`; step 8 rewritten |
| `docs/prompts/README.md` stale and marked canonical | cut to an index |

A regression the exit gates caught, not the seats: smoke `34-prologue-flow` advanced dialogue inside the overlay's 160ms debounce once the baked HUD made frames fast (0/3 then 3/3 after waiting 12 frames).

## Open risks and known debt

- `run-seats.sh` has not run: the Codex CLI on this Mac is broken (missing binary). `D-012`.
- CI does not run `agents:check` yet (`D-011`, 10b).
- Evidence under `output/` is gitignored and can be overwritten by the next run; 10b snapshots it per eval.
- Ledger PASS rows before prompt 05 keep their unresolvable commit cells (9 warnings).
- The ledger budget will need the per-prompt archive at each exit (noted in the ledger header).

## Inputs for 10b and for prompts 05 to 08

- Start every prompt with `npm run agents:check -- --entry <N>` and `npm run agents:context -- --part <part>`; paste formats in `docs/prompts/START.md`.
- Every STOP adds a `DECISIONS.md` row; mark `entry <N>` in Blocks when the next prompt depends on it.
- One `progress.md` entry per session in the template, naming the tool and model.
- Run two to four blind seats per slice (`docs/prompts/seats/README.md`), merge with `npm run agents:reviews -- <folder> --expect <seats>`, act on BLOCK and MAJOR.
- At each prompt exit, archive its ledger rows as `docs/prompts/archive/EVAL_LEDGER-<NN>.md` and run `npm run agents:rotate-progress`.
