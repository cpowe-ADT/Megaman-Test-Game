Seat: qa-eval
Commit: 0da4f40
Scope: prompt 09 and part 10a claims against evidence; can their evals fail
Artifacts opened: output/perf/footprint-{baseline,09a,09b-before,09b-pools,09b-hud}.{md,json}, output/web-game-smoke/summary.json, output/mission-visual-sweep/summary.json, output/mission-visual-sweep/pyro_maw/mid.png, output/phase-9a/full-smoke/summary.json, output/phase-9a/full-smoke/40-hd-render/menus-2x.json, menu-title-2x.png, output/perf/hd-check/title-2x.png, output/perf/hud-compare-pyro_maw.png, output/phase-9a/verify.log, docs/archive/progress/progress-2025-10-to-2026-09-22.md

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| BLOCK | df30ca8 says ceilings were "lowered" but raised `phaserChunkGzipKB` 300 -> 305 with no ledger row, breaking rule 14 as the file itself states it | `tests/perf-budget.json:7`; `git diff ee57454 df30ca8 -- tests/perf-budget.json` | set it back to 300 (achieved 294.2) or add the row |
| MAJOR | 09b/09c are committed and claimed (P9-009/010/011) but those rows are PENDING, the 09a handoff says "not started", the exit handoff it cites does not exist, and progress.md has no 09b, 09c or 10a entry | `docs/prompts/EVAL_LEDGER.md:90`, `docs/prompts/handoff/09a-footprint-and-performance.md:3`, `progress.md:33` | write the rows, the exit handoff and the progress entries |
| MAJOR | EVAL-P10-001..005 have no ledger rows and no chain rule reads them, so 10a's claims are unrecorded and ungated (P10-003 checked by hand: the archive is the old file plus a 4-line header) | `docs/prompts/10-agent-system.md:75`, `tests/agent-budget.json:36` | add P10 rows with evidence |
| MAJOR | No full regression run covers df30ca8's HUD, enemy, projectile and AudioContext changes: 9 smoke scenarios passed, 42 skipped; the last 51/51 is from before 09b | `output/web-game-smoke/summary.json`, `output/phase-9a/full-smoke/summary.json` | `npm run verify` on HEAD |
| MAJOR | Commit cells filled in after the runs: footprint-09a ran on an uncommitted 7b9ff8e tree, 09b-hud on an uncommitted ee57454 tree minutes before df30ca8 with no `dirty` field, and nothing has run against the lowered budget | `output/perf/footprint-09a.md`, `output/perf/footprint-09b-hud.json` | run P9-012's footprint on HEAD |
| MAJOR | The 09b sweep overwrote P9-005's sweep PNGs and P9-012's sweep summary; nothing checks output/ paths | `output/mission-visual-sweep/pyro_maw/mid.png`, `scripts/agents/checks.mjs:160` | snapshot evidence before a new sweep (10b) |
| MAJOR | Ledger gate can pass vacuously: any 20 characters count as evidence and any sha git knows counts as the commit | `scripts/agents/checks.mjs:61`, `tests/agents-checks.test.ts:36` | require a result line and an artifact path that exists |
| MAJOR | Review parser accepts any backticked phrase as evidence, so a finding cited as trust-me text in backticks passes | `scripts/agents/checks.mjs:202` | accept only path:line, an artifact path, or a command with its result |
| MAJOR | @ts-nocheck detection matches the word in a comment; the false positive is allowlisted, agents:facts misreports it, and a real pragma added to that file would pass | `scripts/agents/check.mjs:50`, `src/scenes/game/GameDebugHooks.ts:10`, `tests/agent-budget.json:4` | match `^// @ts-nocheck` and remove the allowlist entry |
| MAJOR | footprint silently drops budget rows whose metric is null (denominator shrinks, still exits 0); hi-DPI discards page errors, so P9-002's "every scenario" misses 3 of 6 page loads | `scripts/perf/footprint.mjs:401`, `scripts/perf/footprint.mjs:380` | fail on a null metric or fewer rows than the budget; collect hi-DPI errors |
| MAJOR | music-residency tests cover only the pure rule and the loader; deleting the late-decode eviction or its wiring keeps `npm run test` green | `tests/music-residency.test.ts:3`, `src/audio/PlaceholderAudioService.ts:353` | a service test with a fake loader where the cue changes mid-decode |
| MINOR | `dirty` count ignores the harness and the budget file; smoke 40 passes even when it inspects no Text; the P9-002 red has no artifact | `scripts/perf/footprint.mjs:448`, `scripts/smoke/hd-render.mjs:86` | widen dirty paths, assert count > 0, save the red log |

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 2 |
| Failing check existed before the fix | 3 |
| Artifacts opened and described | 3 |
| No regression in scenarios outside the slice | 2 |

Verdict: FIX. `npm run test` (281/281) and agents:check (0 errors) are green, but the 09b and 10a claims have no ledger rows, one budget ceiling went up, and several gates can pass vacuously.
