Seat: level-designer
Commit: bf3b51a
Scope: 05b 5.7b tutorial fix (EVAL-P5-009): confirm the two BLOCKs closed (dash gap 216px plus a plain-jump test; coach line per lock) and the dash-exit checkpoint at x 928; judge the captures
Artifacts opened: output/packets/05b-5.7b-tutorial-fix-level-designer.md; output/smoke-runs/2026-09-24T16-50-54-904Z/49-tutorial-verbs/shot-shaft-coach.png, shot-armed-charge.png, shot-wall-kick.png, shot-gate-blocks.png
Tokens: 29602

Both BLOCKs and the checkpoint MAJOR are closed with evidence:

- Dash-gap BLOCK closed. `tutorial_dash_ledge_a` (x540, w80) right edge 580, `tutorial_dash_ledge_b` (x836, w80) left edge 796: gap 216px (`src/content/campaign.ts:652-653`). `tests/tutorial-layout.test.ts:14-32` computes `flatJumpRange` from the real `PLAYER_GAMEPLAY_CONFIG` for both run speed and dash speed, and asserts a plain jump plus body allowance falls short of 216px while the dash jump clears it, and that the gap sits inside the dash room's lock bounds. A genuine regression guard.
- Coach-line BLOCK closed. shot-gate-blocks.png (jump room): "Step one. Clear the step ahead. The gate reads your stride, not your file." shot-shaft-coach.png (wall-kick room, two wall faces visible in the tall shaft): "Step three. Two wall faces, one shaft. Kick off each face until you reach the top." shot-armed-charge.png (charge room, armored bot on screen): "Step four. That frame is armored. Hold your buster until it sings, then let it go." Three distinct lines for three distinct locks.
- Checkpoint MAJOR closed. `checkpoint('tutorial_dash_exit', 928, 40, 912)` sits right after the dash room's gate (896), confirmed by `tests/tutorial-layout.test.ts:35-40`. Dying in jump or dash no longer costs the shaft.

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MINOR | shot-wall-kick.png, despite its name, shows Director Iona Vale's line ("Rook's record is clean, WREN...") over a flying enemy, not a tutorial_coach line; the capture no longer demonstrates what its name promises. | `output/smoke-runs/2026-09-24T16-50-54-904Z/49-tutorial-verbs/shot-wall-kick.png` | Rename or re-point that capture so it shows the wall-kick coach text for the next reviewer (prompt 06 handoff row). |
| MINOR | The coach box still covers roughly the bottom quarter of the frame in shot-armed-charge.png with the armored bot standing just above it (same as the first pass, not new). | `output/smoke-runs/2026-09-24T16-50-54-904Z/49-tutorial-verbs/shot-armed-charge.png` | Deferred with the lane size (06 handoff). |

Enemy roster, secret and crumble group remain deferred to prompt 06 per the orchestrator; not re-scored down for that.

| Rubric | Score |
| --- | --- |
| Teach, escalate, master rhythm per stage | 4 |
| Checkpoint spacing and route budget met | 4 |
| Every segment has a reason | 4 |
| Secrets reachable and signposted | 2 |

Secrets score note: deferred to prompt 06, nothing built yet.

Verdict: SHIP (both BLOCKs and the checkpoint MAJOR are closed with a real test and matching captures; the remaining gaps are prompt 06 scope)
