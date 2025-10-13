# Boss Fire Probe

This probe scene validates that the boss projectile pipeline still produces at least one shot under normal conditions. It runs twice: once with the `BossController` event path enabled and once using the legacy fire loop.

## Running locally

```
npm install
npm run assets:check
npm run probe:boss        # controller + legacy checks without diagnostics
npm run probe:boss:diag   # same probe with DIAGNOSTICS instrumentation enabled
npm test                  # unit tests for cooldown and pattern helpers
```

### Interpreting probe output

- `passed=true` and `shots>0` mean at least one projectile spawned within three seconds.
- `suspects` hints at the most likely failure root cause:
  - `no_events`: no boss attack events observed.
  - `no_projectiles`: attack events fired but no projectile reached the pool.
  - `no_factory`: attack metadata parsed but projectile factory never executed.
  - `cooldown_stuck`: attacks fired but cooldown never reset (over 1.5s without projectiles).
  - `group_full`: projectile pool was exhausted.
  - `missing_texture`: probe had to register the 1×1 px fallback texture.
  - `paused_flag`: physics world reported a paused state.

Check the final `BOSS_PROBE_RESULT` JSON line for machine-readable output (also written to the console via `console.table`). Use `npm run probe:boss:diag` to enable event-level diagnostics for deeper traces.
