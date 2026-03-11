# Boss Framework (Data-Driven)
- Status: canonical
- Owner scope: gameplay
- Last reviewed: 2026-03-06

## Files
- `src/boss/framework/types.ts`: Core contracts (`IBoss`, `IAttack`, `BossContext`, `DamageEvent`, `HitResult`, config types).
- `src/boss/framework/BossStateMachine.ts`: State graph and guarded transitions.
- `src/boss/framework/AttackModules.ts`: Timed attack lifecycle (windup -> active -> recovery).
- `src/boss/framework/BossAttackController.ts`: Attack selection, cooldowns, anti-repeat, range checks, panic choice.
- `src/boss/framework/BossDamageController.ts`: Hurtbox/hitbox damage pipeline, resistances, i-frames.
- `src/boss/framework/BossPhaseController.ts`: HP threshold phase logic and per-phase multipliers/weight overrides.
- `src/boss/framework/BossUIBinder.ts`: Boss HP -> HUD binding with smooth fill.
- `src/boss/framework/ArenaController.ts`: Intro lock and death unlock hooks (doors/music/reward).
- `src/boss/framework/BossBase.ts`: Reusable orchestration layer implementing `IBoss`.
- `src/boss/framework/bossDefinitionMapper.ts`: Maps roster blueprints into framework runtime definitions/attack patterns.
- `src/boss/config/volt_golem.json`: Sample boss data.
- `src/boss/config/index.ts`: Config registry lookup.
- `src/bosses/BossController.ts`: Phaser runtime adapter that bridges `BossBase` with scene events/sprite/physics.
- `src/scenes/Game.ts`: Integration points (boss config override, UI binder, damage pipeline and debug hooks).

## How To Add A New Boss
1. Add a new JSON in `src/boss/config/<boss_id>.json` using the same schema as `volt_golem.json`.
2. Register it in `src/boss/config/index.ts`.
3. Launch with query override: `/?bossConfig=<boss_id>&bossId=sentinel_rook`.
4. For Stage Select integration, map this config to a roster entry and pass it through scene data.

## How To Add A New Attack Type
1. Extend `BossAttackDefinition['type']` in `src/boss/framework/types.ts`.
2. Add lifecycle behavior in `src/boss/framework/AttackModules.ts` (if timing behavior differs).
3. Add spawn/execution behavior in `src/scenes/Game.ts` inside `spawnBossProjectile(...)`.
4. Add/adjust tests under `src/boss/__tests__/`.

## Debug / Verification Hooks
- Runtime debug object: `window.bossDebug`
  - `bossDebug.damage(5)`
  - `bossDebug.unlockIntro()`
  - `bossDebug.hp()`
- Render text output includes boss HP/phase in `window.render_game_to_text()`.
