Seat: game-director
Commit: dae3133
Scope: 5.8 playtest fixes (HUD bars under WebGL, overlays off the floor row, TARGET label), EVAL-P5-011, readability judged from packet screenshots and diff.
Artifacts opened: output/packets/2026-09-241824-game-director.md, output/probes/tutorial-start/t04.png, output/smoke-runs/2026-09-24T18-15-57-142Z/49-tutorial-verbs/shot-briefing.png, output/smoke-runs/2026-09-24T18-15-57-142Z/49-tutorial-verbs/shot-armed-jump.png, output/smoke-runs/2026-09-24T18-21-25-047Z/40-hd-render/shot-2x.png, output/probes/tutorial-boss/b3.png
Tokens: 41375

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MINOR | The boss-room "after" state (hero and boss feet under the relocated toast lane) is verified only by test bounds, not a screenshot; the packet's only boss-room image (`b3.png`) is the before shot, where the "Checkpoint 4" toast band starts at the boss's feet. | `output/probes/tutorial-boss/b3.png`; `tests/overlay-layout.test.ts:26-31` | Add a boss-room after-shot (re-probe `tutorial-boss`) so this seat can confirm visually. |
| MINOR | The toast lane fix is verified against a two-line radio item (38px) but not the tallest legal case; the lane's guard throws only past the frame bottom, so a tall wrapped toast could reach y 204, past `PLAY_OVERLAY_MAX_BOTTOM` (160) used for the dialogue panel. | `src/ui/ToastLane.ts:132` guard; `src/ui/overlayLayout.ts:15` | Cap the toast lane at `PLAY_OVERLAY_MAX_BOTTOM` too, or confirm no real toast line reaches that height. |

Verified: `t04.png` (before) the panel hides the hero at the spawn; `shot-briefing.png` (after) the panel hangs from the HUD band and ends well above the hero on the floor. `shot-armed-jump.png`: `JUMP: SPACE` sits under the HUD band; hero, floor, spikes and the two platforms for the jump are unobstructed. `shot-2x.png`: player and weapon bars drawn as filled segments at 2x; `TARGET • PYRO MAW` mid-stage before the fight. `BOSS GATE ADVANCE` became `BOSS GATE AHEAD`, `BOSS • SENTINEL ROOK` became `TARGET • SENTINEL ROOK` before the encounter.

| Rubric | Score |
| --- | --- |
| A new player reads the screen in two seconds | 4 |
| Controls respond the way the genre expects | 5 |
| Difficulty rises, and deaths are fair and legible | 3 |
| Combat: every hit, weakness and phase change is felt and seen | 4 |

Verdict: SHIP (the playtest complaints, hidden hero at spawn, blank HUD under WebGL, ambiguous BOSS label pre-fight, are each shown fixed in the after screenshots; the two MINORs are coverage follow-ups, not regressions)
