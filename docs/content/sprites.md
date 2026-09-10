# Sprite Asset Layout
- Status: canonical
- Owner scope: content
- Last reviewed: 2026-03-06

This project is local-first at runtime and supports repeatable source-image intake.

## Folder Structure

Source sheets (raw AI or concept images):

- `assets/sprites/source/player/`
- `assets/sprites/source/bosses/`
- `assets/sprites/source/enemies/`
- `assets/sprites/source/projectiles/`
- `assets/sprites/source/ui/`
- Free-source attribution manifest: `assets/sprites/source/free-source-attribution.v1.json`

Runtime atlases/sheets:

- `assets/sprites/player/main/`
- `assets/sprites/bosses/<bossId>/`
- `assets/sprites/enemies/<typeKey>/`
- `assets/projectiles/`
- `assets/vfx/`
- `assets/ui/`

## Naming Convention

Raw source files:

- `<category>_<subject>_sheet_<variant>_<yyyymmdd>_<hhmmss>.png`
- Example: `enemy_gunner_bot_sheet_v1_20260207_202115.png`

Atlas output files:

- `<typeKey>.png`
- `<typeKey>.atlas.json`

Atlas frame names:

- `<typeKey>/<animKey>/<frameIndex>`
- Example: `enemy_gunner_bot/idle/000`

## Intake Command (Auto Rename + Copy)

Run:

```bash
npm run sprites:intake
```

Behavior:

1. Reads known `ChatGPT Image ...` files from `~/Downloads`.
2. Copies them into category folders under `assets/sprites/source/`.
3. Renames them to the naming convention above.
4. Writes intake metadata to `assets/sprites/source/source-images.manifest.json`.

If you need to replace existing copied files:

```bash
npm run sprites:intake -- --overwrite
```

## Slice To Atlas

```bash
npm run sprites:slice -- \
  --in assets/sprites/source/enemies/enemy_gunner_bot_sheet_v1_20260207_202115.png \
  --out assets/sprites/enemies/enemy_gunner_bot \
  --typeKey enemy_gunner_bot \
  --grid 8x6 \
  --anims "idle=0-5,run=6-13,attack=14-19"
```

## Enemy Type Keys

Required keys:

1. `enemy_gunner_bot`
2. `enemy_rocket_bot`
3. `enemy_slicer_bot`
4. `enemy_armored_bot`
5. `enemy_shock_hopper`
6. `enemy_bouncer`
7. `enemy_mine_bot`
8. `enemy_frost_turret`
9. `enemy_laser_eye`
10. `enemy_drone`
11. `enemy_shield_drone`
12. `enemy_fly_trap`

## Manifest Notes

- Runtime sprite manifest: `assets/sprites/manifest.v1.json`
- Source intake log: `assets/sprites/source/source-images.manifest.json`
- Optional local override manifest: `assets/private/runtime/private-sprite-overrides.manifest.json`

## Private Local Override Pack

- Local-only copyrighted sheets belong under `assets/private/source/` and generated override atlases belong under `assets/private/runtime/`.
- The game now resolves `assets/sprites/manifest.v1.json` first, then merges `assets/private/runtime/private-sprite-overrides.manifest.json` if it exists at dev/build start.
- Override entries must keep the stable runtime atlas keys used by gameplay:
  - `atlas_player_main`
  - `atlas_<bossId>`
- Build the local Mega Man override pack with:

```bash
.venv/bin/python scripts/sprites/build_private_megaman_override_pack.py
```

- This private workflow is intentionally gitignored. The repo-safe defaults remain the canonical shared asset path.

## Player Combat Atlas

- The current player runtime atlas is rebuilt from `assets/sprites/source/player/player_full_combat_sheet_v1_20260207_201355.png`.
- Required player atlas groups now include:
  - locomotion: `idle`, `turn`, `run`, `crouch_in`, `crouch_hold`, `crouch_out`, `jump_start`, `jump_rise`, `jump_apex`, `fall`, `land`
  - dash/combat: `dash_start`, `dash_loop`, `dash_end`, `airdash_start`, `airdash_loop`, `airdash_end`, `shoot_ground`, `shoot_run`, `shoot_air`, `dash_shoot`
  - charge: `charge_start`, `charge_hold`, `charge_release_lv1`, `charge_release_lv2`, `charge_release_lv3`, `charge_release_lv4`
  - sword: `slash_ground_e`, `slash_ground_ne`, `slash_ground_n`, `slash_ground_se`, `slash_ground_s`, `slash_air_e`, `slash_air_ne`, `slash_air_n`, `slash_air_se`, `slash_air_s`
  - damage/death: `hurt_light`, `hurt_heavy`, `knockdown`, `getup`, `death`, `respawn`
- West-facing sword poses are intentionally mirrored at runtime from the east-side atlas groups; do not duplicate `w/nw/sw` frame groups unless the runtime binding changes too.
- After changing player atlas content, rebuild the runtime sheet with:

```bash
.venv/bin/python scripts/sprites/rebuild_core_runtime_atlases.py
```

## Free Source Intake

- The runtime now prefers a free-source boss/enemy roster sheet when present:
  - `assets/sprites/source/bosses/boss_roster_sheet_free_v1_20260310_180000.png`
  - Built from free OpenGameArt mech sprites and palette-shifted into the existing roster-slot layout.
- Enemy roster upgrades can also be rebuilt from downloaded free-source inputs:
  - `assets/sprites/source/enemies/enemy_robot_platformer_sheet_free_v1_20260312_120000.png`
  - `assets/sprites/source/enemies/enemy_robot_pack_side_sheet_free_v1_20260312_120000.png`
  - `assets/sprites/source/enemies/enemy_jumping_blob_strip_free_v1_20260312_184600.png`
  - `assets/sprites/source/enemies/enemy_slime_first_gen_weak_free_v1_20260312_190900.png`
  - `assets/sprites/source/enemies/enemy_scorpy_scorp_walk_sheet_free_v1_20260312_184600.png`
  - `assets/sprites/source/enemies/enemy_scorpy_scorp_stab_sheet_free_v1_20260312_184600.png`
  - `assets/sprites/source/enemies/enemy_plant_monster_frame1_free_v1_20260312_184600.png`
  - `assets/sprites/source/enemies/enemy_plant_monster_frame2_free_v1_20260312_184600.png`
  - `assets/sprites/source/enemies/enemy_eye_monster_sheet_free_v1_20260312_190900.png`
  - `assets/sprites/source/enemies/enemy_cannon_gun_sheet_free_v1_20260312_191500.png`
  - `assets/sprites/source/enemies/enemy_kenney_tank_grey1_free_v1_20260312_194000.png`
  - `assets/sprites/source/enemies/enemy_kenney_tank_grey2_free_v1_20260312_194000.png`
  - `assets/sprites/source/enemies/enemy_kenney_tank_grey3_free_v1_20260312_194000.png`
  - `assets/sprites/source/enemies/enemy_kenney_tank_grey4_free_v1_20260312_194000.png`
  - `assets/sprites/source/enemies/enemy_kenney_tank_grey5_free_v1_20260312_194000.png`
  - Derived v2 sheets now target the full enemy roster:
    - `enemy_gunner_bot`
    - `enemy_rocket_bot`
    - `enemy_slicer_bot`
    - `enemy_armored_bot`
    - `enemy_shock_hopper`
    - `enemy_bouncer`
    - `enemy_mine_bot`
    - `enemy_frost_turret`
    - `enemy_laser_eye`
    - `enemy_drone`
    - `enemy_shield_drone`
    - `enemy_fly_trap`
  - The specialist packs are currently wired into the roster like this:
    - `enemy_bouncer` -> `Slime Monster Sprites`
    - `enemy_mine_bot` -> `Scorpy Scorp`
    - `enemy_fly_trap` -> `Plant Monster`
    - `enemy_laser_eye` -> `Floating Eye Monster 16x16`
    - `enemy_frost_turret` -> `Cannon Gun`
    - `enemy_armored_bot` -> `Kenney Tanks`
- The projectile/effect atlases now prefer curated free-source inputs when present:
  - `assets/sprites/source/projectiles/projectile_robotfree_objects_sheet_v1_20260310_180000.png`
  - `assets/sprites/source/projectiles/effects_explosion03_sheet_v1_20260310_180000.png`
  - `assets/sprites/source/projectiles/effects_ring95_sheet_v1_20260310_180000.png`
  - `assets/sprites/source/projectiles/effects_aura38_sheet_v1_20260310_180000.png`
- Attribution and source URLs for those files live in `assets/sprites/source/free-source-attribution.v1.json`.
- Rebuild order after changing any of those free-source files:

```bash
.venv/bin/python scripts/sprites/rebuild_core_runtime_atlases.py
.venv/bin/python scripts/sprites/rebuild_roster_runtime_atlases.py
```

- To rebuild the free-source v2 enemy roster pack:

```bash
.venv/bin/python scripts/sprites/build_enemy_showcase_pack.py
```

## Workflow

1. Intake or manually add source sheets to `assets/sprites/source/*`.
2. Slice/import into runtime atlas folders.
3. Validate sprite manifest with:

```bash
npm run sprites:validate
```
