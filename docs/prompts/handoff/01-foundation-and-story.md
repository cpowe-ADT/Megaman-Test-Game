# Handoff 01: Foundation and story

## Status: PARTIAL (list what is missing and why)

Phase 1.0 is complete: Craig approved STOP 1.0, and the baseline checkpoint and CI are committed. Phase 1.0b is committed with gates and review green at `fb0e553`; Craig approved STOP 1.0b; Phase 1.1 implementation and automated gates are complete, with Craig’s STOP 1.1 approval recorded below. Phase 1.2 is implemented with automated evidence green; STOP 1.2 awaits Craig’s title/subtitle review. Session 01a ends at that STOP. The separate enemy ecology request remains a planning supplement; phases 1.3–1.6 have not begun. This is a running slice memo, not an exit-gate handoff.

Session 01a review supplement (2026-09-10): the four confirmed defects and the repeat-key scroll regression are repaired and green (see `EVAL-P1-REVIEW-001`); the repairs are in the worktree awaiting Craig's commit. STOP 1.2 (title treatment and subtitle) is still awaiting Craig's answer; the recommended answer is yes. Next session is 01b: Phase 1.3 story bible and script, then Phase 1.6 stage briefs.

Session 01b (2026-09-10): Phase 1.3 is complete and committed (`0e4ea1b`, EVAL-P1-006 gate PASS; Craig's reading of the script is the review half at STOP 1.3). Phase 1.6 briefs are written (`docs/design/stage-briefs.md`, EVAL-P1-012 pending Craig's approval at STOP 1.6). Phases 1.4 and 1.5 (session 01c) have not begun.

## Branch and final commit

Branch: `codex/mega-runtime-and-assets-pass`. Approved baseline checkpoint: `35a1fba89ae77d5c900d65486994f5620df48834`, `checkpoint: pre-completion baseline (gates green)`. CI: `bf216acc9d7c872586ff35e6902af7c5d2f5dd6c`. Input slice: `fb0e5532fe552477f6b28c9fbf2d9e06cfe64341`, `refactor: unify scene input actions (EVAL-P1-010)`. Enemy plan: `cc3b91c5e872e6fff0519f44c505632f1891bc7e`. Final prompt commit: pending; later slices remain.

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

### Phase 1.1 design memo — EVAL-P1-003 / 004 / 011

- Understand: make the default campaign an authored, open eight-warden route while preserving seeded Randomizer saves and tests.
- Understand: give every Classic upgrade a real runtime effect, expose truthful stage information, and count campaign statistics now.
- Director intent: full-width 3×3 grid, preview below, readable full titles, 32×32 portrait reservations, pips, own rewards and weaknesses at 448×252.
- Mode seam: `progression/types.ts`, `seed.ts`, and `state.ts` carry explicit mode; missing mode remains legacy Randomizer.
- Compatibility: one-argument `createFreshProgressionState(seed)` remains Randomizer; new user saves and New Campaign explicitly select Classic.
- Classic seed is literal `classic`; URL seeds apply only to explicit Randomizer, never to an existing save.
- Transport rejects unknown modes and cross-mode imports before any write; a mode-less transport is Randomizer.
- New Campaign seam: one cancel-safe chooser for Title and both system-menu callers; difficulty starts Normal and persists for Phase 02.
- Randomizer availability: completed game or central `modifier` action held at chooser entry; opening/cancelling cannot erase a save.
- Upgrade seam: a pure mode-aware resolver feeds player motor, combat, projectile affordability/spawn and contact damage handling.
- Classic follows the table below; legacy Randomizer retains helmet checkpoint access, body +2 HP and its prior chip effects.
- Damage rule: body armor scales ordinary damage, while fatal fall damage remains fatal; fractional HP survives save/load without rounding.
- Buster damage must be applied once at projectile creation and not again on bosses; failed projectile allocation spends no energy.
- ArcSlash uses an explicit saber-release projectile identity, damage 2/speed 260/life 600; it never enters the cycling weapon list.
- Arms cap both charge cues and released shots at tier 3 unless owned; legs gate Classic air dash; helmet suppresses contact hurt response only.
- Statistics proposal: count active gameplay time excluding pauses/dialogue; count each lethal defeat once and successful boss-clear time once.
- Statistics proposal: secrets count unique heart/sub location claims; keep elapsed time in memory and flush at existing save/claim/checkpoint boundaries.
- Transport proposal: reset run-specific statistics on import because the payload does not carry source timing; preserve validated story flags for later registry filtering.
- Save seam: normalize/clone/fallback/import preserve mode, difficulty, stats, storyFlags and finite fractional active-run HP.
- Content seam: campaign district/difficulty metadata; StageSelect layout/model; typed debug grants and concise automation state.
- Red first: new Classic world/transport, fractional-save/statistics and actual upgrade-consumer tests; untouched Randomizer tests remain regression authority.
- Browser checks: Classic scenario 33, Randomizer assertion in 4b, ArcSlash release in 12, chooser cancel/held-confirm and native layout evidence.
- Gates: focused tests/browser then full test/build/sprites/smoke, one final visual sweep and separate develop-web-game client; preserve and open every capture.
- Budget: extract typed debug/upgrade/stats seams so Game.ts stays below 3846 lines; no suppression or art work in this slice.
- Review: QA/Director/Orchestrator inspect code and artifacts before commit; record these provisional statistics/compatibility choices at STOP 1.1.
- Carry forward: original graphics authorization and the enemy ecology plan at `cc3b91c5e872e6fff0519f44c505632f1891bc7e` remain scheduled at their existing later STOPs.

| Rule | Classic | Relay Randomizer compatibility |
| --- | --- | --- |
| Entry and stage access | Tutorial first in UI; all eight wardens available afterward | Seeded stage-access rewards and existing route |
| Seed | Literal `classic` | Seeded/generated, visible with reroll; URL seed only on explicit creation |
| Boss rewards | Own warden weapon; tutorial `arc_slash` | Existing seeded placements |
| Weakness | Fixed elemental cycle; Buster always works | Existing seeded profiles/strictness |
| Final gate | Exactly eight medals | Existing seeded gate and full-clear prerequisites |
| New Campaign | Default; Normal difficulty preselected | Available after completion or Shift at entry |
| Legacy saves/transports | Explicit mode required | Missing mode preserves Randomizer; cross-mode imports rejected |
| Upgrade compatibility | Exact table below, no legacy extras | Existing checkpoint/HP/chip effects retained |

| Stage | Boss clear | Capsule | Sub location | Heart location | Bonus pickup |
| --- | --- | --- | --- | --- | --- |
| tutorial_sentinel | arc_slash | hp_refill_large | — | — | hp_refill_large |
| pyro_maw | FlameSerpent | chip_buster_plus | hp_refill_large | heart_tank | hp_refill_large |
| tide_reaver | HydroLance | chip_quick_charge | sub_tank | heart_tank | hp_refill_large |
| volt_hopper | ThunderSpike | armor_legs | hp_refill_large | heart_tank | hp_refill_large |
| basalt_titan | QuakeKnuckle | armor_body | sub_tank | heart_tank | hp_refill_large |
| ferro_blade | MagcutDisc | armor_arms | hp_refill_large | heart_tank | hp_refill_large |
| mire_wraith | AcidGlob | chip_weapon_plus | sub_tank | heart_tank | hp_refill_large |
| gale_vixen | AeroDarts | chip_speedster | hp_refill_large | heart_tank | hp_refill_large |
| glacier_ronin | FrostShatter | armor_helmet | sub_tank | heart_tank | hp_refill_large |

| Upgrade | Classic runtime effect | Consumer / risk |
| --- | --- | --- |
| armor_helmet | No hitstun from enemy/boss contact | Keep damage/iframes; suppress pending hurt-state trigger |
| armor_body | Ordinary damage ×0.75 | Fractional HP transport; fall remains lethal |
| armor_arms | Unlock charge tier 4 | Both held cue and release cap |
| armor_legs | Unlock one air dash per airtime | Landing resets entitlement |
| chip_quick_charge | All charge thresholds ×0.7 | Boundary tests through combat |
| chip_speedster | Run/dash speed ×1.12 | Body velocity cap; Classic wall-jump unchanged |
| chip_weapon_plus | Special energy cost −1, minimum 1 | Check reduced affordability before spawn; Buster stays free |
| chip_buster_plus | Uncharged Buster pellet damage 2 | Same damage on enemies/bosses, no duplicate bonus |
| heart_tank | Max HP +2 per unique tank | Existing eight-tank cap |
| sub_tank | Store up to four tanks | Use surface remains Phase 1.5 |
| arc_slash | Saber release emits one arc | Explicit identity independent of equipped special |

## Decisions made (each with the reason and what it forecloses)

- Craig approved STOP 1.0b verbatim: "approved lets go the the next level". Accepted input decision: cancel only the pending charge when opening the system menu; require a fresh trigger after resume. This avoids deferred firing or a stuck charge without resetting health, cooldowns, or invulnerability. It forecloses banking a charge through pause; This is the accepted pause behavior going into Phase 1.1.
- No runtime sensor adjustment: the existing 14×54 Buster sensor demonstrably damages the shortest enemy; changing it without a current failure could regress platform/world-bound behavior.
- Stronger test evidence: missing targets and other damage sources must fail, so a green smoke result proves actual uncharged pellet contact.
- Craig approved STOP 1.0 verbatim: "approved yes commit it and you remeber i want oen tha tworks on graphics where you use your chat gpt image or editign skils to create ebtter vwtor files and  asytem doto doi it if you ahve to pgoram somethign to do it you can".
- Applied the approved ignore additions (`tmp/`, `output/`, `__pycache__/`, `*.py[cod]`), retained build-required `types/`, and committed the baseline as `35a1fba`. Staged content excluded scratch, private runtime assets, and caches; existing Markdown hard-break whitespace and an original blank EOF were preserved.
- Graphics requirement: keep a dedicated Art Director/Animator seat for original asset production using ChatGPT image generation/editing, with editable vector files where appropriate and a reproducible import/validation pipeline. Engineering may build tooling for that workflow. Generated raster art is not described as editable SVG; use genuine vector paths for scalable interface/icons and preserve layered or source raster assets for sprites. No Capcom-derived public assets; existing art pilot reviews and STOPs remain mandatory. This CI slice adds no art.

### Phase 1.1 implementation and review

- `src/progression/{types,seed,state,presentation,upgrades,statistics}.ts` now separate authored Classic progression from compatible seeded Randomizer worlds. Classic stored worlds and imports normalize to the canonical 43-location layout; explicit unknown/cross-mode imports fail before writes. Existing `tests/progression-state.test.ts` is unchanged.
- `src/systems/Save.ts` defaults new users to Classic/Normal, preserves positive fractional HP, difficulty, story flags and statistics, and keeps mode-less existing saves Randomizer. The shared `NewCampaignScene.ts` and pure `menu/newCampaignModel.ts` open without writes, allow cancellation without losing the active run, and commit exactly once after fresh confirmation. Shift is read from the central physical-input hub even when a system menu owns input.
- `src/player/` consumes the pure Classic upgrade table immediately on pickup/grant/reentry. Helmet removes contact hitstun and forced hurt animation while retaining damage, iframes and knockback. Body armor preserves lethal-fall semantics. Arms cap charge cues and release consistently; legs permit one air dash per airtime; Speedster scales Classic run/dash only. Randomizer retains existing helmet checkpoint access, body +2 HP, movement ×1.15 including wall jumps and legacy boss damage bonuses; its preexisting unused quick-charge helper is not newly enabled by this slice.
- `src/projectiles/firePlayerShot.ts` checks discounted cost before allocation, spends nothing on allocation failure, and applies ordinary Buster damage once. ArcSlash carries an explicit identity through the actual saber release, uses damage 2/speed 260/lifetime 600ms, and leaves the equipped special weapon and its energy unchanged. Rejected/orphan/repeated/fast-tap releases are covered. Blocking dialogue now cancels pending charge and saber release through the same narrow seam already approved for menus; no cooldown, HP or iframe reset occurs.
- Statistics count active control time in memory, flush at lifecycle/checkpoint/claim/manual save and valid load, count each lethal defeat once, retain each stage's first successful boss-clear time, and deduplicate heart/sub secrets. Successful progression imports reset statistics because source timing is absent; validated string story flags remain for Phase 1.4 registry filtering. These semantics remain explicit recommendations for STOP 1.1 review.
- `src/content/campaign.ts` adds all ten district names and provisional 1–3 difficulty ratings. The native Stage Select grid reserves 32×32 portraits, shows full names/pips, mode/warden count, own rewards and owned-weapon weakness revelation, with preview below. Its selected outer tile stroke replaces the inner outline that crossed glyphs. Independent text/panel bounds and the 64-character wide seed case pass at 448×252; Director and Orchestrator opened and approved the corrected native captures.
- `src/scenes/game/ProgressionDebugHooks.ts` owns validated automation-only `grantWeapon`/`grantUpgrade` hooks, merging Game hooks and exposing only those two in Stage Select. The held-input lifecycle fixture now checks that ownership precisely. `main.ts` exposes mode, chooser, stats/upgrades and native layout evidence; architecture/testing/quality-gate docs describe the updated contracts.
- QA and Orchestrator closed source review for mode transport, actual motor/combat/fire consumers, save-time flushing, fractional HP, helmet animation, charge cancellation and hook lifetimes. `Game.ts` shrank 3846→3805 lines; it remains the only existing `@ts-nocheck` file. No graphics or deeper-enemy implementation belongs in this slice.
- Full verification exposed scenario 29's timing contamination: its own live mine bot emitted `enemy_mine_drop`, which legitimately intercepted the ordinary Buster before contact. A traced reproduction records no prior hostile bullets and clash `sourceId=enemy_1`; no runtime hitbox/input repair was justified. Scenarios 29 and 33b now clear prior hostile projectiles and construct the isolated target with AI and projectile emission disabled, restoring spawner flags afterward. The normal collider, Arcade physics, HP and damage reception remain active; bounded observed-contact waits replace fixed waits. Strict 5→4/5→3 assertions remain; separate scenarios 17/19 still prove interception and charged survival.
- STOP recommendations not silently added: keep literal Randomizer eligibility (`gameCompleted` or Shift at opening); consider persistent earned access later. ArcSlash is a free saber ability with no separate energy bank. Keep the exact Classic/legacy split and the statistics/import semantics above. Original graphics authorization, editable-vector/source pipeline and deeper-monster planning remain scheduled at their existing Phase 1.6/02/03 STOPs.

### Phase 1.2 design memo — EVAL-P1-005

- Approval: Craig replied verbatim, "There shoudl be 1 or 2 more porompts lets complete those"; Orchestrator accepts STOP 1.1 and authorizes the final part-01a identity slice only.
- Pin Phase 1.1 and approved EVAL-P1-003/004/011 to `475ab82f39d31121e868d4bdd86f983f9bd82428`; no Phase 1.3 work.
- Understand: give the game one original public identity without changing its mechanics, story structure or art assets.
- Director: exact OMEGA RELAY title, centered at224/30 in30px display font (28px only if actual bounds require); remove detached X.
- Director: full EIGHT WARDENS. ONE MANUFACTURED CRISIS. subtitle on360px rail at224/68,9px font and at most0.5px spacing; no ellipsis.
- Identity seam: one frozen IDENTITY object with all exact prompt constants and nested frozen DEV_SKIN; public flag1 always disables private skin.
- Source-authority choice: include a nested frozen WARDEN_NAMES map for the eight existing names, preserving IDs/casing and avoiding a second naming authority.
- Dialogue adapter seam: override bundled proper speaker names from identity before registry construction, retaining generic hero interpolation and the unchanged v1 document/schema.
- Public HUD uses WREN; developer HUD label is conditional on non-null private manifest and public flag not1. Narrative hero token always uses WREN.
- Asset-selection seam: Preload merges private only when DEV_SKIN.enabled; flagged development preview must report base manifest and zero private overrides.
- Packaging boundary: no public dist is produced; Vite private-file copying and original base-art replacement remain Phase04/03 debt, respectively.
- UI seams: Title, HUD, Game token/name, StageSelect title/descriptor/terms, Completion and existing roster/campaign proper names; README/index/package/lock and old player-art comment.
- Stage Select must retain its approved grid/preview/footer geometry and explicitly include 8 WARDENS + OMEGA alongside WARDEN SELECT without overlap.
- Red first: execute the actual identity source under manifest/environment truth-table inputs, assert top/nested freezes/exact data and meaningful lexical scan fixtures; then scan all required TypeScript sources.
- Browser proof: scenario4 captures true native Title as shot0 before Controls; retain Controls separately and verify return. Check actual title/subtitle bounds, HUD label and manifest choice in both developer and flagged base previews.
- Focused gates precede one full verify coverage, global-HUD sweep and separate repository develop-web-game client; preserve and open every produced PNG/JSON.
- Record ledger/progress/canonical testing and charter facts, keep Game.ts at or below3805 lines, obtain read-only source/artifact reviews, commit then STOP1.2.
- Carry original ChatGPT graphics/editable-vector pipeline authorization and deeper enemy ecology plan forward; this slice creates no assets and releases no later STOP.

### Phase 1.2 gate repair memo — boss boundary lifecycle

- Understand: the otherwise green identity verification exposed a preexisting strict Volt-room bounds failure in the visual sweep.
- Preserve: first sweep failed at rounded x1353 against outer max1352; its later samples were not written because validation threw first.
- Diagnose: retained Volt trace did not repeat that outer failure, but proved POST_UPDATE x1350.5667 beyond safe1348 after worldstep/controller clamps.
- Cause: Arcade applies pending body delta to the container in Body.postUpdate after the existing worldstep listener and scene update.
- Narrow design: run the final guard after Arcade POST_UPDATE and synchronize body position from the clamped container; preserve y, vertical velocity and existing room margins.
- Red first: use actual browser controller/body event sequence with queued outward displacement at both edges; assert synchronized final positions, preserved vertical motion and subsequent inward movement.
- Lifetime check: the final guard must detach when its controller is destroyed.
- Tooling correction: persist sweep movement samples before assertions, including raw container/body positions; keep the same thresholds and sample count.
- Gates: focused boundary browser case first, then repeat affected full runtime verification and the sweep; no tolerance increase or gameplay tuning.
- Scope: no new art/story; Game.ts budget unchanged; document this evidence-driven gate repair in the identity commit.

### Phase 1.2 implementation and review

- `src/content/identity.ts` exports frozen IDENTITY and nested frozen DEV_SKIN/WARDEN_NAMES objects. Exact public constants match the prompt; the extra eight-name map preserves existing names/casing while making identity the source for campaign/roster display names. Internal `robot_master`, `ROBOT_MASTER_STAGE_IDS` and `robot_master_clear_count` IDs remain unchanged as Prompt04 cleanup debt.
- Title now renders one centered OMEGA RELAY text object with the exact full subtitle on its widened rail. Measured native title bounds are x101–347 (246px) and subtitle x126.5–321.5 (195px). Warden Select places its title left and `8 WARDENS + OMEGA` right on the first header row; neither intersects the existing mode/progress row. Grid, names, pips, portrait reservations, preview and footer retain the approved Phase1.1 geometry.
- Title/HUD/Game/menus/Completion/roster/campaign terms now consume identity. README, HTML title and package/lock names are updated and asserted; the player override comment no longer names the franchise. Narrative `{hero}` always resolves WREN, even when the developer HUD uses the private label.
- `src/content/dialogue/index.ts` adapts proper speaker display names from identity before creating the generic registry, preserving v1 schema/authored lines, hero token and input objects. A deliberately stale valid speaker document failed against the actual adapter before repair; all eight warden labels plus operator/antagonist now follow identity rather than the JSON’s duplicated labels.
- `Preload.ts` follows DEV_SKIN when choosing private versus base atlas merge. Six actual-module cases cover null/present manifest × unset/0/1 public flag; only present plus not1 enables private. A missing compile-time global is handled as no private skin for headless logic tests.
- Native browser proof separates Title (`shot-0.png`), Controls (`shot-1-controls.png`), Warden Select (`shot-2-stage-select.png`) and HUD (`shot-3-hud.png`). State includes actual geometry, identity/HUD/manifest pairing and resolved WREN dialogue. Initial base capture occurred during entry fade; preserved it, then waited for the actual camera fade completion for the final bright capture without a runtime timing change.
- Public-flag evidence uses a development server only: WREN, `manifestMode=base`, zero private overrides. Ordinary developer evidence retains its private HUD/art pairing. No flagged dist is produced, no public artifact is distributed and no asset is created; Vite private-file copying remains Prompt04 packaging debt, and existing base artwork still needs original-art acceptance in Prompt03.
- QA closed source review, including actual-module freeze/truth-table tests, the lexical source scan and stale-dialogue adapter fixture. Director/Orchestrator opened all12 focused native screenshots and corresponding JSON; title/subtitle and bright base WREN HUD are approved by the review seats. Craig’s title treatment/subtitle decision remains STOP1.2.
- `Game.ts` remains3805 lines; adding the identity import is offset by removing a redundant string-conversion variable, preserving the original spacing and only existing top-of-file suppression. The first typecheck exposed old Game type errors because an import temporarily preceded that directive; restored its original placement, then the focused typecheck passed. This is an editing-order correction, not new suppression or claimed debt removal.

- The first sweep failed Volt’s unchanged outer bound (rounded1353 >1352). A retained trace then showed a safe-bound overshoot1350.5667 >1348 without repeating that outer failure. The controlled actual controller/Arcade lifecycle fixture reproduced both outer failures (right1353.3333, left950.6667), then passed after the three-line repair: final clamp on scene POST_UPDATE, body synchronization and matching destruction unsubscribe. It preserves vertical position/velocity and allows the next inward step; no margins or tuning changed.
- Scenario8’s screenshot/state precede the controlled boundary probe; `boundary-lifecycle.json` is the proof for both edges and listener cleanup. The sweep now persists raw X/body/velocity samples before assertions so failures retain diagnostics. QA and Orchestrator closed the repair source review; the full runtime gates are repeated because this code changed after the first green identity verify.

### Session 01a review memo — EVAL-P1-REVIEW-001

- Understand: audit everything delivered in01a against the charter and phases1.0/1.0b/1.1/1.2, then repair only demonstrated regressions or missed requirements.
- Player-facing intent: keep the accepted controls, Classic campaign and original identity working consistently through menus, saves, combat and built runtime loading.
- Baseline: clean `6fa380e53af489fe64d690e0f95e71e530f9c6bc`; prior evidence is immutable; Game.ts ceiling3805 and sole existing suppression remain.
- Scope: review supplement only; STOP1.2 title/subtitle approval remains pending and no Phase1.3 or later feature is started.
- Review seats: QA reads input/save/upgrades; Director reads UX/captures; Orchestrator reads identity/boss/requirement coverage; Engineer is the only writer.
- Files initially touched: this partial handoff, the ledger, progress.md and fresh `output/phase-1-review/` logs/artifacts; canonical testing/charter notes may need evidence corrections.
- Coverage: focused action/Classic/upgrade/save/session/identity tests and CI/worktree audits precede one fresh full verify, full ten-mission sweep and separate repository game client.
- Built-loader gap: the identity slice changed Preload selection but only exercised development servers; add focused smoke4 against the actual ordinary developer build via SMOKE_SERVER=preview after the fresh build.
- Public-label proof remains a flagged development-server/base-manifest client; no flagged dist or public distribution is created.
- Failing-first policy: report each concrete finding, append its narrow repair design and capture a meaningful failing assertion before implementation; a fresh green audit does not justify speculative code changes.
- Risk: quick input transitions, modal ownership, fractional HP and upgrade routing require actual consumers; preserve existing strict hit, mode and boss-boundary assertions.
- Artifact contract: preserve every failed/successful run tree before another script overwrites its working output; open every produced PNG and inspect matching JSON.
- Review artifacts use at most six native cells per sheet with a complete manifest for the read-only seats.
- Completion: resolve review findings, paste literal gate lines and artifact paths, add a separate review eval/progress record, obtain final source/artifact review and commit the bounded supplement.
- Preserve original graphics/vector pipeline authorization and deeper-monster planning at their existing future STOPs; this audit does not produce art or expand those plans.

### Session 01a review repair memo — chooser visible focus

- Finding from Director/root: the eligible Classic chooser includes seed row2 in keyboard navigation while rendering it as an empty string.
- Actual sequence: Shift+New Campaign starts Classic; Down moves Difficulty→Mode, and a second Down loses the visible highlight on an empty seed row.
- Red first: extend existing scenario33 with native focus capture and actual scene-row/text/visibility evidence before the assertion; retain failed artifacts.
- Acceptance: ordinary Classic uses rows0/3, eligible Classic0/1/3, and Randomizer0/1/2/3; upward/downward wrapping and switching back to Classic keep visible focus.
- Narrow seam: NewCampaignScene shares one active-row calculation between movement and row visibility; no layout, choice, storage or confirmation behavior changes.
- Preserve the existing cancel/save-byte, long-seed, held confirmation and Classic progression checks; final full/browser-preview gates cover the same scene.

### Session 01a review repair memo — first-launch Escape

- Candidate: Title Escape calls Save.clearActiveRun even when no campaign exists; persisting fallback state makes the next Enter bypass first-launch difficulty selection.
- Red first: empty storage→Title→Escape→Enter must still open NewCampaign with Normal selected, with captured scene/storage evidence and a focused Save no-write fixture.
- Narrow seam: make clearing a nonexistent saved run a no-op while preserving actual run removal and invalid-run normalization for existing saves.
- Acceptance: fresh users always see the required difficulty chooser; clearing an existing active run still retains progression/statistics and cancellation remains transactional.

### Session 01a review repair memo — focus-loss cancellation

- QA reproduced keydown→window blur before sampling: the queued press survives held.clear, starts charging with no held key and never receives a release.
- The already-active variant can synthesize a release projectile; simply clearing edges would strand its charge instead.
- Red first: execute actual input/action/controller/combat source with controlled browser events; cover queued/cached input, active charge, repeat-only reentry, touch union, paused underlays and cleanup.
- Accepted policy: focus loss cancels pending charge/saber release and clears keyboard/touch/pulse/edge state; return requires a fresh trigger, with no deferred shot or menu confirmation.
- Narrow seam: per-game blur reaches all live scene adapters; a cancellable subscription invokes the existing runtime charge cancellation and touch presenter's pointer/visual reset.
- Preserve: normal keyboard/touch handoff, current HP/iframes, dash timers and attack cooldowns; no Game.ts growth or broad input rewrite.
- Browser acceptance: focus loss during charge yields zero shots, fresh input works, touch pointer/glow state resets, and destroyed adapters remove subscriptions.
- Root review adds a focused repeat-key fixture: default scrolling prevention must still run on repeated arrows/Space before suppressing action repeats.

### Session 01a review repair memo — locked Randomizer guidance

- Root/Director compared the approved input-slice preview with Phase1.1 and found that a locked Randomizer stage lost its access-item requirement text.
- Red first: existing scenario4b selects locked Tide and captures native preview text/geometry before requiring NEEDS: Tide Reaver Access.
- Narrow seam: the second preview row uses the existing getStageAccessRequirementLabel for inaccessible nonfinal stages; Classic, accessible and final previews retain checkpoint/check information.
- Acceptance: the restored line fits the approved preview and footer boundaries, existing progression-summary flow remains intact, and no unlock rules change.

## Content inventory (tables: stages, bosses, dialogue sequences, assets, audio cues; counts, not prose)

| Inventory | Count | Status |
| --- | --- | --- |
| Stages | 10 | District and provisional difficulty metadata added in Phase 1.1 |
| Bosses | 10 | Existing roster; unchanged |
| Dialogue sequences | 20 + 3 milestones | Existing v1; unchanged |
| Runtime assets | 153 | Developer build, including private overrides |
| Audio cues | 6 | Existing music cue map; unchanged |
| Classic item placements | 43 | 3 tutorial + 5 per warden |
| Classic armor/chips and saber ability | 8 + 1 | Four armor, four chips, ArcSlash |
| Classic heart/sub tanks | 8 + 4 | Location claims; sub-tank use remains Phase 1.5 |

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

### Classic campaign and upgrade evidence — EVAL-P1-003 / 004 / 011

All paths below are under `output/phase-1-1/`; commit is the Phase 1.1 commit containing this record. The overall first `verify` invocation failed its smoke component; its successful unchanged runtime components plus the final full smoke supply the final verify coverage.

| Command / check | Result line / exit | Artifact |
| --- | --- | --- |
| Initial Classic/upgrade checks before implementation | Missing `generateClassicWorld` / `upgrades` modules; `# pass 0`; `# fail 2`; expected exit 1 | `01-classic-upgrades-red.log` |
| Fast saber tap and canonical stored-Classic regressions before repair | `# pass 14`; `# fail 2`; expected exit 1 | `05-review-red.log` |
| Dialogue charge precondition regression before cancellation | `blocking dialogue must cancel pending charge`; `true !== false`; expected exit 1 | `15-dialogue-charge-precondition-red.log`; `dialogue-charge-red/` |
| Native selected-outline geometry before correction | `selection outline crosses title`; expected exit 1 | `16-selection-outline-red.log`; `selection-outline-red/` |
| `node --loader ./tools/ts-node-loader.mjs --test tests/progression-classic.test.ts tests/upgrades.test.ts tests/campaign-session.test.ts tests/progression-state.test.ts tests/save-system.test.ts tests/player-combat.test.ts tests/player-motor.test.ts` | `# pass 65`; `# fail 0`; exit 0 | `17-focused-tests-final.log` |
| Seven selected browser cases before ownership fixture update | 6 pass, 1 fail (obsolete blanket no-stageDebug assertion); exit 1 | `19-focused-final.log`; `focused-lifecycle-failure/summary.json` |
| Ownership-specific held-input lifecycle case after fixture correction | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 1 pass; exit 0 | `20-lifecycle-contract.log`; `lifecycle-contract-green/summary.json` |
| `npm run verify`: sprite component | `[sprites] Manifest valid (25 entries, 25 ready, 0 planned)`; `[sprites] Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)`; component exit 0 | `21-verify.log` |
| `npm run verify`: test component | `Test summary: 12 passed, 0 failed`; `# pass 218`; `# fail 0`; component exit 0 | `21-verify.log` |
| `npm run verify`: build component | `✓ built in 3.81s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.`; component exit 0 | `21-verify.log` |
| `npm run verify`: first full smoke | `Expected exactly one uncharged Buster damage: 5 -> 4 HP.`; actual 5; 37 earlier passes then fail; overall verify exit 1 | `21-verify.log`; `full-smoke-first-failure/summary.json` |
| Scenario 29 traced reproduction | Same strict 5→4 assertion fails; own target `enemy_1` emits `enemy_mine_drop`, prior hostile bullets empty; exit 1 | `22-pellet-clash-trace.log`; `pellet-clash-trace-red/29-pellet-hits-short-enemy/pellet-evidence.json` |
| Isolated ordinary/upgraded pellet plus unchanged clash scenarios | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 4 pass; exit 0 | `24-isolated-pellet-and-clashes.log`; `isolated-pellet-and-clashes-green/summary.json` |
| Final full `SMOKE_PORT=4400 npm run test:smoke` | `Full smoke summary: 41/41 pass, 0 fail, 0 skipped.`; exit 0 | `25-full-smoke-final.log`; `full-smoke/summary.json` |
| `SWEEP_PORT=4400 npm run test:visual-sweep` | `Mission visual sweep complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/mission-visual-sweep`; 10/10 pass; exit 0 | `27-visual-sweep.log`; `visual-sweep/summary.json` |
| Repository develop-web-game client plus artifact assertion | `Skill client artifacts valid: Game state, shot-0.png, 0 browser-error files; player=(60,214), shots=1, mode=classic.`; exit 0 | `29-skill-client.log`; `skill-client/` |
| Source budget / compatibility audit | `Game size audit PASS: 3805 lines (baseline3846; net-41).`; `Scene input audit PASS: 0 scene-owned raw key reads.`; only existing suppression and legacy tests unchanged; exit 0 | `26-source-audit.log` |

- Honest red classification: `10-helmet-adapter-red.log` is an import-loader failure, not a semantic helmet failure; actual browser 33b proves no contact hurt animation. Attempts 13/14 did not reproduce pending charge because their setup lacked a true Buster-charge precondition; attempt 15 established charging and failed before the narrow fix. Initial API/geometry fixture mistakes were corrected to existing contracts, not used to justify runtime API changes.
- Engineer opened every retained screenshot through `focused-contact-manifest.txt` (41 PNGs, seven sheets), `pellet-review-contact-manifest.txt` (54 additional PNGs, nine sheets), and `final-contact-manifest.txt` (50 final PNGs, nine sheets). Native 33 captures show all eight open, Flame Serpent reward, weakness `???` then Hydro Lance, full titles/pips, separated footer and wide seed wrapping. Gameplay shows standing armor-damaged player, live damaged mine bot, ArcSlash and separated HUD; existing toasts, oversized touch controls, fades and private artwork remain documented debt.
- Engineer also opened all 40 final sweep captures through `sweep-contact-manifest.txt` (seven sheets) and the original native `skill-client/shot-0.png`, with its state JSON. Sweep actor/terrain/dialogue presentation remains visible; Volt’s private strip, Glacier’s low silhouette, repeated checkpoint toasts and truncated boss phase labels remain known debt. The skill capture shows the grounded player and one ordinary Buster projectile in Classic, with no browser errors.
- QA closed source and fixture review; Orchestrator and Director opened all final 50 smoke and 40 sweep captures, plus native Classic captures, with no new blocker. Orchestrator also opened the native skill PNG/state. All slice-owned browser/server processes have stopped; preexisting user development servers remain untouched. EVAL-P1-003 and EVAL-P1-011 automated gates are PASS.
- At the Phase1.1 commit, EVAL-P1-004 awaited Craig’s review despite green automation/review-seat evidence. Craig approved it at Phase1.2 entry (verbatim reply above); its ledger row now pins PASS to `475ab82`. This partial handoff does not claim Prompt01’s Exit Gate.

### Identity evidence — EVAL-P1-005

All paths below are under `output/phase-1-2/`; the Phase1.2 commit containing this record pins this evidence. This is a completed slice, not Prompt01’s Exit Gate.

| Command / check | Literal result / classification | Artifact |
| --- | --- | --- |
| Initial actual-identity/lexical tests | `# pass 1`; `# fail 8`; expected exit1: old source labels plus missing new module | `01-identity-red.log` |
| Actual dialogue adapter with stale valid labels, before repair | `# pass 9`; `# fail 1`; expected stale-name assertion red | `09-dialogue-name-red.log` |
| `node --loader ./tools/ts-node-loader.mjs --test tests/identity-strings.test.ts tests/dialogue-content.test.ts` | `# pass 17`; `# fail 0`; exit0 | `10-identity-dialogue-green.log` |
| Native private identity smoke4 | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 1pass,40filter skips; exit0 | `05-focused-private.log`; `focused-private/` |
| Native base identity smoke4, actual fade complete | Same completion line; 1pass,40filter skips; exit0 | `08-focused-base-final.log`; `focused-base-final/` |
| First full `npm run verify`, before boundary repair | `Verify PASS; full smoke summary: 41/41 pass, 0 fail, 0 skipped.`; exit0 | `11-verify.log`; `full-smoke/` |
| First visual sweep | `[volt_hopper] boss left the room bounds (1353 not in 952-1352)`; exit1 after3 earlier missions passed | `12-visual-sweep.log`; `visual-sweep-first-failure/` |
| Retained Volt trace | Outer bounds passed; safe-bound overshoot1350.5667 >1348 reproduced, not the original outer failure | `13-volt-boundary-trace.log`; `volt-boundary-trace/volt_hopper/` |
| Actual post-update boundary fixture, before repair | `boss must remain inside safe bounds after Arcade postUpdate`; expected exit1; x950.6667/1353.3333 | `14-boundary-lifecycle-red.log`; `boundary-lifecycle-red/8-boss-room-activation/boundary-lifecycle.json` |
| Same fixture after repair | `Smoke test complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/web-game-smoke`; 1pass,40filter skips; exit0 | `15-boundary-lifecycle-green.log`; `boundary-lifecycle-green/` |
| Final `SMOKE_PORT=4400 npm run verify`: sprites | `[sprites] Manifest valid (25 entries, 25 ready, 0 planned)`; `[sprites] Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)` | `16-verify-final.log` |
| Final verify: tests | `Test summary: 12 passed, 0 failed`; `# pass 228`; `# fail 0` | `16-verify-final.log` |
| Final verify: build | `✓ built in 4.08s`; `Checked 153 runtime asset files and 5 emitted build refs in dist/.` | `16-verify-final.log` |
| Final verify: full smoke | `Final verify PASS; full smoke summary: 41/41 pass, 0 fail, 0 skipped.`; overall exit0 | `16-verify-final.log`; `full-smoke-final/summary.json` |
| `SWEEP_PORT=4400 npm run test:visual-sweep` | `Mission visual sweep complete. Artifacts: /Users/thristannewman/Desktop/MEGAMAN GAME/output/mission-visual-sweep`; `Final visual sweep PASS: 10/10 missions; strict room bounds unchanged.`; exit0 | `17-visual-sweep-final.log`; `visual-sweep-final/summary.json` |
| Separate repository develop-web-game client, public-flag development server | `Skill client artifacts valid: native448x252 Game, WREN, base manifest/0 overrides, 1 ordinary Buster shot, 0 browser-error files.`; exit0 | `19-skill-client.log`; `skill-client/` |
| Source and budget audit | `Game size audit PASS: 3805 lines (baseline 3805; net 0).`; sole existing suppression; original tests unchanged | `source-audit.log` |

| Private manifest | Public flag | Actual DEV_SKIN | HUD / selected manifest |
| --- | --- | --- | --- |
| null | unset | false | WREN / base |
| null | 0 | false | WREN / base |
| null | 1 | false | WREN / base |
| present | unset | true | MEGA MAN X / base+private |
| present | 0 | true | MEGA MAN X / base+private |
| present | 1 | false | WREN / base |

- The six actual-module tests prove the truth table; browser evidence proves present/unset (11 overrides) and present/1 (zero overrides) with actual HUD labels and WREN narrative lines. Title remains OMEGA RELAY in every mode. This is identity/manifest preview evidence, not a flagged dist or public-release approval.
- Engineer opened every produced capture:12 focused,53 first-verify,22 boundary/failure,53 final-smoke,40 final-sweep and1 skill PNG (181 total). The complete maps are `focused-contact-manifest.txt`, `final-contact-manifest.txt` (first verify), `bounds-contact-manifest.txt`, `verified-contact-manifest.txt` (final verify), `sweep-contact-manifest.txt`, plus `skill-client/shot-0.png`. Matching JSON was read/parsed; final sweep includes180 retained movement samples with Volt1292–1348.
- Visual observations: complete title/subtitle and Warden Select header fit at native448×252; public WREN HUD and base sprite remain bright/readable; private HUD/art pairing is preserved; dialogue proper names and hero token are canonical. Existing toast overlap, oversized touch controls, fades, private boss effects-only/low silhouettes and phase-label truncation remain documented debt. Scenario8 PNG precedes its controlled body probe; sweep state and later screenshots are not simultaneous.
- QA and Orchestrator closed source review for identity/dialogue and the boundary lifecycle repair. Orchestrator opened all181 captures, including the client, and read the final samples. Director inspected the focused identity sets, all53 final smoke captures and all40 final sweep captures. Both visual reviews are closed with no remaining blocker. EVAL-P1-005 is an automated gate PASS; Craig’s title treatment/subtitle decision remains STOP1.2. No Phase1.3, asset generation, flagged public build, push or deployment.

## Open risks and known debt

- Audited enemy attack dispatch/aim/interruption, terrain sensing and animation-event routing gaps are recorded in `docs/working/enemy-ecology-and-variant-plan.md`; they remain prerequisites for future variants, not fixes delivered by this planning supplement.

- Scenario 29 did not reproduce at Phase 1.0 entry. During Phase 1.1, a traced failure proved the target mine bot intercepted the pellet with its own mine; the collision fixture is now isolated, with no runtime sensor change.
- `src/scenes/Game.ts` is now 3,805 lines (3,928 at entry), with the one existing `@ts-nocheck`; later prompts must continue shrinking it.
- Private player/boss overrides are developer assets, not public release assets; public stripping remains future prompt work. Volt's effects-only private cells and Glacier's low silhouette require art review in prompt 03.
- Sweep `state-boss-room.json` is sampled before movement/attack checks, while `boss-room.png` is captured afterward; they prove different points in the same encounter and must not be described as simultaneous.
- Existing checkpoint toast overlap, truncated phase labels, Gale cloud seams, and low-contrast private boss art remain visible; a green baseline gate is not final art approval.
- The existing Omega art is recorded as original generated work in its manifest/progress history, but its attribution registry lacks a complete source/author/license entry; resolve in the asset phase without inventing a license.
- Scenario4 now captures true Title as shot0 and retains Controls separately. Base preview artwork is existing work, not final WREN design; original hero/logo/UI production remains at Prompt03 STOPs.
- The production Phaser chunk warning is accepted debt under ADR-0002.

## Inputs for prompt 02 (an explicit list: files to read, decisions to honor, numbers to keep)

- Keep Phase 1.1 mode/placement/upgrade tables and the explicit compatibility/statistics recommendations above; STOP 1.1 is approved; STOP 1.2 remains pending. Difficulty values are provisional until Phase 1.6, with gameplay difficulty tuning in Prompt 02.
- Keep IDENTITY as the runtime public-name authority, including frozen warden names and the dialogue speaker adapter. Internal snake-case IDs remain stable; public packaging/private-file stripping still requires Prompt04, and the preview base art still requires Prompt03 original-art review.
- Not ready: prompt 01 exit conditions are incomplete. Read the completed version of this file before starting prompt 02.
- Carry `docs/working/enemy-ecology-and-variant-plan.md` into Phase 1.6 stage briefs and the completed Prompt 02/03 handoffs. Preserve Craig’s request for deeper monsters, stage-specific features and a living world; its family/variant/pilot recommendations remain pending the existing STOP reviews.

### Session 01b additions (story and briefs)

- Read first: `docs/design/stage-briefs.md` (the per-stage blueprint), `docs/story/script.md` (which line plays at which beat), `docs/story/style-guide.md` (before adding any text).
- Dialogue contract v2 is live: `src/content/dialogue/dialogue.v2.json` is the only source of lines; `npm run story:script` regenerates `docs/story/script.md` and a test fails if it drifts. `dialogue.v1.json` stays on disk until Phase 1.4 deletes it.
- Binding contract for prompt 02: checkpoint 2 of every stage carries `radioSequenceId` = `<stageId>_radio`; the mini-boss gate lock plays `<stageId>_miniboss`; Stage Select uses `<stageId>_restored`; briefings are `<stageId>_briefing`; finale phases are `finale_phase_1..3` on the Core's phase transitions.
- Registry API for the surfaces (Phase 1.4): `getStageSequence(stageId, trigger)`, `getGlobalSequence('prologue' | 'epilogue' | 'credits')`, `getFinalePhase(1|2|3)`, `getFirstWeaknessMilestone()`, `getRequiredStoryIds()` for story-flag parity.
- Tokens the resolver needs from every caller: `hero`, `rewardLabel`, `clearedCount`, `remainingCount`, `districtName`, `wardenName`; `Game.buildDialogueLines` already supplies all six.
- Mini-boss archetype per stage (from the briefs and the callout lines): Pyro, Basalt, Glacier = `custodian_walker`; Tide, Ferro = `relay_turret_nest`; Volt, Gale = `sentry_twins`; Mire = `drill_serpent`.
- Vertical or walled segment per stage: tutorial wall-jump shaft; Pyro, Tide, Basalt, Mire, Gale master climbs at `verticalScreens: 2`; Volt, Ferro, Glacier walled master halls; Omega Act 1 two vertical segments.
- Classic placement table (prompt 01 section 1.1) decides which `sub_tank` locations hold a Sub Tank (Tide, Basalt, Mire, Glacier); the briefs place every `heart_tank` and `sub_tank` as a gated secret and every `capsule` on the main route.
- `difficultyRating` in `campaign.ts` already matches the briefs (1, 1, 2, 2, 2, 2, 3, 3, 3, 3).
- `Game.ts` is 3,807 lines (+2 from the token values); Phase 1.4 extracts the debug-hook block so the prompt exits at or below 3,805.
