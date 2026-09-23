# 10. The agent system: how models build this game

Active seats: Orchestrator, **Docs Steward / Context Engineer (lead)**, QA / Eval Lead, Principal Game Engineer (writes the scripts), Release Engineer (CI).

Craig builds this game only through models: Claude (Claude Code and claude.ai) and OpenAI (Codex and ChatGPT). This prompt is the system those models work inside: how a session starts, what it reads, how work chains from one session to the next, how helper agents review it, where Craig decides, and which programs check all of it so no model can talk its way past a rule. Part `10a` was built on 2026-09-22 in the same session as prompt 09, reviewed blind by three seats (31 evidenced findings, 2 BLOCK, all acted on: `docs/prompts/handoff/10a-agent-system.md`); `10b` is below.

| Part | What | Evals | STOP asks Craig for |
| --- | --- | --- | --- |
| 10a | checks, facts, context packs, decisions log, seats and review merge, AGENTS/CLAUDE, progress rotation, ledger archive | P10-001 to P10-005 | answer `docs/prompts/DECISIONS.md` |
| 10b | CI enforcement, evidence tied to commits, prompt trims, pack test for every part, retro loop | P10-006 to P10-009 | approve CI enforcement (D-011) |

## 10a: what was built (done 2026-09-22)

Everything in the pattern table below, reviewed blind by three seats and fixed; the list of files and the review resolution are in `docs/prompts/handoff/10a-agent-system.md`. A session that needs to change the system reads that handoff, then the section of this file for the pattern it touches.

## Why (measured 2026-09-22, two read-only audits)

- A kickoff read about 115K tokens of Markdown before touching code: `progress.md` 50K, handoff 01 21K, the ledger 8K, the charter 7K, a prompt 5K, `PLAN_v2.md` 4K, plus `AGENTS.md`'s "read in full" list. A slice needs about 15K.
- Prompt 05 was blocked by its own entry rule: handoff 01 still held the template's `PARTIAL (list what is missing and why)` although its commit said COMPLETE. Nothing noticed.
- 17 of 25 PASS ledger rows had no commit git could resolve; two cited artifacts no longer existed.
- Open questions for Craig were spread over four files (at least eight of them); his replies were recorded for three STOPs.
- Two onboarding paths (`AGENTS.md` and `START.md`) never mentioned each other; there was no `CLAUDE.md`; 13 facts (scene flow, test counts, `Game.ts` lines, bundle claims) disagreed between files.
- Nine seats existed as one table row each; three seat names used in prompts ("Combat Designer", "Narrative Lead", "Designer") were never defined.

## The eight patterns, as this repo does them

| Pattern | Here | Files | Enforced by |
| --- | --- | --- | --- |
| Prompt chaining: each step writes one file, the next reads it | Each slice writes a ledger row, a `progress.md` entry and a commit; each prompt writes a handoff whose "Inputs" the next prompt reads; the chain (which handoff and evals must be done before prompt N) is data | `docs/prompts/handoff/`, `docs/prompts/EVAL_LEDGER.md`, `progress.md`, `tests/agent-budget.json` (`chain`) | `npm run agents:check -- --entry <N>` |
| Orchestrator and workers | One orchestrator session and one writer; review seats run as parallel, blind helpers with narrow scopes | `docs/prompts/seats/`, `.claude/agents/game-*.md`, `scripts/agents/run-seats.sh` | seat briefs say what each reads and never does |
| AI reviewers (LLM-as-judge) | Every seat scores its rubric 1 to 5, grades findings BLOCK, MAJOR or MINOR, and gives a verdict | `docs/prompts/seats/REVIEW_FORMAT.md`, `docs/prompts/reviews/SCORES.md` | `npm run agents:reviews` rejects findings without file:line or artifact evidence and a SHIP verdict with a BLOCK |
| Human checkpoints | STOP blocks with one question and a recommendation; every question is a row in one log; replies pasted verbatim | `docs/prompts/DECISIONS.md` | `npm run agents:check` (decisions) |
| Code checks | Game gates (test, build, smoke, sweep, perf, sprites, dialogue and identity validators) plus the agent-system checks | `scripts/agents/check.mjs`, `scripts/agents/checks.mjs` | `npm run verify` runs `agents:check` first |
| Evals | Game evals in the ledger; evals of the AI system itself: one failing fixture per check rule, review-format fixtures, doc and pack budgets | `tests/agents-checks.test.ts`, `tests/perf-budget.json`, `tests/agent-budget.json` | `npm run test` |
| RAG (fetch the right docs before writing) | A task-to-files map in `AGENTS.md`; the context pack pulls exactly the sections a part needs and lists the files its entry conditions name, with sizes | `scripts/agents/context-pack.mjs` | the pack fails over its token budget |
| Context engineering | Always-loaded `AGENTS.md` (under 150 lines) and `CLAUDE.md`; `progress.md` read as Now plus three entries; numbers printed by a command, never kept in prose | `tests/agent-budget.json` (`docs`), `scripts/agents/facts.mjs`, `scripts/agents/rotate-progress.mjs` | `npm run agents:check` (doc budgets, doc paths) |

## A session, end to end

1. Tool loads `AGENTS.md` (Codex directly, Claude through `CLAUDE.md`).
2. `npm run agents:check -- --entry <N>`: may this prompt start? If not, stop and say which link of the chain is missing.
3. `npm run agents:context -- --part <part>`: read `output/context/<part>.md` (rules, loop, STOP protocol, this part's phases, ledger rows, previous handoff's inputs, open decisions, last progress entries, read-list).
4. Per slice: memo, failing check, change, focused gates, open artifacts, blind seat review (`docs/prompts/seats/README.md`), `npm run agents:reviews`, act on BLOCK and MAJOR, ledger row, progress entry, `npm run agents:check`, commit.
5. At a STOP: the block, a `DECISIONS.md` row, end the turn.
6. At prompt exit: full gates, handoff, `npm run agents:check -- --entry <N+1>` shows the next prompt can start.

## Cross-model use

| Tool | Loads by itself | Starts with | Review seats |
| --- | --- | --- | --- |
| Claude Code | `CLAUDE.md`, which imports `AGENTS.md` | `docs/prompts/START.md` block A | `.claude/agents/game-*.md`, launched together |
| Codex CLI or Codex in ChatGPT | `AGENTS.md` | block A | `scripts/agents/run-seats.sh` (one read-only `codex exec` per seat) |
| ChatGPT or claude.ai without the repo | nothing | block F with the pack from `npm run agents:context -- --part <part> --with-files` | block G pasted into a fresh chat per seat |

Model routing: the orchestrator and the writing seat use the strongest model available; narrow review seats (docs steward, audio, narrative) can run on a faster model because their scope and format are fixed; the code reviewer uses the strongest model. Record the model in every `progress.md` entry and seat review so `SCORES.md` can show later whether a cheaper model reviews as well.

## Logs a new model reads to pick up the work

In this order, stopping when it knows enough: `progress.md` Now, the last three entries, open rows in `docs/prompts/DECISIONS.md`, the context pack, `npm run agents:facts`, `git log --oneline -15`. Every entry names the agent and model, so a new model (or a new version of one) sees who did what and can resume without the history. The archive under `docs/archive/progress/` is for search only.

## Token budgets

| File or read | 2026-09-22 before | After 10a | Budget (`tests/agent-budget.json`) |
| --- | ---: | ---: | ---: |
| `progress.md` | 201KB (~50K tokens) | ~9KB (Now, template, four entries) | 20KB |
| `docs/prompts/EVAL_LEDGER.md` | 33KB | ~14KB (01 to 04 archived; each prompt archives at its exit) | 24KB |
| `docs/prompts/00-orchestrator-charter.md` | 28KB | ~27KB (Definition of Final moved to `PLAN_v2.md`) | 30KB |
| `AGENTS.md` | 5.6KB (plus a "read in full" list of about 60K tokens) | ~7.6KB, self-contained | 150 lines, 12KB |
| Default start of a prompt session | ~115K tokens | `AGENTS.md` + pack for the part (about 20K; `npm run agents:context` prints the number) | pack 30K |

## Personas

Eleven seats in `docs/prompts/seats/` (owns, never, reads first, rubric), shared by every tool: Orchestrator, Principal Game Engineer (also the code reviewer), Game Director (includes combat), Level Designer, Narrative Designer (also "Narrative Lead"), Art Director, Audio Director, QA / Eval Lead, Release Engineer, Performance Engineer (full persona in prompt 09) and the new **Docs Steward / Context Engineer**, who leads this prompt: one source of truth per fact, the size of what every session reads, logs a new model can resume from, and packs that fit.

## Evals for this prompt

| Id | What passes |
| --- | --- |
| EVAL-P10-001 | `npm run agents:check` exists, is part of `verify`, is green, and each of its rules has a failing fixture in `tests/agents-checks.test.ts` |
| EVAL-P10-002 | `npm run agents:context -- --part 05a` holds the phases 5.0 to 5.2, prompt 05's ledger rows, handoff 01's inputs and the open decisions, under 30K tokens |
| EVAL-P10-003 | `progress.md` rotated losslessly (archive byte-identical to the old file plus a header), under budget, with Now and the entry template |
| EVAL-P10-004 | Seats, review format and merge: one real blind review of 10a by at least three seats merged and scored in `docs/prompts/reviews/` |
| EVAL-P10-005 | `AGENTS.md` and `CLAUDE.md` within budget, the stale facts fixed, every backticked path in the core docs resolves, handoff 01 status corrected (D-003) |
| EVAL-P10-006 | (10b) CI runs `npm run agents:check` on every push |
| EVAL-P10-007 | (10b) Evidence tied to commits: smoke, sweep and footprint JSON carry `commit` and `dirty`; `scripts/agents/snapshot-evidence.mjs <EVAL-ID>` copies cited artifacts to `output/evidence/<id>/` and commits `docs/prompts/evidence/<id>.json` with result lines, sha256 and commit |
| EVAL-P10-008 | (10b) Every part of 05 to 08 builds a pack under 30K tokens (a test builds them all); 06 and 08 carry the sections they cite from 02 and 04 instead of reading those files in full |
| EVAL-P10-009 | (10b) Retro at each prompt exit: the docs steward reads `SCORES.md` and the prompt's progress entries and proposes at most one rule change, as a DECISIONS row |

## 10b work order

1. After D-011: add `npm run agents:check` to `.github/workflows/ci.yml` beside test and build.
2. Evidence (planned): add `commit` and `dirty` fields to the smoke, sweep and footprint summaries; write `scripts/agents/snapshot-evidence.mjs`; move the review helpers that PASS rows depend on out of gitignored `output/` into `scripts/review/`.
3. Prompt trims: copy into 06 and 08 the sections of 02 and 04 they cite; add a test that runs the context pack for every part listed in the prompts' top tables and fails over 30K.
4. Retro loop as EVAL-P10-009, first run at prompt 05's exit.

```
### STOP 10b: Enforce
Show: agents:check output, the CI run URL, the pack size for every part, the evidence snapshot for one PASS row.
Question for Craig: make agents:check block merges from now on? Recommended: yes.
```

## Kickoff (paste for 10b)

```
You are the Orchestrator for this repository, acting as the Docs Steward / Context Engineer seat (docs/prompts/seats/docs-steward.md). Follow AGENTS.md. Run npm run agents:check and npm run agents:facts and paste the result lines. Read docs/prompts/10-agent-system.md (the 10b work order) and docs/prompts/DECISIONS.md. This session is part 10b. Stop at STOP 10b.
```
