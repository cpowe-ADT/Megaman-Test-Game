# Derived Sprite Sources (Temporary)
- Status: canonical
- Owner scope: content
- Last reviewed: 2026-03-06

This repo currently uses two deterministic stopgaps so gameplay can run with stable atlas keys while bespoke sheets are still in progress.

Derivation scripts:
- `scripts/sprites/derive_color_variants.py`
- `scripts/sprites/rebuild_roster_runtime_atlases.py`
- Specs:
  - `scripts/sprites/derive_specs/enemies_missing.json`
  - `scripts/sprites/derive_specs/bosses_missing_actions.json`
  - `scripts/sprites/derive_specs/shield_drone_v2.json`

Rules:
- Only sufficiently saturated pixels are hue-shifted (neutral backgrounds and low-saturation text stay unchanged).
- Outputs are deterministic and checked into the repo.
- Runtime boss/enemy atlases are currently synthesized from `assets/sprites/source/bosses/boss_roster_sheet_v1_20260207_200224.png`
  with deterministic component extraction + rigged frame groups (`idle/move/shoot` and `idle/run/attack/death`).
- Replace these derived sheets with real sheets later (keep filenames stable or update slice/manifest accordingly).
