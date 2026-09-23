# Handoff 10: The agent system (exit), with 11a

## Status: COMPLETE

Prompt 10 is complete apart from one row: P10-009, the retro proposal, runs at 05's exit by design. 11a (token efficiency) is complete; 11b rides inside prompt 05.

The work was built by Claude (Opus 5.5) on 2026-09-22 and 23. It covers:

- 10a, reviewed in `10a-agent-system.md`.
- The D-001 to D-012 decision panels.
- 10b.
- 11a, done after Craig asked that every agent run be token-lean, that agents hand work over without the session, and that cheap models do the work while strong models check it.

## Branch and final commit

Branch `codex/mega-runtime-and-assets-pass`, PR #58:

- `a4f5386`: UI fixes from the D-001 panel.
- `67d2d34`: the 10b and 11a tooling.
- `577da88`: the decision and ledger records.
- `8605b9f`: the hand-off rule.
- Then the close-out commit that adds this file.

## What changed (by area, with file paths)

- **Decisions:**
  - `docs/prompts/DECISIONS.md`: all twelve are DECIDED by blind seat panels under Craig's delegation.
  - Panel files are in `docs/prompts/reviews/2026-09-22-decisions/` (Round 2 for the D-001 re-review). `npm run agents:decisions` tallies them.
  - The panels' conditions are in the "Panel conditions" section of prompts 05 to 08.
- **UI, from the D-001 panel:**
  - `src/ui/ToastLane.ts`: the radio lane is full width, wraps, and grows upward.
  - `src/ui/HUD.ts` and `src/ui/hudLayout.ts`: RETRY sits below the boss panel.
  - `src/scenes/EndingScene.ts`: the credits footer has its own band.
- **10b:**
  - `.github/workflows/ci.yml` runs `agents:check` with full history.
  - `scripts/lib/provenance.mjs` adds commit and dirty state to the smoke and sweep summaries.
  - `npm run agents:evidence`.
  - `npm run agents:retro`.
  - `tests/context-packs.test.ts`.
- **11a:**
  - `npm run agents:packet`: one budgeted file per seat.
  - `npm run -s gate`: one result line per npm script.
  - `docs/prompts/seats/BRIEF_FORMAT.md`: task and result cards, and hand over files, not the session.
  - `model:` tiers in `.claude/agents/`, plus `game-runner` (haiku) and `game-implementer` (sonnet).
  - Risk tiers R0 to R3 in `docs/prompts/seats/README.md`.
  - `Tokens:` headers and the SCORES column; `tokens` budgets in `tests/agent-budget.json`.
  - The design and audit: `docs/prompts/11-token-efficiency.md`.
- **Smoke:** `SMOKE_ONLY` now takes numeric ids and fails when it matches nothing. It had reported PASS with all 51 scenarios skipped.

## Decisions made

1. **Hand over files, not the session** (`AGENTS.md`, `BRIEF_FORMAT.md`).
   - Why: Codex and ChatGPT cannot read a Claude session, a reviewer who reads it is no longer blind, and every call re-sends it.
   - The rule: what only the session knows goes into a note first, and the card cites the note. A fork that inherits the session needs a reason on the `Tokens:` line.
   - What this forecloses: passing transcripts as a hand-off.
2. **Cap tool calls, not only words.** The measured cost model is calls times context: a fast worker took 7 calls and 57K tokens to run two gates. Seats get 5 calls (10 for the code reviewer), and gates go through `gate`.

## Content inventory

| Kind | Count | Where |
| --- | --- | --- |
| Agent npm scripts | 12 | `agents:check`, `:facts`, `:context`, `:packet`, `:reviews`, `:decisions`, `:rotate-progress`, `:evidence`, `:retro`, `gate`, plus `run-seats.sh` and `snapshot-evidence` via `:evidence` |
| Seats | 11 | `docs/prompts/seats/*.md` |
| Claude agents | 12 | 10 review seats and 2 workers in `.claude/agents/` (1 opus, 10 sonnet, 1 haiku) |
| Answer formats | 3 | `REVIEW_FORMAT.md`, `DECISION_FORMAT.md`, `BRIEF_FORMAT.md` |
| Decisions | 12 | all DECIDED (`docs/prompts/DECISIONS.md`) |
| Token budgets | 6 | `tokens` in `tests/agent-budget.json` |

## Evidence

- Ledger P10-006 to P10-008, P11-001 to P11-004 and P11-006: PASS with commit `67d2d34` (`docs/prompts/EVAL_LEDGER.md`).
- Close-out gate: `npm run -s gate -- verify`: agents:check `0 errors`, test `# pass 291`, build PASS; full smoke did not finish green on this Mac under load (Safari's WebKit GPU process at 100% CPU for two days, Chrome helpers near 70%): `14-completion-return-flow` timed out in verify and `4c-touch-controls` on the rerun, each after 90 to 200s against seconds normally, and both pass alone; the full smoke and sweep run on a clean GitHub runner through CI `browser-gates` (workflow_dispatch) (`output/gates/verify.log`, `output/web-game-smoke/summary.json`).
- Same tree before the docs commits:
  - Sweep 10/10.
  - `footprint: 22/22 within budget, 0 page errors` (`output/gates/`).
  - Focused smoke 6 ran, PASS.
  - Screenshot checked: `output/web-game-smoke/35-radio-ticker/shot-radio-omega.png`. RETRY is below the boss panel, and the OMEGA line is full width and unclipped.

## Open risks and known debt

- **The 5-call seat cap is not yet shown to keep review quality.** P11-005 measures it at 05a's first review. If findings drop, raise that seat's cap rather than go back to open-ended reviews.
- **The `game-*` project agents did not appear in this session's agent list.** The runner ran as general-purpose on haiku with the brief on its card. The first thing 05a checks is that they appear in a fresh session; the fallback works for every seat.
- **`workerStandard` (60K) is a guess** until `game-implementer` runs one slice.
- **Codex is still broken on the Mac** (`npm i -g @openai/codex`), so P11-007 and `run-seats.sh` are unproven.
- **CI `browser-gates` (manual run) is red for two known reasons.** It ran for the first time on 2026-09-23 (run 35826809506). Smoke `4-title-controls` fails on Linux system fonts, which 8.2's bundled font fixes. The sweep finished its artifacts, but Chromium took more than 5s to close on the runner (`hung_after_artifacts`). `test-and-build` (agents:check, test, build) is green on push and PR.
- **Cold starts:** smoke run with `SMOKE_ONLY` straight after a sweep can time out on a cold Vite start. A rerun passes.

## Inputs for prompt 05

- Start with `npm run agents:check -- --entry 5` (passes).
- Then `npm run agents:context -- --part 05a`, and the kickoff in `docs/prompts/11-token-efficiency.md`.
- Honour the "Panel conditions" section in `docs/prompts/05-feel-hero-and-camera.md`.
- Review by risk tier with packets. Record `Tokens:` in every review file and in the progress entry.
- Craig's own steps: `git gc`, `npm run clean:artifacts -- --yes` after a dry run, the Codex reinstall, and the external archive of superseded source sheets.
