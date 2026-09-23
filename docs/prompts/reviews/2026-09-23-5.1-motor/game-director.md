Seat: game-director
Commit: c47fc38
Scope: 5.1 motor truth - judge X-series feel (dash-jump carry, dash timing, wall-kick grace, jump cut arc, ledge forgiveness, crouch stop) and fairness against the existing rooms (one-screen corridors, 8px platforms, floor spikes)
Artifacts opened: output/packets/2026-09-231422-game-director.md, output/notes/05a-5.1-constants.md (via packet), output/smoke-runs/2026-09-23T14-20-33-102Z/13d-movement-feel/dash-traces.json, output/smoke-runs/2026-09-23T14-20-33-102Z/13d-movement-feel/shot-0.png
Tokens: 41850 (4 calls; game-director subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | Hop height is nonlinear in the first 80ms of a hold: a tap gives about 17px, an 80ms hold about 43px, 140ms 66px, full hold 147px. One frame of release timing near takeoff can more than double clearance, exactly the precision window the spike-floor corridors need. | `output/notes/05a-5.1-constants.md:14-15` | Floor the early cut: ignore release for the first 2 to 3 physics frames, or use a softer cut velocity than -140 near takeoff, so short-hop height scales predictably with hold time. |
| MINOR | The simulated arc overshoots the spec by 10 to 13% (full hold 147px vs about 130; 140ms 66px vs about 60); the note flags the explicit-Euler sim as a few px high; not yet confirmed in Arcade. | `output/notes/05a-5.1-constants.md:12-13` | Run the release-timing sweep against the live scene through 13d and record the in-engine numbers beside the simulated ones. |
| MINOR | Dash cooldown 60ms from the dash end gives a 340ms cycle, near-continuous dashing; not checked against warden-room hazard timing in this pass. | `output/notes/05a-5.1-constants.md:16-17` | A hazard-timing trace in a warden room before calling it final (prompt 06 retunes hazards anyway). |

No-flag evidence: `dashJumpTrace` holds vx 320 from takeoff (frame 3) through apex (frame 21); the cut fires on release (vy -381.9 to -140 in one step at frame 7); `dragState` shows dragX 0 and allowDrag false; wall-jump launch vx -353.28 matches the smoke assertion; shot-0.png shows a legible HUD and no new clutter.

| Rubric | Score |
| --- | --- |
| A new player reads the screen in two seconds | 4 |
| Controls respond the way the genre expects | 4 |
| Difficulty rises, and deaths are fair and legible | 3 |
| Combat: every hit, weakness and phase change is felt and seen | 5 |

Verdict: FIX (the tap/short-hop nonlinearity is a real fairness risk against spike floors; carry, cut trigger, drag removal and wall-jump check out against the trace)
