# Handoff 01: Foundation and story

## Status: PARTIAL (list what is missing and why)

Phase 1.0 is complete: Craig approved STOP 1.0, and the baseline checkpoint and CI are committed. Phase 1.0b is committed with gates and review green at `fb0e553`; STOP 1.0b is awaiting Craig’s reply. The separate enemy ecology request is a planning supplement only; phases 1.1–1.6 have not begun. This is a running slice memo, not an exit-gate handoff.

## Branch and final commit

Branch: `codex/mega-runtime-and-assets-pass`. Approved baseline checkpoint: `35a1fba89ae77d5c900d65486994f5620df48834`, `checkpoint: pre-completion baseline (gates green)`. CI: `bf216acc9d7c872586ff35e6902af7c5d2f5dd6c`. Input slice: `fb0e5532fe552477f6b28c9fbf2d9e06cfe64341`, `refactor: unify scene input actions (EVAL-P1-010)`. Final prompt commit: pending; later slices remain.

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
- Final pellet geometry: the live projectile sensor spans y=181–235 (14×54), overlapping the mine bot's y=226–236 hurtbox; its visible art spans y=198–218 above the floor at y=236. The same identified enemy ends at 4 HP after one accepted uncharged hit. Evidence: `output/phase-1-0/final-smoke/29-pellet-hits-short-enemy/pellet-evidence.json`.
- Checkpoint manifest: `output/phase-1-0/checkpoint-candidates.json` lists 108 modified tracked files (the original 107 plus the AGENTS automation wording correction) and 118 untracked project files. Complete path lists and the unapplied `proposed-gitignore.patch` are beside it.

### Phase 1.0 CI design memo — EVAL-P1-002

- Understand: make the approved baseline reproducibly testable on GitHub using Node 22.
- Understand: keep slow browser coverage available as a deliberate manual workflow with downloadable evidence.
- Intent: every push and pull request runs the existing logic tests and production build.
- Player-facing result: no visible gameplay change; broken integration is caught before future work lands.
- Release Engineer acceptance: `.github/workflows/ci.yml` declares push, pull-request, and manual triggers.
- Release Engineer acceptance: automatic checks install dependencies with `npm ci`, then run test and build.
- Release Engineer acceptance: a separate browser job runs only for `workflow_dispatch`.
- Browser acceptance: install Playwright Chromium, run smoke on port 4400 and the ten-mission sweep, and upload `output/` even on failure.
- Engineer seam: add only the workflow, the `ci` package command, and corresponding testing/handoff documentation.
- Engineer constraint: preserve existing dependency versions; add a locked Node 22 type dependency only if clean-resolution evidence proves it necessary. No gameplay, hook, or asset changes.
- Engineer risk: local private art is absent on GitHub; the current build must continue supporting its existing public-asset fallback.
- Engineer risk: a green local gate cannot stand in for a remote run; record the remote URL after Craig pushes.
- Red-first check: an independent workflow audit must report the currently missing workflow and missing `ci` command.
- Focused gate: parse workflow structure and assert trigger, Node, command, manual-job, and artifact-upload contracts.
- Full slice gate: `npm run ci` must run `npm run test && npm run build` successfully.
- Artifact inspection: inspect the workflow source, parsed structure report, and local gate logs; no new screenshots are expected for CI-only wiring.
- Record: retain Craig's STOP 1.0 approval verbatim, the checkpoint SHA, and graphics-production requirements in this handoff and `progress.md`.
- Commit: one small CI commit naming EVAL-P1-002; no push or deployment in this slice.

### CI review finding: ambient Node types

- QA found that `@types/node` was absent from `package.json`, the lockfile, and repository `node_modules`; the successful local typecheck resolved an ancestor installation at `/Users/thristannewman/node_modules/@types/node/package.json`.
- Isolating automatic type discovery to an empty repository-local type root reproduced seven errors (`fs`, `path`, and `process` declarations missing), exit 2; evidence is `output/phase-1-0/19-ci-node-types-red.log`.
- Engineer correction: declare and lock `@types/node` for Node 22, then typecheck with only repository-local types before rerunning `npm run ci`. This closes a clean-runner dependency gap without changing gameplay.

### Phase 1.0b design memo — EVAL-P1-010

- Understand: combine keyboard and touch into one action state while preserving existing controls and menu behavior.
- Understand: migrate scene/player consumers onto per-scene adapters and prove held-input ownership across overlays and transitions.
- Director intent: preserve the 448×252 layout and all visible controls; this slice changes input ownership, not presentation.
- Actions: moveLeft, moveRight, aimUp, aimDown, jump, dash, shoot, saber, weaponPrev, weaponNext, pause, confirm, cancel.
- Defaults remain arrows, Space jump, Z dash, X shoot, C saber, D/E next weapon, Q previous, Enter/Numpad Enter/Space confirm, and Esc back.
- Preserve existing supplemental menu, progression-transport, checkpoint, tutorial/final, and debug shortcuts through named central bindings.
- Merge source-held values before deriving edges: a second source cannot retrigger an action or release it while another source holds.
- Compute one immutable action snapshot per game frame; every gameplay consumer reads that same snapshot.
- Preserve opposed-axis cancellation, eight-direction aim, and Down+Jump drop-through with second-jump suppression.
- Preserve physical key state across transitions: held Numpad Enter cannot rearm Stage Select until its actual release.
- Give only the top active input surface callbacks; SystemMenu leaves its underlying Phaser scene active, so isActive alone is insufficient.
- Preserve Esc dialogue-skip priority and prevent the same press from closing a newly opened menu; resume cannot synthesize action presses.
- Keep audio unlocking and browser-scroll prevention at the input adapter edge and preserve pointer controls and touch automation hooks.
- Settings seam: a validated settings.v1 bindings store preserves future fields; full settings/options arrive later, with no remap UI or gamepad now.
- Files: src/input/ActionState.ts, InputActions.ts, menuInputBinder.ts, src/systems/Settings.ts, player controller/runtime, scene bindings, dialogue presenter, navigation reset, tests, and smoke tooling/docs.
- Red first: pure reducer/settings tests for source handoff, aliases, held/released edges, frame reuse, modal reactivation, and persisted remaps; missing modules fail before implementation.
- Focused browser acceptance: unchanged 13d movement and 4c touch scenarios, repeated overlay pause/resume, and physical held-Numpad confirm rearming.
- Full gates: tests, build, sprite validation, full smoke, and a separate develop-web-game client run with retained JSON/PNG evidence.
- Review: root and QA inspect the input ownership seams and every produced screenshot before the slice commit.
- Budget: Game.ts must shrink; no new @ts-nocheck. Record EVAL-P1-010 and stop before Phase 1.1.

### Phase 1.0b implementation and review

- `src/input/ActionState.ts` owns pure aggregated held/pressed/released state and immutable frame snapshots. `InputActions.ts` owns per-game physical keyboard state and per-scene adapters; scene/player consumers now read named actions. Supplemental shortcuts remain centralized.
- `DigitalButtonPad` reports before/after changes without altering its public touch hooks. Fast keyboard/touch taps latch edges between render frames, and overlapping sources cannot retrigger or release an already-held union.
- `src/systems/Settings.ts` persists validated bindings in `settings.v1`; partial remaps preserve earlier remaps and future settings fields. No remap UI or gamepad was added.
- QA/Orchestrator found and Engineer fixed fast-tap loss, partial-remap replacement, stale held edges across paused-scene resume, and a charge release lost under an overlay. Gameplay charge cancellation now updates its cached diagnostic fields immediately.
- Red evidence: missing modules first; then three focused failures for fast taps, partial remaps, and charge cancellation. A fixture used the wrong iframe field in `05-review-regressions-green.log`; the corrected fixture passed in `08-focused-tests.log`. Logs 11/12 used an unavailable tsx loader and are failed command attempts, not gate passes; the actual hitstop red is the captured browser failure/trace.
- Unchanged touch scenario 4c failed because dash pressed at frame 333 during hitstop=2 was consumed before the grounded motor update at 335. `touch-trace.json` proves that boundary; gameplay edges now wait through hitstop, while pause/menu callbacks remain live and ownership changes discard pending gameplay edges. Movement tuning is unchanged.
- `scripts/smoke/input-lifecycle.mjs` adds scenario 13e with three pause/charge/movement cycles, fast menu taps, nested held-Escape return, held/repeated Numpad StageSelect rearming, modal underlay isolation, and held-Enter Controls→Title return. Scenarios 13d and 4c are unchanged.
- The first lifecycle attempt had an incorrect fixture path (`paused` versus `playerState.paused`), preserved under `lifecycle-fixture-failure`. The next run exposed `_dev.initOnce` surviving Game shutdown: cleared hooks failed to reinstall on reentry. The existing shutdown callback now resets initialization and stale debug entries; the unchanged hook assertion passes.
- Orchestrator independently inspected all five focused-green and four lifecycle-green PNGs plus earlier failure captures. Evidence shows HP 8 preserved, paused iframe values unchanged, shots unchanged on resume then fresh shots 0→1→2→3, and held Numpad unarmed/nonpending until release. Engineer opened all 13 focused/failure/lifecycle images through three contact sheets indexed in `output/phase-1-0b/focused-contact-manifest.txt`.
- Visible outcome: readable selected menu rows, Title, player/shot, and separated HUD. Existing oversized touch controls, StageSelect truncation/toast/preview overflow, fade captures, and private branding remain future-phase debt. No new art or layout change belongs to this slice.

### Enemy ecology planning supplement design memo — EVAL-ENEMY-PLAN-001

- Understand: Craig wants deeper monsters, stage-specific behavior and features, and a world that feels alive.
- Understand: capture that direction as a bounded implementation brief without starting the pending gameplay phases.
- Scope: documentation only while STOP 1.0b remains pending; no Phase 1.1, runtime code, asset generation, or gameplay evidence.
- Intended file: `docs/working/enemy-ecology-and-variant-plan.md`, explicitly marked working/proposed.
- Index links: add the brief to `docs/README.md` and `docs/working/README.md`.
- Durable record: link the brief from this partial handoff, a separate ledger supplement row, and `progress.md`.
- Existing state: read the actual twelve enemy families and ten campaign stages before proposing variants.
- Design coverage: each family needs a role, behavior change, visual distinction, telegraph, counterplay, and an observable world routine.
- Stage coverage: each stage needs a distinct ecological purpose and a bounded encounter/variant proposal.
- World-life rule: routines must communicate purpose while preserving readable combat and predictable collision/damage behavior.
- Scope control: recommend a small Pyro pilot first; any broader rollout remains contingent on the existing phase reviews.
- Architecture: reuse the typed enemy/content/animation/spawner seams; avoid new scene-local systems and Game.ts growth.
- Graphics: original ChatGPT concepts/edits, genuine vectors only where appropriate, and reproducible source/prompt/edit/atlas lineage.
- QA: define measurable future acceptance for telegraphs, counterplay, variants, routines, placement, and performance.
- Failing check first: create an output-only document audit that fails before the new brief exists.
- Audit meaning: verify document completeness, real inventory coverage, source links, scope boundaries, and future acceptance; never claim implemented monsters.
- Synthesis: wait for Director/QA/Orchestrator recommendations before drafting the final brief.
- Gates: focused document audit, then docs-only `npm run test` and `npm run build`; no new browser screenshots or smoke run.
- Prior evidence: pin the completed input commit `fb0e5532fe552477f6b28c9fbf2d9e06cfe64341` without changing its eval status.
- Commit boundary: obtain Orchestrator draft-review feedback before the documentation commit; all gameplay/art STOPs remain pending.

### Enemy ecology planning supplement completed

- Draft: `docs/working/enemy-ecology-and-variant-plan.md`, indexed in `docs/README.md` and `docs/working/README.md`. All 12 real family IDs and 10 stage IDs are mapped to proposed behavior, visual distinction, tells, counterplay, local routines and future phase ownership.
- Director/QA synthesis recommends one mine-bot family in Pyro/Mire, with two biome variants and a 2–3-screen lab before real-stage integration. The initial audit mistakenly required two families; its fixture was corrected to one family/two variants after synthesis without changing the design to satisfy that mistake. Both pre-document red logs are retained.
- Verified prerequisite gaps are documented, including variant/presentation identity, resolution precedence, aim commitment, stun cancellation, terrain sensing, shallow validation and unconsumed animation events. No runtime correction or new asset is implemented in this supplement.
- `EVAL-ENEMY-PLAN-001` measures documentation completeness only. It cannot approve the pilot, prove working monsters, change existing phase evals, or release the pending STOP 1.0b.
- Orchestrator, Director and QA completed draft review. Final wording preserves ordinary contact/older projectiles, separates proposed enemy interruption from pending player-charge policy, distinguishes Phase 02 placeholder behavior from Phase 03 original art acceptance, retains archive fiction and original graphics authorization, and requires a narrow pure controller rather than an AI rewrite.
- Engineer read the final brief and audit JSON/logs; documentation completeness and docs-only test/build gates passed below. No screenshot, smoke, runtime, or asset changes were made.

## Decisions made (each with the reason and what it forecloses)

- Proposed input decision for STOP 1.0b: cancel only the pending charge when opening the system menu; require a fresh trigger after resume. This avoids deferred firing or a stuck charge without resetting health, cooldowns, or invulnerability. It forecloses banking a charge through pause; Craig can revise this at the STOP.
- No runtime sensor adjustment: the existing 14×54 Buster sensor demonstrably damages the shortest enemy; changing it without a current failure could regress platform/world-bound behavior.
- Stronger test evidence: missing targets and other damage sources must fail, so a green smoke result proves actual uncharged pellet contact.
- Craig approved STOP 1.0 verbatim: "approved yes commit it and you remeber i want oen tha tworks on graphics where you use your chat gpt image or editign skils to create ebtter vwtor files and  asytem doto doi it if you ahve to pgoram somethign to do it you can".
- Applied the approved ignore additions (`tmp/`, `output/`, `__pycache__/`, `*.py[cod]`), retained build-required `types/`, and committed the baseline as `35a1fba`. Staged content excluded scratch, private runtime assets, and caches; existing Markdown hard-break whitespace and an original blank EOF were preserved.
- Graphics requirement: keep a dedicated Art Director/Animator seat for original asset production using ChatGPT image generation/editing, with editable vector files where appropriate and a reproducible import/validation pipeline. Engineering may build tooling for that workflow. Generated raster art is not described as editable SVG; use genuine vector paths for scalable interface/icons and preserve layered or source raster assets for sprites. No Capcom-derived public assets; existing art pilot reviews and STOPs remain mandatory. This CI slice adds no art.

## Content inventory (tables: stages, bosses, dialogue sequences, assets, audio cues; counts, not prose)

| Inventory | Count | Status |
| --- | --- | --- |
| Stages | 10 | Existing campaign; unchanged in Phase 1.0 |
| Bosses | 10 | Existing roster; unchanged in Phase 1.0 |
| Dialogue sequences | 20 + 3 milestones | Existing v1; unchanged in Phase 1.0 |
| Runtime assets | 153 | Developer build, including private overrides |
| Audio cues | 6 | Existing music cue map; unchanged in Phase 1.0 |

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

- `EVAL-P1-001` is PASS on approved checkpoint `35a1fba`. Recorded commands below do not imply full prompt completion.

| Command | Result line / exit | Artifact | Commit |
| --- | --- | --- | --- |
| `npm run test` (entry) | `Test summary: 12 passed, 0 failed`; `# pass 180`; `# fail 0`; exit 0 | `output/phase-1-0/01-test.log` | `35a1fba` |
| `npm run build` (entry) | `✓ built in 3.72s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; exit 0 | `output/phase-1-0/02-build.log` | `35a1fba` |
| `npm run sprites:validate` | `[sprites] Manifest valid (25 entries, 25 ready, 0 planned)`; `[sprites] Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)`; exit 0 | `output/phase-1-0/03-sprites-validate.log` | `35a1fba` |
| `npm run test:smoke` (entry) | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 38/38 pass, exit 0 | `output/phase-1-0/04-baseline-smoke.log`; `output/phase-1-0/baseline-smoke/summary.json` | `35a1fba` |
| `npm run test:visual-sweep` | `Mission visual sweep complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/mission-visual-sweep`; 10/10 pass, exit 0 | `output/phase-1-0/05-baseline-sweep.log`; `output/mission-visual-sweep/summary.json` | `35a1fba` |
| `node --loader ./tools/ts-node-loader.mjs --test tests/pellet-hit-evidence.test.ts` (old predicate) | `# pass 1`; `# fail 4`; exit 1, expected red | `output/phase-1-0/06-pellet-evidence-red.log` | `35a1fba` |
| Same focused test (strict predicate) | `# pass 5`; `# fail 0`; exit 0 | `output/phase-1-0/07-pellet-evidence-green.log` | `35a1fba` |
| `SMOKE_ONLY=29-pellet-hits-short-enemy npm run test:smoke` | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 1 pass, 37 filter skips, exit 0 | `output/phase-1-0/08-focused-pellet-smoke.log`; `output/phase-1-0/focused-pellet-smoke/summary.json` | `35a1fba` |
| `npm run test` (final) | `Test summary: 12 passed, 0 failed`; `# pass 185`; `# fail 0`; exit 0 | `output/phase-1-0/09-final-test.log` | `35a1fba` |
| `npm run build` (final) | `✓ built in 3.48s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; exit 0 | `output/phase-1-0/10-final-build.log` | `35a1fba` |
| `npm run test:smoke` (final) | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; `Full smoke summary: 38/38 pass, 0 fail, 0 skipped.`; exit 0 | `output/phase-1-0/11-final-smoke.log`; `output/phase-1-0/final-smoke/summary.json` | `35a1fba` |
| Repository develop-web-game client + artifact check | `Skill client artifacts valid: Game state, shot-0.png, 0 browser-error files.`; exit 0 | `output/phase-1-0/12-skill-client.log`; `output/phase-1-0/skill-client/` | `35a1fba` |

- `EVAL-P1-002`: PASS locally at `bf216acc9d7c872586ff35e6902af7c5d2f5dd6c`. Remote run URL awaits Craig’s push. Remaining prompt-01 evals: PENDING.

### CI evidence — EVAL-P1-002

| Command | Result line / exit | Artifact |
| --- | --- | --- |
| `ruby output/phase-1-0/check-ci-workflow.rb` (before implementation) | `CI structure audit FAIL: missing .github/workflows/ci.yml; missing exact npm ci script: npm run test && npm run build`; exit 1 | `output/phase-1-0/16-ci-structure-red.log` |
| Same parsed workflow audit (after implementation) | `CI structure audit PASS: push/PR Node22 test+build; manual-only browser job; smoke port4400; always-upload output/.`; exit 0 | `output/phase-1-0/17-ci-structure-green.log` |
| Typecheck with an empty repository-local type root | `scripts/ensure-bullet-asset.ts(1,28): error TS2307: Cannot find module 'fs' or its corresponding type declarations.`; 7 errors, exit 2 | `output/phase-1-0/19-ci-node-types-red.log` |
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --typeRoots ./node_modules/@types` | `Repository-only Node typecheck PASS: @types/node 22.20.2 resolved inside node_modules/.`; exit 0 | `output/phase-1-0/21-ci-node-types-green.log` |
| `npm run ci` | `Test summary: 12 passed, 0 failed`; `# pass 185`; `# fail 0`; `✓ built in 3.55s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; exit 0 | `output/phase-1-0/22-ci-final.log` |

- QA and Orchestrator reviewed the workflow and clean-resolution repair; no remaining local CI blocker. No new gameplay screenshots were produced for CI-only changes; Phase 1.0 baseline capture sets remain intact.
- Graphics-production inputs to preserve for prompt 03: extend `scripts/sprites/build-image-prompts.mjs`, `tools/sprites/intake-chatgpt-images.mjs`, `tools/sprites/slice_sheet_to_atlas.py`, and `docs/content/sprite-imagegen.md`. Record explicit repository input paths, recipes, prompt/edit lineage, hashes, source files, and licensing; use deterministic cleanup, slicing, Phaser atlas generation, and pinned SVG rasterization with native 448×252 checks. Existing reviews remain STOP 3.1 (style/pipeline, boss-cell and tile-strip pilot), 3.3a (action sheets), 3.4 (hero), and 3.5 (logo/UI). No art has been produced in this slice.

### Input evidence — EVAL-P1-010

| Command / check | Result line / exit | Artifact | Commit |
| --- | --- | --- | --- |
| Initial pure input tests | Missing `src/input/ActionState.ts`; exit 1, expected red | `output/phase-1-0b/01-input-red.log` | `fb0e553` |
| Focused review regressions before fixes | `# pass 13`; `# fail 3`; exit 1 | `output/phase-1-0b/04-review-regressions-red.log` | `fb0e553` |
| Initial focused smoke | `Timed out waiting for state condition (touch dash to engage) after 3000ms`; exit 1 | `output/phase-1-0b/07-focused-smoke.log`; `focused-failure-1/summary.json`; `touch-trace.json` in the same phase directory | `fb0e553` |
| `node --loader ./tools/ts-node-loader.mjs --test tests/input-actions.test.ts tests/player-combat.test.ts` | `# pass 19`; `# fail 0`; exit 0 | `output/phase-1-0b/18-final-focused-tests.log` | `fb0e553` |
| `SMOKE_ONLY=4c-touch-controls,6-boss-clear-numpad-return,13d-movement-feel,15-menu-audio-and-input-stability npm run test:smoke` | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 4 pass, 34 filter skips, exit 0 | `output/phase-1-0b/13-focused-smoke.log`; `output/phase-1-0b/focused-touch-green/summary.json` | `fb0e553` |
| `SMOKE_ONLY=13e-input-source-lifecycle npm run test:smoke` | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 1 pass, 38 filter skips, exit 0 | `output/phase-1-0b/17-lifecycle-smoke.log`; `output/phase-1-0b/lifecycle-green/summary.json` | `fb0e553` |
| `npm run test` | `Test summary: 12 passed, 0 failed`; `# pass 198`; `# fail 0`; exit 0 | `output/phase-1-0b/19-full-test.log` | `fb0e553` |
| `npm run build` | `✓ built in 3.43s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; exit 0 | `output/phase-1-0b/20-full-build.log` | `fb0e553` |
| `npm run sprites:validate` | `[sprites] Manifest valid (25 entries, 25 ready, 0 planned)`; `[sprites] Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)`; exit 0 | `output/phase-1-0b/21-sprites-validate.log` | `fb0e553` |
| `npm run test:smoke` | `Full smoke summary: 39/39 pass, 0 fail, 0 skipped.`; exit 0 | `output/phase-1-0b/22-full-smoke.log`; `output/phase-1-0b/full-smoke/summary.json` | `fb0e553` |
| Repository develop-web-game client and artifact assertion | `Skill client artifacts valid: Game state, shot-0.png, 0 browser-error files; player=(81,214), shots=1.`; exit 0 | `output/phase-1-0b/24-skill-client.log`; `output/phase-1-0b/skill-client/` | `fb0e553` |
| Source budget and required smoke audit | `Scene input audit PASS: 0 scene-owned raw key reads across src/scenes/.`; `Game size audit PASS: 3846 lines (baseline 3928; net -82).`; required 4c/13d source unchanged; only existing suppression; exit 0 | `output/phase-1-0b/25-source-audit.log` | `fb0e553` |

- The first separate skill client completed but captured StageSelect; this failed its Game-state assertion and is preserved in `skill-client-initial/` with `23-skill-client.log`. Extending startup and sending a second explicit confirm burst produced the final Game capture; no runtime change was made for client readiness.
- Engineer opened all 44 final smoke PNGs through eight native-cell sheets (`output/phase-1-0b/contact-sheets/final-01.png` through `final-08.png`), plus the original charge-shot capture and both native skill PNGs. Dialogue, menu selection, weapon/saber shots, actor position, and separated HUD remain visible; known toast/title/touch/private-art debt is unchanged. Full PNG index: `output/phase-1-0b/final-contact-manifest.txt`.
- QA closed final source review; Orchestrator and Director opened all eight final contact sheets covering all 44 PNGs, inspected the full 39-pass summary, and found no new input-related visual blocker. The whole final browser tree is preserved in `output/phase-1-0b/full-smoke/`; the contact manifest records original capture paths with identical preserved copies there. EVAL-P1-010 is PASS at `fb0e5532fe552477f6b28c9fbf2d9e06cfe64341`.
- No new multi-mission visuals, atlas, or boss presentation changed, so the already-inspected ten-mission baseline sweep remains the relevant visual evidence. The full verify components (sprites, tests, build, smoke) all passed separately for this input slice.

### Enemy planning supplement evidence — EVAL-ENEMY-PLAN-001

| Command / check | Result line / exit | Artifact | Commit |
| --- | --- | --- | --- |
| `node output/enemy-design-plan/audit-enemy-plan.mjs` before brief | `Enemy plan documentation audit FAIL: 12 families, 10 stages, 0 future acceptance rows; 57 missing requirements.`; exit 1 | `output/enemy-design-plan/01-doc-audit-red.log`; `audit-red.json` | planning supplement |
| Same audit after synthesis-corrected one-family pilot fixture, still before brief | `Enemy plan documentation audit FAIL: 12 families, 10 stages, 0 future acceptance rows; 57 missing requirements.`; exit 1 | `output/enemy-design-plan/02-synthesized-audit-red.log` | planning supplement |
| Same audit after reviewed brief | `Enemy plan documentation audit PASS: 12 families, 10 stages, 10 future acceptance rows; 0 missing requirements.`; exit 0 | `output/enemy-design-plan/03-doc-audit-green.log`; `audit-green.json` | planning supplement |
| `npm run test` | `Test summary: 12 passed, 0 failed`; `# pass 198`; `# fail 0`; exit 0 | `output/enemy-design-plan/04-docs-test.log` | planning supplement |
| `npm run build` | `✓ built in 3.70s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; exit 0 | `output/enemy-design-plan/05-docs-build.log` | planning supplement |

- EVAL-ENEMY-PLAN-001 is PASS for documentation completeness only in the planning commit containing this record. It does not approve variant/pilot targets, prove working monsters, satisfy runtime/art evals, or release STOP 1.0b. Existing phase eval statuses are unchanged; the input SHA is now pinned as `fb0e5532fe552477f6b28c9fbf2d9e06cfe64341`.
- Text and log artifacts were opened and inspected. The 132-line working brief covers all actual families/stages, source-verified prerequisites, the recommended one-family/two-biome pilot, local routines, measurable future evidence, original graphics workflow, and pending phase ownership. All gameplay and asset decisions remain for their existing STOP reviews.

## Open risks and known debt

- Audited enemy attack dispatch/aim/interruption, terrain sensing and animation-event routing gaps are recorded in `docs/working/enemy-ecology-and-variant-plan.md`; they remain prerequisites for future variants, not fixes delivered by this planning supplement.

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
- Carry `docs/working/enemy-ecology-and-variant-plan.md` into Phase 1.6 stage briefs and the completed Prompt 02/03 handoffs. Preserve Craig’s request for deeper monsters, stage-specific features and a living world; its family/variant/pilot recommendations remain pending the existing STOP reviews.
