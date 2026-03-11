# Sprite Image Generation Runbook
- Status: canonical
- Owner scope: tools, content
- Last reviewed: 2026-03-06

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

## 2) Generate Images (Optional)
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
