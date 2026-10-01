Seat: qa-eval
Commit: dae3133
Scope: 5.8 playtest fixes (HUD bars under WebGL, TARGET label, panel and lane position) per EVAL-P5-011; regression hunt across Stage Select dialogue, boss-fight lane, HUD after restore, toast-lane guard.
Artifacts opened: output/smoke-runs/2026-09-24T18-21-25-047Z/40-hd-render/hud-bar-compare.json, camera-2x.json, shot-2x.png; output/smoke-runs/2026-09-24T18-15-57-142Z/summary.json, 49-tutorial-verbs/briefing-panel.json; src/config/gameplayLayout.ts, src/config/renderPolicy.ts; src/ui/overlayLayout.ts, tests/overlay-layout.test.ts, src/ui/ToastLane.ts
Tokens: 60657

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | The toast lane's own too-long guard does not enforce the floor-row limit the fix defines: it throws only when `toastLaneTop() + laneHeight > frameBottom` (248), so a lane up to 187px tall passes silently past the hero and boss floor region (y 190 to 230). `PLAY_OVERLAY_MAX_BOTTOM` is referenced only by the test. A long wrapped radio or hint line can still cover the hero or boss, the class of bug Craig reported. | `src/ui/ToastLane.ts` guard; `src/ui/overlayLayout.ts:15`; `grep -rn PLAY_OVERLAY_MAX_BOTTOM src tests scripts` | Guard on `PLAY_OVERLAY_MAX_BOTTOM`; add a unit case with a multi-line item between 130 and 187px tall that now throws. |
| MINOR | The residual variance ("hero travel 170 to 205px over the same 60 replay frames, not explained yet") is left open; the note cites the red run's commit but not the commit of the two green 40 runs. | `output/notes/05c-5.8.md:13` | Cite the commit in the ledger row for the green 40 evidence. |

Verified: `hud-bar-compare.json` barDrawn 38/38, barSame 30/38 as claimed; `shot-2x.png` shows filled bars, `TARGET • PYRO MAW`, `BOSS GATE AHEAD`, hero visible; `briefing-panel.json` panel.bottom 149 <= player.y - 24 = 190; `summary.json` at 18-15-57-142Z matches "5 pass, 40 failed"; Stage Select keeps the bottom panel and the unit test locks it.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 4 |
| Failing check existed before the fix | 5 |
| Artifacts opened and described | 4 |
| No regression in scenarios outside the slice | 3 |

Verdict: FIX (the toast-lane guard gap is a real path back to the bug this slice fixes)
