# AGENTS.md: rules for every agent in this repository

`OMEGA Relay` is a Phaser 3 + TypeScript + Vite action platformer built entirely by AI agents (Claude Code, Codex, ChatGPT) for Craig, who plans, reviews at STOPs and plays; he does not write code. This file is read automatically by Codex and imported by `CLAUDE.md`, so it is the one place for rules. Keep it under 150 lines (`npm run agents:check` enforces it).

## Start of a session: read only this much

1. `progress.md`: the **Now** block and the last three entries. Never the archive unless a question needs history (`grep -n` it).
2. Running a prompt from `docs/prompts/` (a work order such as `05-feel-hero-and-camera.md`): run `npm run agents:check -- --entry <N>`, then `npm run agents:context -- --part <part>` and read `output/context/<part>.md` instead of the whole charter, prompt, ledger and log. Paste formats are in `docs/prompts/START.md`.
3. Any other task: the row for your area in "Where things are" below, and nothing else until the task needs it.
4. Numbers (tests, scenarios, `Game.ts` lines, open decisions, the latest footprint run): `npm run agents:facts`; budgets live in `tests/perf-budget.json` and `tests/agent-budget.json`. A count written in prose is stale by definition.

## Hard rules

1. One writer: the Principal Game Engineer seat edits code; review seats read and report (`docs/prompts/seats/`).
2. Never claim a gate passed without pasting its result line and the artifact path. Open the screenshots you cite and say what you saw.
3. The tree may be dirty: inspect before editing, preserve unrelated changes, never revert work you did not make. Stop and ask if files change under you.
4. No new `@ts-nocheck`. `src/scenes/Game.ts` only shrinks: the ceiling in `tests/agent-budget.json` goes down with each slice, never up. New systems are typed modules under `src/`; `Game.ts` gains calls, not logic.
5. Keep Phaser objects at adapter edges; pure logic gets unit tests that run without a scene.
6. Layout in game pixels (`GAME_SIZE`, `GAME_WIDTH`, `GAME_HEIGHT` from `src/config/renderPolicy.ts`). `scene.scale.width/height` are canvas pixels (448 x render scale) and put UI off screen.
7. Public names come from `src/content/identity.ts`. Nothing ripped from Capcom ships in the public build; the private skin is developer-only.
8. Dialogue never grants rewards, writes completion flags, kills bosses or changes scenes; skip and full-read converge on the same state.
9. The automation contract (`window.render_game_to_text`, `window.advanceTime` as an animation-frame wait, `?automation=1`, `stageDebug`, `bossDebug`) changes only with `scripts/` and `TESTING.md` in the same commit.
10. Assets load per scene with a stated eviction rule (music per cue, backgrounds per stage), never all in `Preload`. Keep `npm run perf:footprint` green; lower budgets in `tests/perf-budget.json`, never raise them without a ledger row.
11. Every asset gets source, author, licence and path recorded before runtime use.
12. At a STOP: one question with your recommended answer, a row in `docs/prompts/DECISIONS.md`, then stop and wait. Never answer Craig's decision yourself.
13. Record as you go: a ledger row per eval (a PASS cites a commit git knows), one `progress.md` entry per session in its template, a handoff at prompt exit. `npm run agents:check` must pass before every STOP and commit.
14. Commit small, name the slice and eval id, end with your tool's attribution line. Push or tag only when Craig asks.

## Gates (pick the smallest truthful set, then escalate)

| Change | Run |
| --- | --- |
| Docs, prompts, seats, logs | `npm run agents:check`, `npm run test` |
| Pure logic, content, save rules | `npm run test` |
| TypeScript, runtime wiring, loaders | `npm run test`, `npm run build` |
| Scene flow, input, UI, automation hooks | add `npm run test:smoke` (or `SMOKE_ONLY=<names>` while iterating) |
| Sprites, atlases, stage visuals, bosses | add `npm run test:visual-sweep` |
| Loading, audio, render scale, per-frame loop | add `npm run build` then `npm run perf:footprint` |
| Before a STOP that closes a phase, and at prompt exit | `npm run verify` (agents:check, sprites, test, build, smoke) plus the sweep |

Details and scenario names: `TESTING.md`. Merge blockers: `docs/testing/quality-gates.md`.

## Token discipline (context is a budget)

- Read ranges, not whole files: `grep -n`, `sed -n 'a,bp'`, offset reads. Anything over 20KB is read by section.
- Prefer the context pack over the charter, prompt, ledger and log in full. Do not re-read a file you just edited.
- Review seats and helper agents answer in at most 600 words with evidence, never file dumps (`docs/prompts/seats/REVIEW_FORMAT.md`).
- Budgets for the files every session reads live in `tests/agent-budget.json`; `npm run agents:check` fails when one grows past its budget. When it does, rotate or move text, do not raise the budget.
- `npm run agents:rotate-progress` moves old log entries to `docs/archive/progress/` when `progress.md` grows.
- **Lean by default.** Spend more only for a risky or irreversible change, a release, a finding that needs it, or a change that saves tokens later; say which in the progress entry's `Tokens:` line. Budgets per run are `tokens` in `tests/agent-budget.json`; the design is `docs/prompts/11-token-efficiency.md`.
- **Hand over files, not the session.** Send a task card and a packet (`docs/prompts/seats/BRIEF_FORMAT.md`, `npm run agents:packet`); the agent answers with a result card. Reviews and panels never see the session: blindness is what keeps them honest. If a worker would need the transcript to continue, the repo is missing a note: write it (progress Now, the handoff, or `output/notes/<slice>.md`) and put its path on the card. Follow-ups go to the same agent (it keeps its own, smaller context); a fork that inherits the whole session is the exception, named in the `Tokens:` line. A new session starts from `progress.md` Now and `npm run agents:context`, not a transcript.
- **Cost is calls times context.** Every tool call re-sends everything read so far: run gates with `npm run -s gate -- test agents:check build` (one result line each, logs in `output/gates/`), batch commands, and cap an agent's calls on its task card.
- **Cheap does, strong checks.** Mechanical work goes to `game-runner` (fast tier), settled slices to `game-implementer` (standard), and review depth follows the risk tier in `docs/prompts/seats/README.md` (R0 none to R3 three seats with the strong code reviewer).

## Where things are (read the row for your task)

| Task | Start with |
| --- | --- |
| Movement, combat feel, player | `src/player/`, `tests/player-motor.test.ts`, `tests/player-combat.test.ts` |
| Enemies | `src/enemy/`, `docs/working/enemy-ecology-and-variant-plan.md` |
| Bosses | `src/boss/`, `src/bosses/`, `docs/architecture/boss-framework.md` |
| Stages and campaign content | `src/content/campaign.ts`, `docs/design/stage-briefs.md` |
| Story and dialogue | `docs/story/story-bible.md`, `docs/story/script.md`, `src/content/dialogue/` |
| Menus, HUD, rendering, scale | `src/ui/`, `src/scenes/`, `docs/architecture/rendering.md` |
| Audio | `src/audio/`, `assets/audio/credits/README.md` |
| Art pipeline | `docs/content/sprite-imagegen.md`, `scripts/sprites/` |
| Save and progression | `src/systems/Save.ts`, `src/progression/` |
| Automation, smoke, sweep | `TESTING.md`, `scripts/smoke-test.mjs`, `scripts/smoke/`, `scripts/mission-visual-sweep.mjs` |
| Performance and disk | `docs/prompts/09-footprint-and-performance.md`, `scripts/perf/`, `tests/perf-budget.json` |
| Agent system, prompts, seats, logs | `docs/prompts/10-agent-system.md`, `scripts/agents/`, `docs/prompts/seats/README.md` |
| Architecture overview | `ARCHITECTURE.md`; full index `docs/README.md` |

Scene flow: `Boot` -> `Preload` -> `Title`, then `NewCampaign`, `Prologue`, `StageSelect`, `Game`, with `SystemMenu` (pause and route console), `Options`, `Controls`, `GameOver`, `ProgressionSummary` and `Ending` (all registered in `src/main.ts`).

## Logs a new model reads to pick up the work

| Log | Holds | Written |
| --- | --- | --- |
| `progress.md` | Now, and one entry per session (who, which model, what changed, gates, open) | every session |
| `docs/prompts/EVAL_LEDGER.md` | one row per eval with evidence and commit | every slice |
| `docs/prompts/handoff/` | one file per finished prompt; the next prompt's inputs | prompt exit |
| `docs/prompts/DECISIONS.md` | every question for Craig, his replies verbatim | every STOP |
| `docs/prompts/reviews/` | blind seat reviews, `MERGED.md`, `SCORES.md` | every seat review |
| `git log` | commits naming slices and eval ids | every slice |

## Environment

macOS: no GNU `timeout`; scope long runs with `SMOKE_ONLY`, isolate parallel runs with `SMOKE_PORT` and `SWEEP_PORT`. `npm run test` takes seconds, the sweep a few minutes, full smoke six to ten. Port 5173 can be taken by a Docker container on Craig's Mac: Vite then picks the next port, and the Claude browser pane has `omega-relay-dist` (the production build on 4180) in `.claude/launch.json`. The pane pauses Phaser while hidden. Python sprite scripts run through `.venv/bin/python`.
