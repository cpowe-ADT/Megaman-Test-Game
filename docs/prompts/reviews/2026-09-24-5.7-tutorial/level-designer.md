Seat: level-designer
Commit: ffda356
Scope: 05b 5.7 the tutorial teaches (EVAL-P5-009): six screens, five room-lock teach segments, checkpoints, dash-gap forcing, shaft readability, armored-bot readability, brief coverage
Artifacts opened: output/packets/05b-5.7-tutorial-level-designer.md; output/smoke-runs/2026-09-24T16-33-00-659Z/49-tutorial-verbs/shot-armed-jump.png; shot-wall-kick.png; shot-armed-charge.png
Tokens: 46927

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| BLOCK | Rook's tutorial_coach dialogue never advances past the dash line: shot-wall-kick.png (two wall faces visible, no dash ledges) and shot-armed-charge.png (armored bot and drone visible, well into segment 4) both show the identical caption "Step two. Burst your thrusters and cover the floor faster than your legs can. The gate listens for the burst." Segments 3 (wall kick) and 4 (charge) never get their own signpost, against the "each segment ... a radio signpost line" promise (docs/design/stage-briefs.md:22). | `output/smoke-runs/2026-09-24T16-33-00-659Z/49-tutorial-verbs/shot-wall-kick.png`, `shot-armed-charge.png` | Re-key onArmed's coach line to the armed room's requiredInput, not a leftover or cached string; assert the lane text per lock in smoke 49. |
| BLOCK | The dash gap does not require a dash. Ledge a ends at x=656, ledge b starts at x=800 (`src/content/campaign.ts:649-650`), a 144px gap. A plain running jump (220px/s, impulse -400, gravity 1050) has air time 2 x (400/1050) = 0.762s and covers about 168px, so it clears the gap without dashing. Only the room-lock's verb check at the closed gate forces a dash tap, unrelated to the platforming. | `src/content/campaign.ts:649-650` (ledge x and width) | Widen the gap past about 170px, or lower a ledge so a plain jump falls short. |
| MAJOR | Missing mid-route checkpoint. The brief puts checkpoint 2 right after the dash segment (`docs/design/stage-briefs.md:509`), but the built checkpoints are x44, x1392 (after the shaft) and x2450 (`src/content/campaign.ts:635-639`). Dying anywhere in jump, dash or the shaft (x0-1344) resets to x44: three teach segments and about 1300px lost. | `src/content/campaign.ts:635-639`; `docs/design/stage-briefs.md:509` | Add a checkpoint near x896-960 (end of the dash room). |
| MAJOR | Enemy roster and secret from the brief are missing. The brief promises 8 placements across gunner_bot (2), shock_hopper (2), drone (2), shield_drone (1), rocket_bot (1) (`docs/design/stage-briefs.md:24,506`); built `enemyMarkers` only has shield_drone, rocket_bot and the charge lock's armored_bot (`src/content/campaign.ts:657-670`). The secret capsule plus hp_refill_large behind the saber wall and the last-screen crumble_group (`stage-briefs.md:22,505`) are absent: `StageExtensionPatch` has no `secrets` field (`campaign.ts:602-610`) and nothing is typed `crumble_group`. | `src/content/campaign.ts:602-610,657-670`; `docs/design/stage-briefs.md:22,24,505,506` | Add the missing enemy markers, a secrets field or room, and a crumble_group patch. (Orchestrator note: prompt 05 §5.7 orders the minimum machinery; the roster, the secret and the crumble group are prompt 06 §6.1 and §6.2 work and are deferred there, recorded in the ledger row.) |
| MINOR | The coach box covers roughly the bottom quarter of the playfield in shot-armed-charge.png, where the armored bot and a flying enemy sit near the ground; with the stale text this hides the "charge only" cue while enemies are already live. | `output/smoke-runs/2026-09-24T16-33-00-659Z/49-tutorial-verbs/shot-armed-charge.png` | Shrink or reposition the coach box, or hold enemy spawn until the line clears. |

| Rubric | Score |
| --- | --- |
| Teach, escalate, master rhythm per stage | 2 |
| Checkpoint spacing and route budget met | 2 |
| Every segment has a reason | 2 |
| Secrets reachable and signposted | 1 |

Verdict: FIX (two BLOCKs: the dash gap is jumpable without dashing, and the coach text does not advance past the dash line for two later segments; plus missing brief content). Not checked (budget): shot-charge.png, shot-gate-blocks.png, shot-saber.png, shot-through.png, and `src/content/campaign.ts` past line 700 for secrets defined elsewhere.
