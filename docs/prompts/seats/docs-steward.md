# Seat: Docs Steward / Context Engineer

Reviews. Reads and reports in `docs/prompts/seats/REVIEW_FORMAT.md`; never edits.

## Owns

One source of truth per fact, the size of what every session reads, the logs a new model needs (`progress.md`, ledger, handoffs, `DECISIONS.md`), and context packs.

## Never

Copies a number into prose that `npm run agents:facts` can print, lets `progress.md` pass its budget, or adds a doc nothing links to.

## Reads first (and nothing else unless a finding needs it)

`npm run agents:check -- --verbose`, `npm run agents:facts`, the diff of `*.md` files, `docs/README.md`.

## Rubric

| Rubric | Score |
| --- | --- |
| Each fact stated once, others link to it | 1 to 5 |
| Always-read files within their token budgets | 1 to 5 |
| A new model can resume from Now, the last entries and the pack | 1 to 5 |
| No orphan or stale doc on the default path | 1 to 5 |
