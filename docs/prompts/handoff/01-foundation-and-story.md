# Handoff 01: Foundation and story

## Status: PARTIAL (list what is missing and why)

Phase 1.0 is in progress. The baseline checkpoint awaits STOP 1.0 approval; CI and phases 1.0b–1.6 have not begun. This is a running slice memo, not an exit-gate handoff.

## Branch and final commit

Branch: `codex/mega-runtime-and-assets-pass` at `34bde56`. Final prompt commit: pending; no checkpoint commit is authorized before STOP 1.0.

## What changed (by area, with file paths)

### Phase 1.0 design memo — EVAL-P1-001

- Understand: establish an evidence-backed baseline for the existing project work before changing the campaign.
- Understand: reproduce the short-ground-enemy Buster miss, repair its narrow cause, and present the whole baseline for checkpoint approval.
- Intent: ordinary uncharged shots must damage a floor-level mine bot when fired directly across it.
- Player-facing result: reliable pellet contact without changing the shot artwork or unrelated combat rules.
- Director acceptance: the target and projectile remain readable at 448×252; no presentation redesign belongs in this slice.
- QA acceptance: focused scenario `29-pellet-hits-short-enemy`, full smoke, and all ten mission captures pass with inspected evidence.
- Failing check first: preserve the initial full-smoke result and scenario 29 evidence before modifying collision behavior.
- Implementation seam: inspect `src/projectiles/definitions/coreProjectiles.ts` and `src/projectiles/collision/ProjectileCollisionRouter.ts` before choosing a minimal change.
- Engineer constraint: keep reusable collision logic typed, preserve platform recycling semantics, and do not grow `src/scenes/Game.ts`.
- Engineer risk: a large combat sensor can accidentally hit floors; prove any fix against the existing sprite-bounds platform contract.
- Engineer risk: browser timing is real time; `window.advanceTime` waits for animation frames and does not deterministically step Phaser.
- Baseline gate order: `npm run test`, `npm run build`, `npm run sprites:validate`, full smoke, full visual sweep.
- Focused repair gates precede rerunning the affected complete gates; retain logs and summaries under `output/phase-1-0/`.
- Documentation: update `TESTING.md`, `docs/testing/quality-gates.md`, and verified charter ground truth without changing hook semantics.
- Ground-truth correction: the initial 100 untracked status entries expand to 614 individual files; several upgrades already affect runtime behavior.
- Files expected: the collision seam if required, a focused regression test if required, the automation docs, charter, ledger, this handoff, and `progress.md`.
- Review evidence: inspected smoke/sweep JSON plus representative short-enemy, title, stage, and boss screenshots; each review names its files.
- Checkpoint decision: recommend ignoring `tmp/`, `output/`, `__pycache__/`, and `*.py[cod]`, while retaining build-required `types/`.
- Stop boundary: present STOP 1.0 before changing ignore rules or committing; CI begins only after Craig approves the checkpoint.

### Phase 1.0 implementation and review

- Engineer: the initial ordered test/build/sprite/smoke/sweep gates all passed. The historical pellet miss did not reproduce, and the live mine bot retained 4 HP after one ordinary Buster hit; no gameplay or projectile sensor change was justified.
- Engineer: preserved the initial smoke set in `output/phase-1-0/baseline-smoke/` and the previous on-disk summaries in `output/phase-1-0/prior/` before later runs overwrote their normal output paths.
- QA: the old HP-only predicate could pass if the target disappeared or a charged shot caused damage. Isolating that predicate produced four failing regression fixtures before the assertion was strengthened.
- Engineer: `scripts/smoke/assert-pellet-hit.mjs`, `tests/pellet-hit-evidence.test.ts`, and scenario 29 in `scripts/smoke-test.mjs` now require the same live target, exactly 5→4 HP, one uncharged Buster, and one accepted one-damage player bullet hit. `pellet-evidence.json` preserves the evidence separately from the ordinary state capture.
- Engineer: `TESTING.md`, `docs/testing/quality-gates.md`, and `AGENTS.md` now describe the existing animation-frame wait accurately; the runtime hook semantics are unchanged. Testing docs cover run filters, ports, automation URL flags, and boss/stage hooks.
- Engineer: charter ground truth distinguishes 100 untracked status entries from 614 individual files, build-required `types/`, existing upgrade effects, public versus private boss atlases, and the non-reproduced historical smoke failure.
- Director: reviewed all 40 fresh sweep PNGs independently; platform, pickup, and dialogue presentation is legible, while checkpoint/toast overlap, truncated phase labels, and private boss-art defects remain visible baseline debt.
- Director: Volt's narrow vertical boss silhouette comes from effects-only cells in the private Volt atlas, not an excessive runtime scale transform. Glacier's private override is a low winged silhouette. These captures do not approve public boss art.
- QA: representative existing edits across campaign, combat, projectiles, sweep, sprite tooling, and docs are coherent project work; no sampled corruption found. `types/private-sprite-manifest.d.ts` is required by the current TypeScript build.
- Orchestrator: independently opened every sweep contact sheet (`output/phase-1-0/contact-sheets/sweep-01.png` through `sweep-07.png`) and the preserved pellet PNG/state, verifying separated HUD bands and a live damaged mine bot.
- Engineer: opened `output/phase-1-0/focused-pellet-smoke/29-pellet-hits-short-enemy/shot-0.png`; the standing player and short green enemy are visible above the floor, with impact feedback between them and clear HUD separation.
- Engineer: separately ran the repository develop-web-game client because its legacy smoke wrapper is no longer registered; opened `output/phase-1-0/skill-client/shot-0.png`, a clean 448×252 Pyro view with visible flame hazards, platforms, pickups, and the standing player.
- Engineer: opened all seven final smoke contact sheets (`smoke-01.png` through `smoke-07.png`): weapon and HUD states remain readable, player/enemy/saber captures are visible, and the existing long touch-button overlay, truncated Stage Select titles, and checkpoint toasts remain clearly identifiable debt. `output/phase-1-0/contact-sheet-manifest.txt` indexes every sheet, including all 40 initial and all 40 final smoke captures.
- Final pellet geometry: the live projectile sensor spans y=181–235 (14×54), overlapping the mine bot's y=226–236 hurtbox; its visible art spans y=198–218 above the floor at y=236. The same identified enemy ends at 4 HP after one accepted uncharged hit. Evidence: `output/web-game-smoke/29-pellet-hits-short-enemy/pellet-evidence.json`.
- Checkpoint manifest: `output/phase-1-0/checkpoint-candidates.json` lists 108 modified tracked files (the original 107 plus the AGENTS automation wording correction) and 118 untracked project files. Complete path lists and the unapplied `proposed-gitignore.patch` are beside it.

## Decisions made (each with the reason and what it forecloses)

- No runtime sensor adjustment: the existing 14×54 Buster sensor demonstrably damages the shortest enemy; changing it without a current failure could regress platform/world-bound behavior.
- Stronger test evidence: missing targets and other damage sources must fail, so a green smoke result proves actual uncharged pellet contact.
- Awaiting Craig: add `tmp/`, `output/`, `__pycache__/`, and `*.py[cod]` to `.gitignore`, retain `types/`, and commit the reviewable checkpoint. Ignore rules remain unchanged until approval.

## Content inventory (tables: stages, bosses, dialogue sequences, assets, audio cues; counts, not prose)

| Inventory | Count | Status |
| --- | --- | --- |
| Stages | 10 | Existing campaign; unchanged in Phase 1.0 |
| Bosses | 10 | Existing roster; unchanged in Phase 1.0 |
| Dialogue sequences | 20 + 3 milestones | Existing v1; unchanged in Phase 1.0 |
| Runtime assets | 153 | Developer build, including private overrides |
| Audio cues | 6 | Existing music cue map; unchanged in Phase 1.0 |

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

- `EVAL-P1-001` stays PENDING until the approved checkpoint commit exists. Recorded commands below do not imply prompt completion.

| Command | Result line / exit | Artifact | Commit |
| --- | --- | --- | --- |
| `npm run test` (entry) | `Test summary: 12 passed, 0 failed`; `# pass 180`; `# fail 0`; exit 0 | `output/phase-1-0/01-test.log` | Pending approval |
| `npm run build` (entry) | `✓ built in 3.72s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; exit 0 | `output/phase-1-0/02-build.log` | Pending approval |
| `npm run sprites:validate` | `[sprites] Manifest valid (25 entries, 25 ready, 0 planned)`; `[sprites] Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)`; exit 0 | `output/phase-1-0/03-sprites-validate.log` | Pending approval |
| `npm run test:smoke` (entry) | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 38/38 pass, exit 0 | `output/phase-1-0/04-baseline-smoke.log`; `output/phase-1-0/baseline-smoke/summary.json` | Pending approval |
| `npm run test:visual-sweep` | `Mission visual sweep complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/mission-visual-sweep`; 10/10 pass, exit 0 | `output/phase-1-0/05-baseline-sweep.log`; `output/mission-visual-sweep/summary.json` | Pending approval |
| `node --loader ./tools/ts-node-loader.mjs --test tests/pellet-hit-evidence.test.ts` (old predicate) | `# pass 1`; `# fail 4`; exit 1, expected red | `output/phase-1-0/06-pellet-evidence-red.log` | Pending approval |
| Same focused test (strict predicate) | `# pass 5`; `# fail 0`; exit 0 | `output/phase-1-0/07-pellet-evidence-green.log` | Pending approval |
| `SMOKE_ONLY=29-pellet-hits-short-enemy npm run test:smoke` | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 1 pass, 37 filter skips, exit 0 | `output/phase-1-0/08-focused-pellet-smoke.log`; `output/phase-1-0/focused-pellet-smoke/summary.json` | Pending approval |
| `npm run test` (final) | `Test summary: 12 passed, 0 failed`; `# pass 185`; `# fail 0`; exit 0 | `output/phase-1-0/09-final-test.log` | Pending approval |
| `npm run build` (final) | `✓ built in 3.48s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; exit 0 | `output/phase-1-0/10-final-build.log` | Pending approval |
| `npm run test:smoke` (final) | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; `Full smoke summary: 38/38 pass, 0 fail, 0 skipped.`; exit 0 | `output/phase-1-0/11-final-smoke.log`; `output/web-game-smoke/summary.json` | Pending approval |
| Repository develop-web-game client + artifact check | `Skill client artifacts valid: Game state, shot-0.png, 0 browser-error files.`; exit 0 | `output/phase-1-0/12-skill-client.log`; `output/phase-1-0/skill-client/` | Pending approval |

- Remaining prompt-01 evals: PENDING; this session starts with Phase 1.0 only.

## Open risks and known debt

- The historical scenario-29 failure did not reproduce; this slice repairs its permissive test assertion, not an unproven runtime defect.
- `src/scenes/Game.ts` starts at 3,928 lines with the existing `@ts-nocheck`; no growth or new suppression is permitted.
- Private player/boss overrides are developer assets, not public release assets; public stripping remains future prompt work. Volt's effects-only private cells and Glacier's low silhouette require art review in prompt 03.
- Sweep `state-boss-room.json` is sampled before movement/attack checks, while `boss-room.png` is captured afterward; they prove different points in the same encounter and must not be described as simultaneous.
- Existing checkpoint toast overlap, truncated phase labels, Gale cloud seams, and low-contrast private boss art remain visible; a green baseline gate is not final art approval.
- The existing Omega art is recorded as original generated work in its manifest/progress history, but its attribution registry lacks a complete source/author/license entry; resolve in the asset phase without inventing a license.
- `4-title-controls/shot-0.png` currently shows the Controls screen. Phase 1.2 must explicitly capture Title when reviewing the new identity.
- The production Phaser chunk warning is accepted debt under ADR-0002.

## Inputs for prompt 02 (an explicit list: files to read, decisions to honor, numbers to keep)

- Not ready: prompt 01 exit conditions are incomplete. Read the completed version of this file before starting prompt 02.
