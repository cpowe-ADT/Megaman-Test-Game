# Mega Man Refactor Plan (Phaser 3 + TypeScript)
- Status: working
- Owner scope: gameplay
- Last reviewed: 2026-03-06

## 0) Context and Goals
This plan refactors the current Phaser codebase into a modular, data-driven architecture while keeping gameplay runnable at the end of every phase.

Non-negotiable outcomes covered by this plan:
1. Concrete phased execution plan with owners and acceptance criteria.
2. Target architecture for data-driven enemies/bosses, attack modules, hitbox/hurtbox, projectiles/effects, animation manifests, and level scripting.
3. Incremental migration with compatibility adapters and feature flags.
4. Risk register and rollback strategy.
5. Definition of Done checklist.

## 1) Engine-Aware Repo Audit (Current State)

### Engine and Runtime
- Engine: **Phaser 3** (`phaser@^3.80.0`) with Arcade Physics.
- Build/Test: **Vite 5 + TypeScript 5 + Playwright smoke script**.
- Entry point: `src/main.ts` creates Phaser game with scenes `[Boot, Preload, StageSelect, Game]`.

### System Map
- Boot/game loop:
  - `src/main.ts`, `src/scenes/Boot.ts`, `src/scenes/Preload.ts`.
- Entity systems:
  - Player legacy logic in `src/scenes/Game.ts`.
  - New player runtime modules in `src/player/*` gated by feature flag.
  - Enemy framework in `src/enemy/*` gated by feature flag.
  - Boss blueprint/runtime split between `src/bosses/*` and `src/boss/*`.
- Physics/collision:
  - Arcade colliders/overlaps mostly wired in `src/scenes/Game.ts`.
  - No tilemap loader; stage collision built from hardcoded rectangles.
- Animation/spritesheet:
  - Procedural fallback textures + animations in `src/scenes/Preload.ts`.
  - Player manifest in `src/player/AnimationManifest.ts`.
  - Enemy manifest in `src/enemy/EnemyAnimationManifest.ts`.
  - Boss animation setup split across `src/scenes/Game.ts` and `src/bosses/BossController.ts`.
- Attack/hitbox/projectiles:
  - Player/boss bullets and overlaps mainly in `src/scenes/Game.ts`.
  - Enemy attack phases in `src/enemy/EnemyCombat.ts`.
  - Boss attack phases in `src/boss/framework/AttackModules.ts`.
- Level/stage loading:
  - Stage select in `src/scenes/StageSelect.ts`.
  - Stage geometry hardcoded in `Game.stageConfigs`.
  - Enemy markers in `src/enemy/EnemyLevelData.ts`.
- UI:
  - HUD `src/ui/HUD.ts`, boss binder `src/boss/framework/BossUIBinder.ts`, debug overlay `src/ui/DebugOverlay.ts`, victory modal `src/ui/VictoryModal.ts`, pause/game-over scenes.
- Audio/VFX hooks:
  - Player VFX/SFX router `src/player/VfxSfxRouter.ts` (SFX currently mostly stubbed).
  - Particle effects and tint flashes in `src/scenes/Game.ts`.
  - Boss arena audio hooks emitted as events via `ArenaController`.

### Pain Points (Observed)
1. **God scene**: `src/scenes/Game.ts` owns stage building, player control, combat, enemy/boss spawn, HUD, pause, victory, debug, and adapters.
2. **Dual-path logic**: legacy vs new player runtime, enemy framework on/off, boss controller + legacy fallback in same scene.
3. **Split combat pipelines**: damage/i-frames/hit handling implemented differently for player, enemy, and boss.
4. **Hardcoded content**: stage geometry, attack spawn mapping, and several projectile/effect choices hardcoded in scene logic.
5. **Animation coupling**: animation key decisions and atlas assumptions spread across scene and entity modules.
6. **Config fragmentation**: content defined in mixed TS objects, JSON, and inline constants without unified schema/versioning.
7. **Limited regression safety for gameplay behavior**: unit tests are solid for helper logic but light on deterministic combat/state regression checks.

### Baseline Verification
- `npm test` passes (logic + scene tests) at plan start.

## 2) Migration Strategy (Playable-at-All-Times)

### Strategy Summary
- Keep old and new systems running side-by-side behind feature flags.
- Introduce adapters first, then migrate one vertical slice at a time.
- Each phase ships with:
  - runnable build,
  - smoke test pass,
  - rollback switch.

### Adapter and Flag Policy
- Add centralized runtime toggles in `src/config/refactorFlags.ts`.
- Required initial flags:
  - `VITE_REFACTOR_COMBAT_V2`
  - `VITE_REFACTOR_ENEMY_V2`
  - `VITE_REFACTOR_BOSS_V2`
  - `VITE_REFACTOR_ANIM_V2`
  - `VITE_REFACTOR_LEVELSCRIPT_V2`
- Adapters mediate old/new API boundaries, e.g.:
  - `LegacyDamageAdapter`
  - `LegacyAnimationAdapter`
  - `LegacyEnemySpawnAdapter`
  - `LegacyBossAttackAdapter`

### Team Owners (for tasks below)
- **RL**: Refactor Lead (architecture/integration owner)
- **GE**: Gameplay Engineer (combat/movement/AI)
- **CE**: Content Engineer (data/config/schema)
- **UIE**: UI Engineer (HUD/debug tools)
- **SET**: SDET/Tools Engineer (tests, smoke, debug instrumentation)

---

## 3) Phased Execution Plan (8 Phases)

## Phase 0 - Baseline, Instrumentation, and Safety Nets
**Objective**
- Freeze current behavior with deterministic checks before heavy refactor.

**Scope (files/modules)**
- Update: `scripts/smoke-test.mjs`, `src/main.ts`, `src/ui/DebugOverlay.ts`, `tests/*`
- Add: `src/tools/debug/CombatDebugBus.ts`, `src/tools/debug/StateSnapshot.ts`, `tests/combat-baseline.test.ts`

**Tasks (atomic + owner)**
1. SET: Extend smoke script to assert player HP, enemy HP, cooldown, and hit events from `render_game_to_text` snapshots.
2. UIE: Add debug overlay panels for current state machine state, HP, cooldown timers, i-frame status.
3. RL: Add deterministic state snapshot utility consumed by tests and debug overlay.
4. SET: Add baseline regression tests for damage application order and invulnerability windows.

**Compatibility/Adapters**
- No behavior replacement yet; additive instrumentation only.

**Acceptance Criteria**
- Build/test/smoke pass.
- Debug overlay displays player/boss/enemy state, HP, cooldowns, hit events.
- No gameplay behavior changes.

**Test Plan**
- Automated: `npm test`, `npm run test:smoke`, new combat baseline tests.
- Manual: play one stage, verify overlay values match on-screen outcomes.

**Risk / Rollback**
- Risk: Low.
- Rollback: Remove instrumentation commit; no content/data migration yet.

---

## Phase 1 - Core Refactor Scaffolding + Facades
**Objective**
- Introduce modular folders and facades without replacing runtime behavior.

**Scope**
- Add folders: `src/core/`, `src/physics/`, `src/entities/`, `src/combat/`, `src/ai/`, `src/attacks/`, `src/movement/`, `src/content/`, `src/animation/`, `src/tools/`
- Add facades/adapters and `src/config/refactorFlags.ts`
- Update imports in `src/scenes/Game.ts` only where needed for wiring.

**Tasks**
1. RL: Create `TickContext`, `GameEvents`, and `EventBus` interfaces under `src/core/`.
2. RL: Create `CombatFacade` with old-pipeline passthrough implementation.
3. RL: Create `AnimationFacade` with old animation calls passthrough.
4. CE: Create empty registries (`EnemyRegistry`, `BossRegistry`, `ProjectileRegistry`, `EffectRegistry`, `LevelRegistry`).
5. SET: Add tests proving facades route to legacy systems unchanged.

**Compatibility/Adapters**
- `LegacyCombatFacade`, `LegacyAnimationFacade`, `LegacyContentLookup`.

**Acceptance Criteria**
- Game still runs using old logic by default.
- New facades compile and are exercised in tests.

**Test Plan**
- Automated: facade unit tests + full existing test suite.
- Manual: verify no visible behavior change in Game scene.

**Risk / Rollback**
- Risk: Low.
- Rollback: disable `refactorFlags` and revert facade wiring only.

---

## Phase 2 - Unified Combat Module (Hitbox/Hurtbox/Damage)
**Objective**
- Replace ad-hoc hit/damage handling with a single combat module while preserving behavior.

**Scope**
- Add: `src/combat/DamageEvent.ts`, `Hitbox.ts`, `Hurtbox.ts`, `HitResolver.ts`, `IFrameController.ts`, `Knockback.ts`, `Combatant.ts`
- Update: `src/scenes/Game.ts`, `src/enemy/EnemyCombat.ts`, `src/player/PlayerCombat.ts`, `src/boss/framework/BossDamageController.ts`

**Tasks**
1. GE: Implement unified `DamageEvent` and `HitResolver` pipeline.
2. GE: Add `Combatant` wrappers for player/enemy/boss.
3. RL: Integrate resolver in Game overlaps (`player bullets`, `boss bullets`, `melee hitboxes`).
4. GE: Bridge enemy and boss damage controllers through new combat module.
5. SET: Add tests for i-frames, repeated hit suppression, damage source typing.

**Compatibility/Adapters**
- `LegacyDamageAdapter` maps old sprite `.data` HP fields to `Combatant`.
- Per-entity opt-in via `VITE_REFACTOR_COMBAT_V2`.

**Acceptance Criteria**
- Unified hit/damage code path active when flag is on.
- Legacy path still available when flag is off.
- No major feel regressions in hit timing.

**Test Plan**
- Automated: combat resolver tests, regression tests for player/boss/enemy damage.
- Manual: verify bullets, sword hits, contact damage, and i-frame behavior.

**Risk / Rollback**
- Risk: Medium.
- Rollback: turn off `VITE_REFACTOR_COMBAT_V2`; keep adapters intact.

---

## Phase 3 - Pilot Enemy Conversion (1 Enemy End-to-End)
**Objective**
- Convert one enemy fully to new modular attack/movement/combat/content pipeline while old enemies continue to run.

**Scope**
- Add: `src/content/enemies/enemy_gunner_bot.json` (pilot)
- Add movement/attack modules: `src/movement/GroundPatrolMovement.ts`, `src/attacks/ProjectileBurstAttack.ts`
- Update: `src/enemy/EnemySpawner.ts`, `src/enemy/EnemyEntity.ts` (adapter hooks)

**Tasks**
1. CE: Move `enemy_gunner_bot` data from TS catalog to JSON config.
2. GE: Implement modular movement + attack modules (windup/active/recovery).
3. RL: Spawn pilot enemy through new registry path when `VITE_REFACTOR_ENEMY_V2` is on.
4. SET: Add deterministic test for state sequence: `idle -> alert -> windup -> active -> recover`.
5. UIE: Overlay enemy state/HP/cooldowns from new runtime fields.

**Compatibility/Adapters**
- `LegacyEnemyDefinitionAdapter` converts old catalog entries to new runtime config shape.
- Only pilot enemy uses native v2 config; others still adapter-backed.

**Acceptance Criteria**
- Pilot enemy fully data-driven and behaviorally equivalent.
- Non-pilot enemies unchanged and still spawn.

**Test Plan**
- Automated: pilot enemy state machine and projectile cadence tests.
- Manual: load stage with mixed old/new enemies; verify both fight correctly.

**Risk / Rollback**
- Risk: Medium.
- Rollback: disable `VITE_REFACTOR_ENEMY_V2` or remap pilot to legacy adapter.

---

## Phase 4 - Convert All 12 Enemies to Data-Driven Config
**Objective**
- Convert enemy catalog to pure content data + shared runtime modules.

**Scope**
- Replace `src/enemy/EnemyCatalog.ts` usage with `src/content/enemies/*.json` (12 files)
- Add: `src/content/enemies/index.ts`, validators under `src/content/validators/`
- Update: enemy spawner/AI/movement/attacks to consume configs

**Tasks**
1. CE: Create 12 enemy config files and registry loader.
2. GE: Map all movement types to reusable movement modules (patrol, hopper, hover strafe, turret, ricochet/crawler behaviors).
3. GE: Map attack types to modules (`melee`, `projectile`, `burst`, `lobbed`, `charge`, `beam`).
4. RL: Remove direct dependency on hardcoded `EnemyCatalog` in runtime path.
5. SET: Add content-validation tests and spawn-all-enemies smoke scenario.

**Compatibility/Adapters**
- Keep `EnemyCatalog.ts` as fallback source for one phase (read-only adapter mode).

**Acceptance Criteria**
- All 12 enemies load from configs and validate at startup.
- Enemy behavior parity maintained at baseline tolerance.

**Test Plan**
- Automated: schema validation + spawn/update/damage tests for all enemy IDs.
- Manual: enemy gauntlet playthrough with overlay verification.

**Risk / Rollback**
- Risk: Medium-High.
- Rollback: per-enemy fallback map to legacy adapter; keep old catalog until Phase 8.

---

## Phase 5 - Boss Vertical Slice (1 Boss End-to-End + Boss HP UI)
**Objective**
- Convert one boss to pure content config and modular attacks/phases using the unified combat path.

**Scope**
- Add: `src/content/bosses/sentinel_rook.json` (or chosen pilot)
- Update: `src/boss/framework/*`, `src/bosses/BossController.ts`, `src/ui/HUD.ts`, `src/boss/framework/BossUIBinder.ts`

**Tasks**
1. CE: Author pilot boss config with phases, weighted attacks, intro/death hooks.
2. GE: Ensure attack module lifecycle (windup/active/recovery) drives hitboxes/projectiles/effects via content.
3. RL: Route boss spawn in Game through new boss registry with adapter fallback.
4. UIE: Bind boss HP UI to new combat state source only.
5. SET: Add phase-threshold and attack-weight deterministic tests.

**Compatibility/Adapters**
- `LegacyBossBlueprintAdapter` maps existing roster blueprint to new `BossConfig` until full migration.

**Acceptance Criteria**
- Pilot boss fully content-driven.
- Boss HP UI, phase transitions, intro/death hooks function with new pipeline.
- Legacy bosses still runnable.

**Test Plan**
- Automated: boss phase/attack selector tests, HP UI binder tests.
- Manual: defeat pilot boss and confirm reward/flow and UI behavior.

**Risk / Rollback**
- Risk: High.
- Rollback: boss selection fallback to legacy `BossController` mapping.

---

## Phase 6 - Manifest-Driven Animation System
**Objective**
- Remove ad-hoc animation creation and standardize animation manifests for player/enemy/boss/projectiles/effects.

**Scope**
- Add: `src/animation/AnimationManifestLoader.ts`, `AtlasSlicer.ts`, `AnimationPlayer.ts`
- Add content: `src/content/animations/*.json`
- Update: `src/scenes/Preload.ts`, `src/player/PlayerAnimator.ts`, `src/enemy/EnemyAnimator.ts`, boss animation calls.

**Tasks**
1. CE: Define animation manifests (slicing, rows, fps, origins, events).
2. GE: Replace runtime ad-hoc animation setup in `Preload.ts` and `Game.ts` with manifest loader.
3. RL: Introduce fallback chain (manifest -> atlas frame aliases -> placeholder frame).
4. SET: Add animation manifest validator and missing-key fail-fast tests.

**Compatibility/Adapters**
- `LegacyAnimationKeyAdapter` maps old key names to manifest keys during transition.

**Acceptance Criteria**
- Player/enemy/pilot boss animations loaded from manifests.
- Missing manifests fail validation with actionable errors.

**Test Plan**
- Automated: manifest validation tests, animation key coverage tests.
- Manual: verify idle/run/attack/hurt/death sets for pilot entities.

**Risk / Rollback**
- Risk: Medium.
- Rollback: disable `VITE_REFACTOR_ANIM_V2`, revert to existing `Preload` animation setup.

---

## Phase 7 - Level Scripting + Stage Content Registry
**Objective**
- Replace hardcoded stage geometry/spawns with level configs + script triggers.

**Scope**
- Add: `src/content/levels/*.json`, `src/content/scripts/*.json`
- Add runtime: `src/content/LevelLoader.ts`, `src/content/LevelScriptRunner.ts`
- Update: `src/scenes/Game.ts`, `src/enemy/EnemyLevelData.ts` (deprecate)

**Tasks**
1. CE: Define `LevelConfig` with collision platforms, spawn markers, hazards, boss start points.
2. GE: Implement level loader that builds Arcade static groups from content.
3. GE: Implement script runner triggers (time, player position, boss HP threshold, event-based).
4. RL: Move `stageConfigs` and enemy markers out of `Game.ts` into content files.
5. SET: Add validation and script replay tests.

**Compatibility/Adapters**
- `LegacyStageAdapter` reads current `stageConfigs` and `EnemyLevelData` into new shape.

**Acceptance Criteria**
- Game stage loads from config (no hardcoded stage geometry in `Game.ts`).
- Scripted enemy waves/events run from data.

**Test Plan**
- Automated: level config/schema tests, script trigger tests.
- Manual: stage start, enemy wave trigger, hazard collisions, boss intro trigger.

**Risk / Rollback**
- Risk: Medium.
- Rollback: toggle `VITE_REFACTOR_LEVELSCRIPT_V2` off to use legacy stage builder.

---

## Phase 8 - Final Cleanup, Dead Code Removal, CI Gates
**Objective**
- Remove obsolete code paths and lock in quality gates.

**Scope**
- Remove legacy branches in `src/scenes/Game.ts` and adapters no longer needed.
- Add CI jobs for schema validation + smoke + tests + build.
- Update docs.

**Tasks**
1. RL: Delete dead code (`@ts-nocheck` hotspots, duplicate boss/legacy attack paths) after full parity checks.
2. SET: Enforce CI pipeline (`npm run verify`) + refactor gates.
3. CE: Document content authoring workflow and schema references.
4. UIE: Finalize debug tools (`hitbox visualizer`, `state inspector`, `dev spawner`).

**Compatibility/Adapters**
- Remove remaining adapters after one release cycle of stable v2 default.

**Acceptance Criteria**
- No legacy-only runtime path required for shipped gameplay.
- Lint/typecheck/test/smoke/build all pass in CI.
- Documentation complete and current.

**Test Plan**
- Automated: full CI suite on clean checkout.
- Manual: full boss-run regression checklist.

**Risk / Rollback**
- Risk: Medium.
- Rollback: keep previous release tag + quick revert PR for cleanup-only changes.

---

## 4) Risk Register
| ID | Risk | Likelihood | Impact | Mitigation | Trigger | Rollback |
|---|---|---:|---:|---|---|---|
| R1 | Combat feel regression after unified resolver | M | H | Golden baseline snapshots + hit event assertions | HP/i-frame mismatch in smoke | Toggle `VITE_REFACTOR_COMBAT_V2` off |
| R2 | Mixed legacy/new entities desync | M | H | Strict adapter contracts + per-entity flagging | Entities not taking damage correctly | Revert affected entity to legacy adapter |
| R3 | Boss phase/attack timing drift | M | H | Deterministic boss tests + phase trace logs | Missing attacks / phase locks | Fallback to legacy boss mapping for affected boss |
| R4 | Animation key drift / missing frames | H | M | Manifest validator + startup hard-fail in dev | Missing animation warnings increase | Disable `VITE_REFACTOR_ANIM_V2` |
| R5 | Level script misfires | M | M | Script unit tests + debug trigger timeline | Triggers firing out of order | Disable `VITE_REFACTOR_LEVELSCRIPT_V2` |
| R6 | Performance regressions from extra debug hooks | L | M | Guard debug systems behind flags | Frame time >10% regression | Disable debug overlays in production |

## 5) Global Rollback Plan
1. Keep each phase behind an independent feature flag.
2. Merge only when phase gate passes.
3. Tag every phase completion (`refactor-phase-N-pass`).
4. If a gate fails post-merge:
   - disable affected flag,
   - revert only phase-specific wiring commit,
   - keep data/assets/tests that are forward-compatible.

## 6) Definition of Done (Refactor)
- [ ] `src/scenes/Game.ts` no longer contains monolithic combat/entity orchestration logic.
- [ ] All 12 enemies are loaded from validated content configs.
- [ ] At least one boss is fully content-driven (phases + attacks + UI).
- [ ] Unified combat module handles player/enemy/boss hit resolution.
- [ ] Animation loading is manifest-driven across player/enemy/boss.
- [ ] Level geometry/spawn/script data is loaded from content configs.
- [ ] Debug tools exist for hitboxes, states, HP/cooldowns, and event traces.
- [ ] Build + tests + smoke + schema validation pass in CI.
- [ ] Legacy adapters removed or explicitly retained with rationale.
- [ ] Architecture and content authoring docs are updated and complete.
