# Sprite Image Generation Runbook
- Status: canonical
- Owner scope: tools, content
- Last reviewed: 2026-09-10

This project uses a hybrid sprite strategy:
- Runtime: local assets only.
- Authoring: optional API/image generation and import tooling.

## 1) Generate Prompt Pack from Boss Metadata
```bash
npm run sprites:prompts
```

Outputs:
- `output/imagegen/prompts/index.json`
- `output/imagegen/prompts/<boss-id>.md`

## 2) Generate Images with Higgsfield (primary path, 2026-09-10)
Original character art is generated as a whole sprite sheet and cut by script, so a sheet can be regenerated and re-cut in one pass.

1. **Generate** with Higgsfield `gpt_image_2` (4:3, 1k, quality medium) through the Higgsfield MCP or `higgsfield generate create gpt_image_2 --prompt "..." --aspect_ratio 4:3 --resolution 1k --quality medium --wait`. The prompt asks for an exact grid of equal square cells on flat `#FF00FF`, one character facing right, same size in every cell, one animation per row. The warden prompts and job ids are in `assets/sprites/source/bosses/boss_sheets_hf_v1_20260910.prompts.md`.
2. **Save** the sheet as `assets/sprites/source/<family>/<name>_sheet_hf_v<n>_<date>.png` and add an `original-generated` entry to `assets/sprites/source/free-source-attribution.v1.json`, then `npm run credits:build`.
3. **Cut** with `scripts/sprites/hf_sheet_to_atlas.py`: it splits the grid, keys the magenta (with a fringe pass), box-downsamples each cell to the runtime cell size, hardens alpha, quantizes to 32 colors so the result stays pixel-crisp, sits every frame on a shared baseline, writes `<typeKey>.png` + `<typeKey>.json` with frames named `<typeKey>/<anim>/<index>`, and upserts the manifest entry.

```bash
.venv/bin/python scripts/sprites/hf_sheet_to_atlas.py \
  --in assets/sprites/source/bosses/boss_tide_reaver_sheet_hf_v1_20260910_b.png \
  --type-key tide_reaver --category bosses --grid 4x3 --cell 64 \
  --anims "idle=0-3,move=4-7,shoot=8-11" --baseline 60
```

4. **Check** with `npm run sprites:validate`, then `npm run test:visual-sweep` for boss-room screenshots under `output/mission-visual-sweep/`.

Conventions:
- Boss atlases: 4x3 grid, 64px cells, rows `idle`, `move`, `shoot` (four frames each). The roster's `spritePlan.frame` still sets the physics body; the visual cell can be larger.
- Baseline 60 puts feet or jets 4px above the cell bottom; the roster origin (about 0.86) lands the contact point on the floor.
- Regenerate a whole sheet rather than patching frames, so style stays consistent.
- Generated art is original IP. Every ripped skin is retired (bosses 2026-09-10, the hero in 05c on 2026-09-24); the hero cut is `--category player` with `--body-height`, `--flash-cells`, `--body-only-cells` and `--append` (`docs/art/hero-sheets.md`, `scripts/sprites/cut_hero_v1.sh` for the exact commands).

## 2b) Generate Images with the imagegen skill (legacy)
This uses the existing imagegen skill CLI:
- Script path: `/Users/thristannewman/.codex/skills/imagegen/scripts/image_gen.py`

Example:
```bash
python /Users/thristannewman/.codex/skills/imagegen/scripts/image_gen.py generate \
  --prompt-file output/imagegen/prompts/sentinel_rook.md \
  --out output/imagegen/renders/sentinel_rook.png
```

## 3) API Key Behavior
- If `OPENAI_API_KEY` is not set, prompt generation still works.
- Missing key does **not** block game runtime.
- Runtime continues using generated placeholder textures or manually imported atlases.

## 3b) Convert Concept Sheet -> Runtime Atlas
Use the built-in slicer to turn a sheet into a Phaser atlas and register it in manifest:

```bash
npm run sprites:slice -- \
  --in assets/sprites/source/enemies/enemy_gunner_bot_sheet_v1_20260207_202115.png \
  --out assets/sprites/enemies/enemy_gunner_bot \
  --typeKey enemy_gunner_bot \
  --grid 8x6 \
  --anims "idle=0-5,run=6-13,attack=14-19"
```

Outputs:
- `assets/sprites/enemies/enemy_gunner_bot/enemy_gunner_bot.png`
- `assets/sprites/enemies/enemy_gunner_bot/enemy_gunner_bot.atlas.json`
- manifest update in `assets/sprites/manifest.v1.json` (and compatibility copy `assets/sprites/manifest.json`)

## 4) Validate Manifest
```bash
npm run sprites:validate
```

## 5) Import from Remote Sources (Optional)
Dry-run first:
```bash
npm run sprites:import -- --dry-run
```

Actual download:
```bash
npm run sprites:import -- --overwrite
```

## 6) Runtime Loading Contract
`src/scenes/Preload.ts` validates the manifest and loads atlas entries only when:
- `status` is `ready`
- both `source.runtimeImage` and `source.runtimeData` are defined

If not, runtime keeps placeholder-generated textures.
