# Merged review: 2026-09-24-5.8-playtest

Seats: game-director (SHIP, mean 4.0), qa-eval (FIX, mean 4.0)

| Severity | Seat | Finding | Evidence | Fix | Agreed |
| --- | --- | --- | --- | --- | --- |
| MAJOR | qa-eval | The toast lane's own too-long guard does not enforce the floor-row limit the fix defines: it throws only when `toastLaneTop() + laneHeight > frameBottom` (248), so a lane up to 187px tall passes silently past the hero and boss floor region (y 190 to 230). `PLAY_OVERLAY_MAX_BOTTOM` is referenced only by the test. A long wrapped radio or hint line can still cover the hero or boss, the class of bug Craig reported. | `src/ui/ToastLane.ts` guard; `src/ui/overlayLayout.ts:15`; `grep -rn PLAY_OVERLAY_MAX_BOTTOM src tests scripts` | Guard on `PLAY_OVERLAY_MAX_BOTTOM`; add a unit case with a multi-line item between 130 and 187px tall that now throws. |  |
| MINOR | game-director | The boss-room "after" state (hero and boss feet under the relocated toast lane) is verified only by test bounds, not a screenshot; the packet's only boss-room image (`b3.png`) is the before shot, where the "Checkpoint 4" toast band starts at the boss's feet. | `output/probes/tutorial-boss/b3.png`; `tests/overlay-layout.test.ts:26-31` | Add a boss-room after-shot (re-probe `tutorial-boss`) so this seat can confirm visually. |  |
| MINOR | game-director | The toast lane fix is verified against a two-line radio item (38px) but not the tallest legal case; the lane's guard throws only past the frame bottom, so a tall wrapped toast could reach y 204, past `PLAY_OVERLAY_MAX_BOTTOM` (160) used for the dialogue panel. | `src/ui/ToastLane.ts:132` guard; `src/ui/overlayLayout.ts:15` | Cap the toast lane at `PLAY_OVERLAY_MAX_BOTTOM` too, or confirm no real toast line reaches that height. |  |
| MINOR | qa-eval | The residual variance ("hero travel 170 to 205px over the same 60 replay frames, not explained yet") is left open; the note cites the red run's commit but not the commit of the two green 40 runs. | `output/notes/05c-5.8.md:13` | Cite the commit in the ledger row for the green 40 evidence. |  |

All reviews valid.

## Second pass (orchestrator, 2026-09-24)

- qa-eval MAJOR and game-director MINOR (lane guard): fixed; the guard is `PLAY_OVERLAY_MAX_BOTTOM` (`src/ui/ToastLane.ts`), and `tests/toast-lane.test.ts` "an item tall enough to reach the floor row is refused" fails on the old guard (`# fail 1`) and passes on the new one (`# pass 381`).
- game-director MINOR (no boss-room after-shot): `output/probes/tutorial-boss-after/b3.png` at 2x WebGL: Rook stands with both feet visible, the hero stands clear, HUD bars drawn (red boss bar), "Checkpoint 4" hangs under the HUD band.
- qa-eval MINOR (commit of the green 40 runs): the two green runs ran on the working tree that became dae3133 (the only later change is the lane guard); cited in the ledger row. The 170 to 205px travel spread stays open for 06.
