Seat: game-director
Commit: 9f3497c
Scope: 5.2 combat feel - contact hit-stop, hurt lock, charge-on-press, death sequence, 3-frame min hop, shake cap
Artifacts opened: output/packets/2026-09-231525-game-director.md, output/notes/05a-death.png, output/smoke-runs/2026-09-23T15-20-36-509Z/{9-checkpoint-respawn,13c-unified-player-damage,23-boss-room-respawn,24-ground-sword-enemy,27-boss-sword-hit,3-enter-then-charge-shot} (listing plus 9's state-0.json)
Tokens: 49654 (5 calls; game-director subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | The cited death capture does not show the death sequence: no player, no orbs, no beam-in, no READY; it shows a full-health "Checkpoint 2" respawn toast, so the "death worth watching" claim is unconfirmed from that artifact. | `output/notes/05a-death.png` | Cite the capture the smoke takes mid-freeze, `output/smoke-runs/2026-09-23T15-20-36-509Z/9-checkpoint-respawn/death-burst.png` (22 frames after the death pose sample). |
| MINOR | The fade-out window leaves a 50ms margin before respawn (fadeOutAtMs 650 + fadeOutMs 200 = 850, respawnAtMs 900); the unit test asserts only `<=`, so frame jitter could show the world un-faded before the beam-in. | `src/scenes/game/DeathSequence.ts:724`, `tests/death-sequence.test.ts:800` | Widen the gap to at least 100ms or confirm with a capture near 850ms. |
| MINOR | The hurt-lock blink and the 36/42/65/142 hop curve were judged from code and unit tests, not captures. | `src/player/hitFeel.ts`, `src/player/config.ts:495` | Note as unverified in the handoff; a tap versus 50ms-hold capture side by side closes it. |

Design read: CONTACT_HIT_FEEL grades sword-ground 5, sword-air 4, pellet 2, boss-weakness 8 and Game.ts calls onContactHit only after a confirmed hit; charge-on-press fires the pellet and starts a frame-time clock the same frame; the shake cap and no-stack rule should keep spikes readable, unverified by a double-shake capture.

| Rubric | Score |
| --- | --- |
| A new player reads the screen in two seconds | 3 |
| Controls respond the way the genre expects | 4 |
| Difficulty rises, and deaths are fair and legible | 3 |
| Combat: every hit, weakness and phase change is felt and seen | 4 |

Verdict: FIX (replace the death-sequence evidence with the actual burst capture; the hit-stop, charge and shake design reads correctly from the diff and tests)
