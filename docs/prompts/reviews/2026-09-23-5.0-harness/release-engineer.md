Seat: release-engineer
Commit: fc2aa99
Scope: 5.0 harness and health part 1 - build/CI pins, --import loader migration, .venv sprite scripts, hidden sourcemaps, detached process-group dev-server stop
Artifacts opened: output/packets/2026-09-231223-release-engineer.md, .github/workflows/ci.yml, scripts/check-dist-runtime-assets.mjs, package-lock.json (via node -e), requirements.txt, .venv/bin/python -m pip show pillow, git log/show on package-lock.json
Tokens: 57712 (8 calls; game-release-engineer subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| BLOCK | `package.json` pins exact `phaser@3.90.0`, `playwright@1.58.2`, `typescript@5.9.3` and adds `engines.node: "22.x"`, but `package-lock.json` was never regenerated: its root `packages[""]` entry still records `phaser: "^3.80.0"`, `playwright: "^1.58.2"`, `typescript: "^5.4.0"` and no `engines` key. `npm ci` (both CI jobs) fails when package.json and package-lock.json diverge, so every push/PR and the manual browser-gates run breaks on the `npm ci` step. | `git show 93a04a1..HEAD --stat -- package-lock.json` returns nothing; `git log -1 --format=%cd -- package-lock.json` -> Sep 10 while fc2aa99 is Sep 23; `node -e "console.log(require('./package-lock.json').packages[''])"` shows the caret ranges and no `engines`. | Run `npm install` to regenerate and commit `package-lock.json`, then confirm `npm ci` succeeds locally before pushing. |

| Rubric | Score |
| --- | --- |
| Production build boots with no page errors | 3 |
| No private or franchise asset in the public build | 5 |
| CI runs the cheap gates on every push | 1 |
| Version and changelog honest | 3 |

Notes: the prior green build ran on installed node_modules, not a clean npm ci; hidden sourcemaps only with BUILD_SOURCEMAP=1; .nvmrc, engines, CI node 22 and the Playwright install step are aligned.

Verdict: FIX (package-lock.json drift breaks `npm ci` in both CI jobs; loader migration, .venv routing, hidden sourcemaps vs the dist-assets check, and the detached process-group stop vs CI's cleanup timeout are consistent)
