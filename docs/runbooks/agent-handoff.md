# Agent Handoff Runbook
- Status: canonical
- Owner scope: repo
- Last reviewed: 2026-09-22

## Canonical handoff files
`progress.md` is the rolling log: a **Now** block and one entry per session. Prompt-level handoffs live in `docs/prompts/handoff/`, questions for Craig in `docs/prompts/DECISIONS.md`, evals in `docs/prompts/EVAL_LEDGER.md`. `AGENTS.md` ("Logs a new model reads") is the authority; this runbook only expands the how.

## Read before you edit
1. `progress.md`: Now and the last three entries. The history before 2026-09-22 is in `docs/archive/progress/`; search it, do not read it whole.
2. For prompt work, `npm run agents:context -- --part <part>` instead of the charter, prompt, ledger and log in full.
3. `npm run agents:facts` for any number.

## What to add at the end of a session
One entry in the template at the top of `progress.md` (at most 1.5KB): date, part or task, your tool and model, what changed with paths, gate result lines with artifact paths, decision ids raised or answered, what is open. Update **Now** if the next step changed. Then `npm run agents:check`; if `progress.md` is over budget, `npm run agents:rotate-progress`.

## Good entry characteristics
- Specific file and system names; truthful command outcomes pasted as result lines.
- Completed work separated from suggestions; decisions for Craig go to `DECISIONS.md`, not only into the entry.
- No copies of architecture or counts; link the canonical doc or the command.

## Do not use `progress.md` for
Long-form specs, plans without an owner, or replacing `TESTING.md`, `CONTRIBUTING.md` and the prompt package.
