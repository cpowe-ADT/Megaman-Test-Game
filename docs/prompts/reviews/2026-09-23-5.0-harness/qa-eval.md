Seat: qa-eval
Commit: fc2aa99
Scope: 5.0 harness and health part 1 - smoke/sweep continue-on-failure, run-folder symlinks, stepFrames, loader, pins
Artifacts opened: output/gates/agents-check.log, output/gates/build.log, output/gates/test.log, output/gates/test-smoke.log, output/gates/test-visual-sweep.log, output/gates/ci-browser-gates.log, output/gates/verify.log, output/smoke-runs/*/summary.json (4 runs), output/sweep-runs/2026-09-23T11-40-10-985Z/summary.json, output/web-game-smoke and output/mission-visual-sweep symlinks (ls -la), scripts/agents/snapshot-evidence.mjs, scripts/agents/facts.mjs, .github/workflows/ci.yml, node_modules/phaser/src/core/TimeStep.js
Tokens: 66157 (11 calls; game-qa-eval subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | The commit claims the detached-process-group + SIGINT-forward fix means "CI browser-gates no longer hang after artifacts," but the only CI browser-gates evidence in the tree predates the fix and shows the exact bug still present (not a post-fix pass). | `output/gates/ci-browser-gates.log`: `Error [CleanupTimeoutError]: Browser cleanup exceeded 5000ms ... classification: 'hung_after_artifacts'` at `06:28-06:34Z`, well before the fc2aa99 diff to `scripts/mission-visual-sweep.mjs`'s `signalChildGroup`/`detached: true`. Only local macOS evidence backs the fix (`output/sweep-runs/2026-09-23T11-40-10-985Z/summary.json`, status `pass`), and the code explicitly branches on `process.platform !== 'win32'`, so a macOS pass does not prove the Linux CI runner behaves the same. | Trigger `workflow_dispatch` on `browser-gates` and cite the run URL/log before calling this resolved. |
| MINOR | `output/gates/test-visual-sweep.log` is stale: its own "Artifacts:" line points at `output/mission-visual-sweep` with no timestamped run folder, i.e. it was captured before this commit's `outputRoot`/symlink change, yet it sits in `output/gates/` alongside logs that are current. | `output/gates/test-visual-sweep.log`: `Mission visual sweep complete. Artifacts: .../output/mission-visual-sweep` (no `sweep-runs/<ts>` path) vs. current `output/sweep-runs/2026-09-23T11-40-10-985Z/summary.json` which does carry `runDir`. | Regenerate `test-visual-sweep.log` (or delete it) so a later reviewer doesn't cite pre-fix evidence as current. |

Verified claims, no regression found: gates green (292 tests); SMOKE_FORCE_FAIL run recorded both scenarios with overall fail; symlinks live and re-pointed with matching runDir; snapshot-evidence follows symlinks; stepFrames matches TimeStep.sleep/wake; ci.yml unchanged.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 4 |
| Failing check existed before the fix | 5 |
| Artifacts opened and described | 5 |
| No regression in scenarios outside the slice | 4 |

Verdict: FIX (no BLOCK, but the CI-hang-fix claim needs a real post-fix `browser-gates` run before it's treated as resolved; refresh the stale sweep gate log)
