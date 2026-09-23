# Target Architecture (Phaser 3, Incremental Refactor)
- Status: canonical
- Owner scope: gameplay
- Last reviewed: 2026-03-06

## 1) Current Dependency Diagram (Audit Snapshot)

```text
main.ts
  -> Boot
  -> Preload
      -> assets/manifest + validateManifest
      -> player/AnimationManifest
  -> StageSelect
      -> StageSelectLogic
      -> Save
      -> bosses/roster
  -> Game (god scene)
      -> input/InputActions
      -> ui/HUD + ui/DebugOverlay + ui/VictoryModal
      -> player/NewPlayerRuntime (optional via feature flag)
      -> enemy/EnemySpawner (optional via feature flag)
          -> EnemyEntity -> EnemyAI + EnemyMotor + EnemyCombat + EnemyAnimator
      -> bosses/BossController
          -> boss/framework/BossBase + controllers + bossDefinitionMapper
      -> systems/Save
      -> core/navigation

Game.ts owns:
  - stage geometry creation
  - physics colliders/overlaps
  - bullet pools and projectile style
  - damage/hit/i-frame decisions
  - boss attack spawn mapping
  - pause/victory/game-over transitions
  - debug overlay state wiring
```

## 2) Proposed Module Layout

```text
src/
  core/
    GameLoop.ts
    TickContext.ts
    EventBus.ts
    featureFlags.ts
  physics/
    CollisionQueries.ts
    Raycast.ts
    TileCollision.ts
    ArcadeBodyAdapter.ts
  entities/
    Entity.ts
    EntityId.ts
    EntityFactory.ts
    components/
      HealthComponent.ts
      MovementComponent.ts
      AttackComponent.ts
      AnimationComponent.ts
  combat/
    DamageEvent.ts
    Hitbox.ts
    Hurtbox.ts
    HitResolver.ts
    IFrameController.ts
    Knockback.ts
    CombatantRegistry.ts
  ai/
    StateMachine.ts
    BehaviorSelector.ts
    behaviors/
      PatrolBehavior.ts
      ChaseBehavior.ts
      RetreatBehavior.ts
      BossPhaseBehavior.ts
  attacks/
    AttackBase.ts
    AttackRunner.ts
    phases/
      WindupPhase.ts
      ActivePhase.ts
      RecoveryPhase.ts
    modules/
      MeleeAttack.ts
      ProjectileAttack.ts
      BurstAttack.ts
      DashAttack.ts
      HazardAttack.ts
  movement/
    GroundPatrolMovement.ts
    ChaseMovement.ts
    HopperMovement.ts
    HoverStrafeMovement.ts
    RicochetMovement.ts
  content/
    registries/
      EnemyRegistry.ts
      BossRegistry.ts
      ProjectileRegistry.ts
      EffectRegistry.ts
      LevelRegistry.ts
    enemies/*.json
    bosses/*.json
    projectiles/*.json
    effects/*.json
    levels/*.json
    animations/*.json
    scripts/*.json
    validators/
      enemyValidator.ts
      bossValidator.ts
      attackValidator.ts
      levelValidator.ts
      animationValidator.ts
  animation/
    AnimationManifestLoader.ts
    FrameSlicer.ts
    AnimationPlayer.ts
    AnimationEventRouter.ts
  ui/
    hud/
      PlayerHudPresenter.ts
      BossBarPresenter.ts
    debug/
      DebugOverlayPresenter.ts
      HitboxVisualizer.ts
      StateInspector.ts
  tools/
    DevSpawner.ts
    CombatTraceRecorder.ts
    PerfOverlay.ts
```

## 3) Responsibilities and Boundaries

### `core/`
- Owns update order, time source, and event bus contracts.
- No gameplay-specific rules.

### `physics/`
- Pure collision helpers and Arcade abstraction.
- Isolates Phaser-specific body quirks from combat/movement modules.

### `entities/`
- Entity lifecycle + component wiring.
- No hardcoded enemy/boss logic.

### `combat/`
- Single source of truth for `DamageEvent`, hitbox/hurtbox overlap, i-frames, knockback.
- Used by player/enemy/boss uniformly.

### `ai/`
- State transitions and selectors only.
- Delegates movement and attacks to `movement/` and `attacks/` modules.

### `attacks/`
- Attack lifecycle (`windup -> active -> recovery`) and shared timing logic.
- Attack definitions consumed from `content/`.

### `movement/`
- Reusable movement behaviors (patrol/chase/hopper/hover/ricochet/etc).
- Stateless or minimally stateful modules for deterministic testing.

### `content/`
- Runtime data loading + validation + registries.
- Owns enemy/boss/projectile/effect/level/animation/script data contracts.

### `animation/`
- Manifest-driven frame slicing and playback.
- Emits animation frame events to combat/VFX/SFX layers.

### `ui/`
- Pure presentation; reads snapshot providers.
- No gameplay mutation.

### `tools/`
- Debug/dev-only affordances (spawner, hitbox visualizer, state inspector).

## 4) Data Flow Between Modules

### Runtime Tick Flow
```text
core/GameLoop.tick
  -> input sampled
  -> ai state update
  -> movement module update
  -> attack runner update (windup/active/recovery)
  -> combat resolver processes hitbox/hurtbox contacts
  -> animation player advances + emits frame events
  -> ui presenters render snapshots
  -> tools overlays render diagnostics (dev only)
```

### Event Flow
```text
attacks/modules emit AttackStarted/AttackPhaseChanged/AttackEnded
combat emits DamageApplied/Blocked/Defeated
animation emits AnimationEvent(frame markers)
level scripts emit SpawnEntity/PlayFx/StartBoss/SetCheckpoint
ui listens to snapshots + selected events (no write-back)
```

### Reference Flow (No Circular Coupling)
- `ai` depends on `movement` and `attacks` interfaces.
- `attacks` depends on `combat` interfaces and content definitions.
- `ui` depends on read-only providers from `entities/combat`.
- `content` has no dependency on gameplay runtime logic.

## 5) Compatibility Layer During Migration

```text
GameScene (existing)
  -> MigrationBridge (temporary compile-time modules only)
       -> New runtime modules
       -> Transitional adapters for data shape compatibility
```

Required adapters:
- `DamageBridgeAdapter`: sprite `.data` HP <-> `Combatant`.
- `AnimationKeyBridgeAdapter`: old animation key names <-> manifest keys.
- `EnemySpawnBridgeAdapter`: `EnemyCatalog` TS defs <-> `EnemyConfig` schema.
- `LegacyBossBlueprintAdapter`: `BossBlueprint` <-> `BossConfig` schema.
- `LegacyStageAdapter`: hardcoded `stageConfigs` <-> `LevelConfig`.

## 6) Target Dependency Diagram

```text
main.ts
  -> core/GameLoop
  -> scenes/StageSelectScene
  -> scenes/GameScene
      -> entities/EntityFactory
          -> content/registries (enemy/boss/projectile/effect/level/animation)
          -> ai + movement + attacks + combat + animation
      -> ui/hud presenters
      -> ui/debug presenters
      -> tools/dev helpers (dev only)

combat is shared by:
  player runtime
  enemy runtime
  boss runtime

content drives:
  enemy behavior
  boss phases/attacks
  projectile/effect behavior
  level scripting and spawn setup
  animation playback/slicing
```

## 7) Phaser-Specific Design Notes
- Keep Phaser objects (`Sprite`, `Group`, `Body`) at adapter edges.
- Core gameplay modules operate on plain TS interfaces and snapshots.
- Use deterministic timers from `TickContext` instead of scattered `scene.time.delayedCall` for combat-critical sequencing.
- Keep visual-only particle/tween logic in VFX layer, not combat resolver.
