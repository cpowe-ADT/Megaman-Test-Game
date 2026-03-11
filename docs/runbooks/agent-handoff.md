# Agent Handoff Runbook
- Status: canonical
- Owner scope: repo
- Last reviewed: 2026-03-06

## Canonical Handoff File
`progress.md` is the canonical rolling handoff log. Do not replace it with another running status file.

## Read Before You Edit
1. Read the original prompt at the top of `progress.md`.
2. Read the latest session entries and remaining TODOs.
3. Cross-check with `docs/README.md` so you know which docs are canonical versus historical.

## What To Add At End Of Session
Append concise bullets covering:
- what changed,
- why it changed,
- commands run and whether they passed,
- known follow-up work or debt,
- any automation-hook or test-surface changes.

## Good Entry Characteristics
- Specific file/system names when needed.
- Truthful command outcomes.
- Clear distinction between completed work and suggested next steps.
- No duplication of full architecture docs; link the next agent to canonical docs instead.

## Do Not Use `progress.md` For
- long-form architecture specs,
- replacing canonical testing or contribution docs,
- speculative plans without action or ownership context.
