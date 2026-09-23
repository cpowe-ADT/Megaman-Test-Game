# 11. Token efficiency: lean by default, cheap models do, strong models check

Active seats: Orchestrator, **Docs Steward / Context Engineer (lead)**, QA / Eval Lead, Principal Game Engineer (writes the scripts).

| Part | What | Evals | STOP asks Craig for |
| --- | --- | --- | --- |
| 11a | packets, task and result cards, model tiers, risk tiers, call caps, the quiet gate wrapper, token budgets and the Tokens record | P11-001 to P11-004, P11-006 | nothing (built under the 2026-09-22 delegation) |
| 11b | measure the first packet-based review against the old cost, the Codex tier run, and trimming what the numbers show | P11-005, P11-007, P11-008 | nothing unless a budget must rise |

## What Craig asked for (restated)

Craig builds this game only through models and pays for every token. On 2026-09-22 he asked for three things:

1. **Lean by default.** Every session, review and helper agent spends the fewest tokens that still give a trustworthy result. Spending more needs a named reason: a risky or irreversible change, a release, a finding that needs it, or a change that saves tokens later. The reason is written down.
2. **Agents talk to each other efficiently.** A new agent or subagent never receives the whole session. It gets a short task and the files it needs, and it can pick the work up cold from the repo.
3. **Use cheaper models for work, better models to check.** Mechanical and well-specified work goes to a cheap model; a strong model reviews it or fixes what the cheap one got wrong.

## Audit (2026-09-22, this session's own numbers)

The session that built 09, 10a and the D-001 to D-012 panels showed about 1.1M tokens on Craig's counter for the main session. Its 16 helper agents used about 2.6M more, between 93K and 344K each, with 24 to 87 tool calls each.

| Cause | What happened | Why it costs |
| --- | --- | --- |
| Seats found their own context | Each seat re-read its seat file, the format, the prompt, the diff and the screenshots through tool calls | Every tool call re-sends the whole conversation so far, so 60 calls cost far more than 60 reads |
| One model for everything | Every seat inherited the main session's strongest model | Narrow checks (a ledger row against its artifact) do not need the strongest model |
| Review breadth fixed, not risk-based | Two to four seats per slice, eight on the decision panels, whatever the change | A docs change and a save-format change got the same review |
| Images opened freely | Seats opened many screenshots, then kept working | Each image stays in context for every later call |
| No budget, no record | Nobody wrote down what a review cost | Nothing showed which seat or step was expensive |
| One long main session | 09, 10a, the panels and 11 ran in one session; gate logs were read in full | The context grew until it was compacted, and each step re-sent all of it |

**The cost model this shows.** The token count a tool reports for an agent is roughly its number of calls times the context it carries, because every call re-sends everything read so far. Measured in 11a: a fast-model runner took 7 calls and 57K tokens to run two gates, and a 60-call seat with a growing context reached 300K. The levers are fewer calls, then a smaller context per call, then a cheaper model.

**The audits themselves were sound on quality.** They were blind, run in parallel and evidence-checked, and the 10a review found 2 real BLOCKs. The waste was in how seats gathered context, not in how many findings they produced.

## Design

1. **Cards, not transcripts** (`docs/prompts/seats/BRIEF_FORMAT.md`).
   - The sender writes a task card of at most 200 words: role, goal, what to read, constraints, done-when, return, budget.
   - The worker answers with a result card of at most 300 words: outcome, changed, evidence, open, tokens.
   - Long output goes to `output/` as a path.
   - A new session starts from `progress.md` Now and `npm run agents:context`, never a transcript.
2. **Packets** (`npm run agents:packet`).
   - The sender builds one file per seat once. It holds the seat brief, the answer format, the scope, the diff (lockfiles and images left out, each file's hunks capped) and the line-ranged excerpts. It lists the only images to open.
   - The command fails over 20K tokens and names the largest parts to trim.
   - The seat reads the packet first and opens another file only when a finding needs it.
3. **Model tiers** (`docs/prompts/seats/README.md`, "Model tiers"; the `model:` line in each `.claude/agents/*.md`).
   - fast (`game-runner`, haiku): gates, smoke runs, evidence snapshots.
   - standard (`game-implementer` and ten seats, sonnet): settled slices, R1 and R2 reviews, panels.
   - strong (`game-code-reviewer` and the main session, opus): design, STOPs, R3 reviews and fixes.
   - In Codex, set `CODEX_MODEL` on `run-seats.sh`.
4. **Risk tiers** (`docs/prompts/seats/README.md`):
   - R0 (docs, no behaviour change): gates only.
   - R1 (narrow change with a proving test): `qa-eval`.
   - R2 (player-facing change or new module): `qa-eval` plus the owner.
   - R3 (phase exit, STOP, release, data format or anything irreversible): add the strong code reviewer.
   - A BLOCK raises the tier for the fix's re-review.
5. **Caps on calls, not just words.**
   - Seats read the packet in their first call and use at most 5 calls in all (10 for `game-code-reviewer`); 600 words, 400 on a panel.
   - `game-runner`: 3 calls and 150 words, gates through one `npm run -s gate -- <scripts>` call. `game-implementer`: 30 calls and 300 words.
   - The Codex runner inlines the packet in the prompt (the shell builds it, so no model pays to read it).
   - A worker at its cap returns PARTIAL rather than spending more.
6. **Budgets and a record** (`tokens` in `tests/agent-budget.json`).
   - Budgets: packet 20K (fails), seat review 60K, panel seat 40K, fast worker 20K, standard worker 60K, handoff 3K (these warn).
   - Every review and decision file carries a `Tokens:` line from the tool's usage report.
   - `npm run agents:reviews` records it in `SCORES.md` and warns over budget.
   - Every progress entry has a `Tokens:` line; over a budget, it says why.
7. **Main-session hygiene** (`AGENTS.md` "Token discipline").
   - One prompt part per session.
   - Gates through `npm run -s gate -- test agents:check build`: one result line per script, full logs in `output/gates/`.
   - Read files by range; delegate long runs (smoke, sweep, footprint) to `game-runner` instead of reading their logs.

## 11a: what was built (done 2026-09-22)

- `scripts/agents/review-packet.mjs` (`npm run agents:packet`). It is budget-enforced: the whole uncommitted tree came to about 22K tokens and failed with its largest parts named; a scoped packet came to about 1.4K.
- `docs/prompts/seats/BRIEF_FORMAT.md`: the task-card and result-card protocol.
- The `Tokens:` header in `REVIEW_FORMAT.md` and `DECISION_FORMAT.md`, and `parseTokens` in `scripts/agents/checks.mjs` (with a fixture).
- The `SCORES.md` Tokens column, plus over-budget warnings in `merge-reviews.mjs` and `merge-decisions.mjs`.
- `model:` on all 12 `.claude/agents/*.md`. Two new workers: `game-runner` (haiku) and `game-implementer` (sonnet). Seats read the packet in their first call and stop at 5 calls (10 for the code reviewer).
- `scripts/agents/gate.mjs` (`npm run -s gate -- <scripts>`): runs gates, keeps full logs in `output/gates/`, prints one result line each (`PASS test (11s): # pass 291 | # fail 0`).
- `scripts/agents/run-seats.sh --diff a..b` builds a packet per seat and inlines it in the Codex prompt; `CODEX_MODEL` picks the tier.
- `AGENTS.md` token rules, the START block G prompt (packet-first), the progress template `Tokens:` line, and the risk and model tier tables in `seats/README.md`.

## Evals

| Id | Kind | What passes |
| --- | --- | --- |
| P11-001 | gate | `npm run agents:packet` writes a packet with brief, format, scope and diff, and exits 1 over budget naming the largest parts |
| P11-002 | gate | `parseTokens` fixture passes; `SCORES.md` has a Tokens column; merges warn over budget |
| P11-003 | gate | every `.claude/agents/*.md` has a `model:` line; runner and implementer exist; README tier tables match |
| P11-004 | review | one `game-runner` card run on a fast model returns a valid result card for `npm run test` and `agents:check` |
| P11-005 | review | (11b) the first R2 review of 05a with packets: each seat at most 60K tokens and 5 calls, findings evidenced as before, `Tokens` recorded in `SCORES.md` |
| P11-006 | gate | a quiet gate wrapper writes the full log to `output/gates/` and prints only result lines; the runner brief and `AGENTS.md` use it |
| P11-007 | gate | (11b) `run-seats.sh --diff` runs through Codex with `CODEX_MODEL` once, merged green (after `npm i -g @openai/codex`) |
| P11-008 | review | (11b) the 05 exit retro (`npm run agents:retro`) compares Tokens per seat with this audit and proposes at most one budget change |

## 11b work order

Run 11b inside prompt 05, not as its own session; each item rides on real work:

1. At 05a's first review, measure P11-005.
2. Run the Codex tier (P11-007) when Codex is reinstalled.
3. At 05's exit, run the retro (P11-008).
4. Measure `game-implementer` on its first slice and set `workerStandard` from it (the 60K now is a guess).

If a seat keeps going over budget, narrow its packet before raising the number. Raising a budget needs a ledger row that says why.

## Kickoff (paste for any session from now on)

```
Read AGENTS.md "Token discipline" and docs/prompts/11-token-efficiency.md "Design". Work lean: one prompt part, context pack not full files, gates through npm run -s gate (result lines only). Hand gates to game-runner and settled slices to game-implementer with a task card (docs/prompts/seats/BRIEF_FORMAT.md). Review by risk tier with packets (npm run agents:packet). Record Tokens in every review file and your progress entry; over a budget, say why.
```
