# Full Game Sprint Plan
- Status: working
- Owner scope: gameplay/presentation/content/refactor
- Last reviewed: 2026-04-23

This plan records the active sprint targets that are being converted into code, tests, content, and docs. It is intentionally working-status until the release gate exists and all phases converge.

## Phase 2 Feel Spec
Current targets are baseline contracts, not final tuning promises. Change them only with trace evidence and updated tests.

| Metric | Current target/source |
| --- | --- |
| Jump velocity | `-420 px/s` from `PLAYER_GAMEPLAY_CONFIG.movement.jumpVelocity` |
| Full-hop gravity | held jump applies `jumpHoldGravityScale: 0.55`, for an effective upward-gravity baseline near `440 px/s^2` |
| No-hold jump estimate | about `110 px` to apex in about `525 ms` under `800 px/s^2` gravity |
| Held full-hop estimate | about `200 px` to apex in about `955 ms`; verify by trace before tuning |
| Short-hop ratio | trace target is no-hold height divided by held height, currently estimated near `0.55` |
| Coyote time | `100 ms` |
| Jump buffer | `100 ms` |
| Dash distance/time | `320 px/s` for `140 ms`, about `45 px` before early-release or wall cancel |
| Dash cooldown | `420 ms` |
| Wall-slide speed | capped at `95 px/s` downward |
| Wall-jump vector | `x: +/-240`, `y: -355`; dash-held boost multiplier `1.28` |
| Projectile cadence | `120 ms` fire-rate gate for buster/special projectile spawn |
| Charge thresholds | `190/390/710/1020 ms` for levels 1-4 |
| Slash windows | ground `6/4/4` frames, air `5/4/4` frames for startup/active/recovery |
| Sword hitstop | ground `5` frames, air `4` frames, plus runtime hitstop events |
| Damage i-frames | `650 ms` |
| Hitstun | light `170 ms`, heavy `280 ms` |
| Knockback | ground `{ x: 165, y: -170 }`, air `{ x: 135, y: -130 }` before facing sign |
| Boss-room safe-entry | default boss room uses `leftInset: 24`, `rightInset: 24`, `playerIntroX: 72`, `bossSpawnX: 352` |

## Phase 2 Trace Contract
`window.render_game_to_text()` now exposes deterministic player feel fields through `newPlayer` and `combatDebug.player`:

- body profile key
- blocked/touching flags
- drop-through active flag
- coyote and jump-buffer timers
- dash remaining/cooldown timers plus dash start/end markers
- wall side and wall-slide state
- last landing speed
- last jump source
- last damage source/tier
- last knockback vector
- last projectile spawn time and frame
- touch button held state

## Evals
- `EVAL-FEEL-001`: `tests/state-snapshot.test.ts` clamps and preserves the new debug trace shape.
- `EVAL-FEEL-002`: `tests/digital-button-pad.test.ts` verifies touch held snapshots do not consume edge state.
- `EVAL-FEEL-003`: `tests/player-motor.test.ts` covers coyote jump, buffered jump, short-hop/full-hop ratio, 30fps/60fps jump-apex tolerance, dash start/end, wall slide, and wall jump baselines.
- `EVAL-FEEL-004`: `tests/player-combat.test.ts` covers projectile cadence, charge thresholds, charge release level, and slash startup/active/recovery windows.
- `EVAL-FEEL-005`: `tests/platform-collision-rules.test.ts` covers one-way/drop-through collision edge cases.
- `EVAL-FEEL-006`: Smoke should be run after automation-hook changes because the payload is browser-facing.

## Risks
- `RISK-FEEL-001`: Jump-height estimates are now backed by deterministic motor simulation, but still need browser-recorded trace artifacts before tuning.
- `RISK-FEEL-002`: Physics still spans `PlayerMotor`, Arcade body state, and scene-level platform collision; Phase 6 should keep those seams narrow instead of creating another monolithic runtime.
