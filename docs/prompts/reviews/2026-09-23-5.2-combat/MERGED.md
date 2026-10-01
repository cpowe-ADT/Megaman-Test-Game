# Merged review: 2026-09-23-5.2-combat

Seats: game-director (FIX, mean 3.5), qa-eval (FIX, mean 3.3)

| Severity | Seat | Finding | Evidence | Fix | Agreed |
| --- | --- | --- | --- | --- | --- |
| MAJOR | game-director | The cited death capture does not show the death sequence: no player, no orbs, no beam-in, no READY; it shows a full-health "Checkpoint 2" respawn toast, so the "death worth watching" claim is unconfirmed from that artifact. | `output/notes/05a-death.png` | Cite the capture the smoke takes mid-freeze, `output/smoke-runs/2026-09-23T15-20-36-509Z/9-checkpoint-respawn/death-burst.png` (22 frames after the death pose sample). | AGREED |
| MAJOR | qa-eval | The kill-plane seam test can pass with zero assertions: it returns before any assert when the fixture's stage does not allow fall-off, and the default fixture stage may take that branch. | `tests/game-host-seams.test.ts:367` (early return when the stage does not allow fall-off) | Use a stage id known to allow fall-off, or assert which branch ran so a green run cannot be a silent no-op. |  |
| MINOR | game-director | The fade-out window leaves a 50ms margin before respawn (fadeOutAtMs 650 + fadeOutMs 200 = 850, respawnAtMs 900); the unit test asserts only `<=`, so frame jitter could show the world un-faded before the beam-in. | `src/scenes/game/DeathSequence.ts:724`, `tests/death-sequence.test.ts:800` | Widen the gap to at least 100ms or confirm with a capture near 850ms. |  |
| MINOR | game-director | The hurt-lock blink and the 36/42/65/142 hop curve were judged from code and unit tests, not captures. | `src/player/hitFeel.ts`, `src/player/config.ts:495` | Note as unverified in the handoff; a tap versus 50ms-hold capture side by side closes it. |  |
| MINOR | qa-eval | `assertPelletHitEvidence`'s shot-count expectation for scenario 29 (two presses now give two pellets) was not confirmed in budget. | `scripts/smoke-test.mjs:3211` (`runPelletHitsShortEnemyScenario`) | Confirm the shot-count check matches press-fires-pellet semantics (the full smoke run covers it). |  |
| MINOR | qa-eval | Scenarios 23 and 27 bodies were not opened to confirm each asserts the death sequence or hit-stop independently; aggregate pass status only. | `scripts/smoke-test.mjs:2718`, `scripts/smoke-test.mjs:3584` | Open both bodies in the follow-up. |  |
| MINOR | qa-eval | The death capture was not opened (budget spent on tests and regressions). | `output/notes/05a-death.png` | Visual judgement is the director seat's. | AGREED |

All reviews valid.
