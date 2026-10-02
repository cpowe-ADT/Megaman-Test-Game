# Prompt A: feel and challenge

Goal: fights that feel like classic Mega Man and X (short, readable, a weakness that matters), deaths that cost something, enemies and weapons that make each district its own. Briefs: `docs/next/briefs-gameplay.md` 1 to 8, `docs/next/briefs-story-ux.md` 4 and 5. Read `docs/next/README.md` first.

## Steps (one lane each, in this order; parallel where the file sets differ)

1. Measure before tuning (gameplay 8, then 1): a replay bot over all ten stages on three difficulties writes telemetry; a scripted fight bot measures buster, saber and weakness kill times per boss. Commit the numbers in `docs/design/difficulty-curve.md`.
2. Boss pacing (gameplay 1): retune boss HP and cadence to a rising warden ramp, a weakness kill inside one 28-unit bar, Rook unchanged. Veteran harder, not longer (gameplay 6).
3. STOP A1 for Craig: "Play Heat Works and the Weather District boss. Do the fights feel right? Which death rule (gameplay 2)? Recommended: a game over loses the attempt's unbanked pickups." Add the row to `docs/prompts/DECISIONS.md`.
4. The death rule he picks (gameplay 2) and the game-over screen (story-ux 4).
5. Enemy attack contracts (gameplay 5), then one signature enemy per warden stage (gameplay 3, Higgsfield art).
6. Weapon gates that open routes (gameplay 4), and Stage Select's "where next" (story-ux 5).
7. The rematch gauntlet length (gameplay 7) after Craig plays the Central Core.

## Evals

Add rows `EVAL-P14-001` onward to `docs/prompts/EVAL_LEDGER.md` as each step starts, one per brief, quoting its "Done when". Exit when every row is PASS or dropped by Craig, `npm run verify`, the sweep and `perf:footprint` are green, and `47-full-campaign` (long tier) still passes both runs equal.
