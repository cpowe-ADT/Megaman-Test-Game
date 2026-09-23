# Content Schemas (Phaser + TypeScript)
- Status: canonical
- Owner scope: content
- Last reviewed: 2026-08-04

## 1) Format Decisions
- Source format: **JSON** files in `src/content/**` (imported by Vite).
- Validation: runtime validators in `src/content/validators/*.ts` (same style as existing `validateManifest.ts`).
- Versioning: every config includes `schemaVersion`.
- IDs are stable string keys (snake_case).

## 2) EnemyConfig

### Shape
```json
{
  "schemaVersion": "1",
  "id": "enemy_gunner_bot",
  "displayName": "Gunner Bot",
  "hp": 4,
  "traits": ["grounded", "ranged"],
  "movement": {
    "profile": "ground_patrol",
    "params": {
      "speed": 62,
      "patrolMinX": 260,
      "patrolMaxX": 360,
      "ledgeAware": true
    }
  },
  "attacks": ["enemy_attack_gunner_single"],
  "combat": {
    "hurtbox": { "shape": "rect", "offsetX": 1, "offsetY": 0, "width": 14, "height": 18 },
    "contactDamage": 1,
    "iFrameMs": 70,
    "hitstunLightMs": 120,
    "hitstunHeavyMs": 220,
    "knockbackResist": 0.2
  },
  "animationKeys": {
    "idle": "enemy_gunner_bot_idle",
    "move": "enemy_gunner_bot_move",
    "attackWindup": "enemy_gunner_bot_attack_windup",
    "attackActive": "enemy_gunner_bot_attack_active",
    "hurt": "enemy_gunner_bot_hurt",
    "death": "enemy_gunner_bot_death"
  },
  "drops": { "healthChance": 0.1, "ammoChance": 0.12, "scoreChance": 0.4, "scoreValue": 100 }
}
```

### Validation Rules
- `id` unique across enemy registry.
- `hp >= 1`.
- `movement.profile` must map to an implemented movement module.
- Every attack ID must exist in `AttackConfig` registry.
- Hurtbox dimensions positive; i-frame/hitstun durations non-negative.
- `animationKeys` must resolve in animation manifest registry.

## 3) BossConfig

### Shape
```json
{
  "schemaVersion": "1",
  "id": "sentinel_rook",
  "displayName": "Sentinel ROOK",
  "baseStats": {
    "hp": 24,
    "contactDamage": 6,
    "moveSpeed": 60
  },
  "introHook": "boss_intro_sentinel",
  "deathHook": "boss_death_weapon_reward",
  "phases": [
    {
      "id": "phase_1",
      "threshold": 1.0,
      "attackWeights": {
        "boss_attack_guard_shot": 3,
        "boss_attack_giga_hop": 2
      }
    },
    {
      "id": "phase_2",
      "threshold": 0.55,
      "attackWeights": {
        "boss_attack_guard_shot": 4,
        "boss_attack_stomp_shock": 3
      },
      "speedMultiplier": 1.2,
      "transitionLockMs": 420
    }
  ],
  "attacks": [
    "boss_attack_guard_shot",
    "boss_attack_giga_hop",
    "boss_attack_stomp_shock"
  ],
  "ui": {
    "bossBarName": "Sentinel ROOK",
    "portraitKey": "boss_sentinel_rook_portrait"
  }
}
```

### Validation Rules
- Phase thresholds sorted descending and include `1.0` phase.
- Attack IDs referenced by phases must exist and be enabled.
- `baseStats.hp >= 1`.
- Hook IDs must resolve to registered script handlers.

## 4) AttackConfig

### Shape
```json
{
  "schemaVersion": "1",
  "id": "enemy_attack_gunner_single",
  "ownerType": "enemy",
  "attackType": "projectile",
  "timings": {
    "windupMs": 180,
    "activeMs": 120,
    "recoveryMs": 220,
    "cooldownMs": 900
  },
  "targeting": {
    "rangeMin": 20,
    "rangeMax": 170,
    "losRequired": true
  },
  "params": {
    "projectileId": "enemy_proj_basic",
    "count": 1,
    "spread": 0
  },
  "hit": {
    "damage": 1,
    "damageType": "normal",
    "hitstopFrames": 2,
    "knockback": { "x": 120, "y": -40 }
  },
  "telegraph": {
    "animation": "enemy_gunner_bot_attack_windup",
    "sfx": "enemy_windup",
    "vfx": "fx_warning_small"
  }
}
```

### Validation Rules
- Required timings all `>= 0`; `cooldownMs >= recoveryMs` preferred (warn if not).
- `attackType` in supported set (`melee`, `projectile`, `burst`, `hazard`, `dash`, `slam`, `beam`).
- `params` keys validated by attack type.
- `hit.damage >= 0`; knockback finite.

## 5) ProjectileConfig

### Shape
```json
{
  "schemaVersion": "1",
  "id": "enemy_proj_basic",
  "sprite": {
    "atlasKey": "atlas_projectiles",
    "animationKey": "proj_enemy_basic",
    "sheetRow": 1,
    "frameCount": 4,
    "fps": 16
  },
  "physics": {
    "speed": 200,
    "gravity": 0,
    "lifetimeMs": 2500,
    "collideWorldBounds": true
  },
  "combat": {
    "owner": "enemy",
    "damage": 1,
    "damageType": "normal",
    "pierce": 0
  },
  "onHitEffectId": "fx_hit_small"
}
```

### Validation Rules
- `speed >= 0`, `lifetimeMs > 0`.
- Sprite frame count positive.
- `owner` in `player|enemy|neutral`.
- Referenced effect ID must exist.

## 6) EffectConfig

### Shape
```json
{
  "schemaVersion": "1",
  "id": "fx_hit_small",
  "type": "sprite_anim",
  "sprite": {
    "atlasKey": "atlas_effects",
    "sheetRow": 2,
    "frameCount": 6,
    "fps": 20,
    "origin": { "x": 0.5, "y": 0.5 }
  },
  "lifetimeMs": 300,
  "blendMode": "add",
  "audioCue": "sfx_hit_small"
}
```

### Validation Rules
- `type` in supported effect runtime set.
- `lifetimeMs > 0`.
- `blendMode` whitelisted.
- Audio cue optional but must resolve if provided.

## 7) AnimationManifest

### Shape
```json
{
  "schemaVersion": "1",
  "id": "enemy_gunner_bot_manifest",
  "atlasKey": "atlas_enemy_gunner_bot",
  "slice": {
    "frameWidth": 32,
    "frameHeight": 32,
    "margin": 0,
    "spacing": 0
  },
  "origins": {
    "default": { "x": 0.5, "y": 0.75 }
  },
  "animations": {
    "enemy_gunner_bot_idle": {
      "row": 0,
      "start": 0,
      "count": 2,
      "fps": 6,
      "repeat": -1
    },
    "enemy_gunner_bot_attack_active": {
      "row": 2,
      "start": 0,
      "count": 3,
      "fps": 12,
      "repeat": 0,
      "events": [
        { "frame": 1, "event": "spawn_projectile", "payload": { "projectileId": "enemy_proj_basic" } }
      ]
    }
  }
}
```

### Validation Rules
- Atlas key must exist.
- Frame indices in bounds.
- `fps >= 1`.
- Event payload schema validated per event type.

## 8) LevelConfig and LevelScript (for level scripting support)

### LevelConfig
```json
{
  "schemaVersion": "1",
  "id": "stage_metal",
  "worldBounds": { "width": 448, "height": 252, "leftWall": true, "rightWall": true, "allowFallOff": false },
  "platforms": [
    { "x": 160, "y": 170, "width": 60, "height": 8 },
    { "x": 220, "y": 130, "width": 60, "height": 8 }
  ],
  "enemyMarkers": [
    { "id": "m1", "enemyId": "enemy_gunner_bot", "x": 300, "y": 185 }
  ],
  "bossSpawn": { "x": 400, "y": 180 },
  "scriptId": "script_stage_metal"
}
```

### LevelScript
```json
{
  "schemaVersion": "1",
  "id": "script_stage_metal",
  "events": [
    { "id": "wave_1", "trigger": { "type": "time", "ms": 2500 }, "action": { "type": "spawn_enemy", "enemyId": "enemy_drone", "x": 340, "y": 120 } },
    { "id": "boss_intro", "trigger": { "type": "all_enemies_defeated" }, "action": { "type": "start_boss_intro", "bossId": "sentinel_rook" } }
  ]
}
```

### Validation Rules
- `LevelConfig.id` unique.
- `scriptId` must resolve.
- Trigger/action types must be supported by runner.
- Event IDs unique per script.

## 9) Validator Contract
- Validator API pattern:
  - `validateEnemyConfig(value): { valid: true, data } | { valid: false, errors[] }`
  - same for boss/attack/projectile/effect/animation/level/script.
- Startup behavior:
  - Dev: fail fast with descriptive errors.
  - Production: configurable strict mode (recommended strict on CI, fail build).

## 10) Save and Progression Contract

### SaveData
```json
{
  "weaponsUnlocked": [],
  "gameOverCounts": {},
  "clearedBosses": [],
  "tutorialCleared": false,
  "finalBossCleared": false,
  "gameCompleted": false,
  "progressionWorld": {
    "version": 1,
    "seed": "local-default",
    "startingStageIds": ["tutorial_sentinel", "pyro_maw"],
    "stageChain": ["pyro_maw"],
    "placements": {
      "tutorial_sentinel:boss_clear": "access_pyro_maw"
    },
    "weaknessStrictness": "weakness_and_buster",
    "weaknessProfiles": {
      "pyro_maw": { "bossId": "pyro_maw", "weaknessWeaponIds": ["FrostShatter"] }
    },
    "finalGate": {
      "rules": [{ "category": "medals", "required": 8 }]
    }
  },
  "stageAccessUnlocked": ["tutorial_sentinel", "pyro_maw"],
  "collectedChecks": [],
  "unlockedCheckpoints": {},
  "selectedCheckpointByStage": {},
  "upgradeUnlocks": [],
  "heartTanks": 0,
  "subTanks": 0,
  "pendingProgressionItems": [],
  "activeRun": null
}
```

### Rules
- `ensureProgressionState(save)` is the normalization boundary for progression-backed saves.
- `createFreshProgressionState(seed)` creates fresh seeded progression and unlocks tutorial plus the seeded first robot-master stage.
- Checked boss-clear locations are canonical completion truth. Normalization derives tutorial clear, robot-master medals, final-boss clear, and game completion from those checks while preserving compatible legacy flags.
- Boss-clear rewards come from `progressionWorld.placements["<stageId>:boss_clear"]`.
- Stage Select weakness text comes from `progressionWorld.weaknessProfiles[bossId]`, not static boss metadata.
- `evaluateFinalGate(save)` is the only final-route access gate.
- Progression transport import regenerates the complete world from the imported seed, applies sanitized slot overrides, replaces stale target progression, preserves repeated allowed `receivedItems`, and treats those received items as imported inventory truth.
- Progression import clears `activeRun` because a run from the previous world cannot be resumed safely.
- `validateActiveRun(save, raw)` is the active-run boundary. Stage and boss identity must match live campaign content; HP, lives, weapons, energy, and checkpoint values are normalized against the current save and content catalogs before menus or `Game` can consume the run.
- `activeRun` is also cleared on boss victory and loaded through the system menu resume path.
- Story flags are not part of this contract yet; add them here when story state becomes save-backed.
