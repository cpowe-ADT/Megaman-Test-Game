# Eval Ledger archive: prompt 11 (token efficiency)

Moved verbatim from `docs/prompts/EVAL_LEDGER.md` on 2026-09-30 to keep the live ledger under its 24000-byte budget for prompt 13; the PENDING rows stay PENDING here and `npm run agents:check` still reads them.

## Prompt 11: Token efficiency

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| EVAL-P11-001 | gate | `npm run agents:packet` writes a packet (brief, format, scope, diff) and exits 1 over budget naming the largest parts | PASS | `npm run agents:packet -- --seat qa-eval --scope ... --diff HEAD` -> `~22167 tokens (budget 20000)`, exit 1, `largest parts: Diff HEAD ~21412, ...`; a scoped packet with one excerpt and one image -> `~1402 tokens` (`output/packets/qa-eval-2026-09-230110-qa-eval.md` is the over-budget one, written before the exit) | `67d2d34` |
| EVAL-P11-002 | gate | `parseTokens` fixture; `SCORES.md` Tokens column; merges warn over budget | PASS | `tests/agents-checks.test.ts` "parseTokens reads the Tokens header" inside `# pass 291` (`output/gates/test.log`); `merge-reviews.mjs` rewrites the SCORES header with Tokens; `merge-decisions.mjs` warns over `tokens.panelSeat` | `67d2d34` |
| EVAL-P11-003 | gate | every `.claude/agents/*.md` has a `model:` line; runner and implementer exist; README tier tables match | PASS | `grep -h '^model:' .claude/agents/*.md` -> 10 sonnet, 1 opus, 1 haiku; `docs/prompts/seats/README.md` "Model tiers" and the risk-tier table | `67d2d34` |
| EVAL-P11-004 | review | one fast-tier worker run from a task card returns a valid result card | PASS | haiku worker, runner brief, card for `npm run test` and `agents:check` -> `Outcome: DONE`, `# pass 291 # fail 0`, `0 errors, 5 legacy warnings` (`output/runner/test.log`); 7 calls, 57K tokens: the measurement that set the calls-times-context rule and the gate wrapper | `67d2d34` |
| EVAL-P11-005 | review | (11b) first R2 review of 05a with packets: each seat at most 60K tokens and 5 calls, findings evidenced, Tokens in `SCORES.md` | PENDING | | |
| EVAL-P11-006 | gate | a quiet gate wrapper keeps full logs in `output/gates/` and prints one result line per script | PASS | `npm run -s gate -- test agents:check` -> `PASS test (11s): # pass 291 ... # fail 0 (output/gates/test.log)` and `PASS agents:check (0s): agents:check: 0 errors, 5 legacy warnings ...` | `67d2d34` |
| EVAL-P11-007 | gate | (11b) `run-seats.sh --diff` through Codex with `CODEX_MODEL`, merged green | PENDING | | |
| EVAL-P11-008 | review | (11b) 05 exit retro compares Tokens per seat with the 2026-09-22 audit and proposes at most one budget change | PENDING | | |

