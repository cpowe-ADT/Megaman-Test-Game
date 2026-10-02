# Prompt B: look and sound

Goal: the game looks and sounds as finished as it plays: its own title and ending music, a clean HUD, a full window, bosses with presence and attack poses, living backdrops, distinct sound effects. Briefs: `docs/next/briefs-look-and-sound.md` 1 to 8. Read `docs/next/README.md` first. Art goes through Higgsfield `gpt_image_2` (`docs/content/sprite-imagegen.md`), credited before runtime use (AGENTS.md rule 11); audio is procedural or CC0 only, recorded in `assets/audio/credits/README.md`.

## Steps

1. Cheap wins first, no new art: the HUD and toast clutter (2), window fill (3, read D-010 first), backdrop seams and an ambient particle layer (5, code part).
2. Audio lane: title, ending and game-over music (1), longer stage loops with beds (7), sound-effect identity (8). Loudness and loop-seam checks stay green; decoded audio budgets in `tests/perf-budget.json` hold.
3. STOP B1 for Craig: "Look at Title, a stage, a boss room and the ending at 2x, and listen to the title and one stage. Approve? Recommended: approve." Row in `docs/prompts/DECISIONS.md`.
4. Art lanes (check the Higgsfield balance first; budget the generations named in each brief): boss presence for the Omega Core and Pyro Maw (4), then attack poses per warden (6), then the backdrop regenerations if any (5).
5. Sweep captures per boss and stage, opened and described; a blind art-director review (`game-art-director`) of the new art.

## Evals

Rows `EVAL-P15-001` onward, one per brief, each quoting its "Done when". Exit when every row is PASS or dropped by Craig and the full gates are green, with `perf:footprint` inside budget (raise a budget only with a ledger row).
