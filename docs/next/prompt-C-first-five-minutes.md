# Prompt C: the first five minutes

Goal: a new player on a phone or a keyboard always knows what to press and where to go, never loses a run by accident, and feels the story's one big beat. Briefs: `docs/next/briefs-story-ux.md` 1, 2, 3, 6, 7, 8. Read `docs/next/README.md` first. Dialogue rules: never grant rewards or change state from dialogue; skip and full read converge (AGENTS.md rule 8).

## Steps

1. Device-aware hints through a string table (1): one `hintFor(action, device)` module, every hint site converted; this seeds the v1.1 string table.
2. Tutorial hints that return after idle at an armed lock (2).
3. A confirm before the Title's clear-run, and a plain-English footer (3).
4. Secrets that read: a crack or shimmer on breakable walls, one secret hint per briefing (7).
5. The WREN beat: a short blocking offer and refusal at the Core's phase break with one earlier foreshadow line (6); a narrative seat (`game-narrative-designer`) reviews the lines blind.
6. STOP C1 for Craig: "Cold-boot on your phone and tick `docs/playtest/v1.0-checklist.md` (8); read the WREN beat. Anything to fix? Recommended: fix what the sheet reports." Row in `docs/prompts/DECISIONS.md`.

## Evals

Rows `EVAL-P16-001` onward, one per brief. Exit when every row is PASS or dropped by Craig, the gates are green, smoke `67-touch-mode` and `47-full-campaign` pass, and Craig has ticked the checklist.
