# OMEGA Relay style sheet (one page)

Status: canonical for all generated art from prompt 05 §5.4. Owner: Art Director seat. The hero (`hero-brief.md`) is the first sprite that must match it; boss sheets from 2026-09-10 are the precedent.

## Frame and scale

- Game frame `448 x 252` (`GAME_WIDTH`, `GAME_HEIGHT`); the HUD band takes the top 58px (`GAMEPLAY_VIEWPORT_TOP`), so the playfield is `448 x 194`.
- Hero cell 48px: body 38 to 42px tall, feet on the cell baseline 4px above the bottom. Bosses 64px cells (baseline 60). Enemies 32 or 48. A hero is a fifth of the playfield height, a boss a third; a detail under 3px vanishes, a silhouette feature under 8px does not read.
- Sprites face right in source; the runtime flips. Light comes from the upper left in every sheet.
- Downscale rule: Higgsfield draws at 1024px; a 4x3 sheet at 4:3 gives about 256px cells and a 3x1 turnaround about 341px cells. The cut (`hf_sheet_to_atlas.py`) box-downsamples each cell to the game cell (64, 48 or 32px, an integer factor when the grid allows it), then snaps to whole pixels with nearest-neighbour, sits every frame on the baseline, and quantizes to 32 colours. Gradients in the raw output are expected; the cut flattens them. Check the outline hue after the cut: it must be the cool or warm near-black, not pure black.

## Line and tone

- Outline: one dark pixel, never pure black: `#141A26` on cool sprites, `#1E1410` on warm ones.
- Three tones plus outline per material: base, shadow (base darkened about 35%), light (base lifted about 30%, only on top and left faces). No gradients, no anti-aliasing, no soft glow: glow is a flat second tone.
- Accent colours cover at most 15% of a sprite; one accent per character, one hazard colour per biome.
- 32 colours per atlas after the cut (`hf_sheet_to_atlas.py --quantize 32`).

## Palette per biome (base, shadow, edge, accent, hazard, sky)

| Biome | Base | Shadow | Edge | Accent | Hazard | Sky |
| --- | --- | --- | --- | --- | --- | --- |
| relay (tutorial, Omega spire) | `#304A6D` | `#1C2E47` | `#5C7FA8` | `#F2A93B` amber | `#E23A3A` red | `#0E1622` |
| pyro_maw (Heat Works) | `#6C3520` | `#3E1C10` | `#A5583A` | `#D9A441` brass | `#FF6A1F` flame | `#180D0B` |
| tide_reaver (Water) | `#214C77` | `#12304F` | `#4A7FB0` | `#7FE0E6` foam | `#3FE0FF` current | `#081622` |
| volt_hopper (Power) | `#314B86` | `#1B2C55` | `#5C78BC` | `#F6E24A` yellow | `#FFF27A` arc | `#0C1020` |
| basalt_titan (Structural) | `#4B3C29` | `#2C2217` | `#7E6748` | `#E37A2F` ember | `#FF4F1A` magma | `#15100C` |
| ferro_blade (Transit) | `#3D4659` | `#232935` | `#6C7A96` | `#9B6CF2` violet | `#C74BFF` field | `#12131A` |
| mire_wraith (Medicine) | `#2A5B38` | `#163521` | `#4F8F5E` | `#8FF25A` acid | `#B7FF3B` spill | `#0D140F` |
| gale_vixen (Weather) | `#31516C` | `#1C3145` | `#5F8DB0` | `#7FD8E0` teal | `#E8F4FF` gust | `#0D1520` |
| glacier_ronin (Archives) | `#4E79A6` | `#2F4F72` | `#8FB8DD` | `#DDF4FF` frost | `#A8F0FF` ice | `#0C1420` |
| omega_core (Core) | `#4B3868` | `#2C1F40` | `#7A5EA0` | `#E23A3A` red | `#FF2E5C` seam | `#100B18` |

Base is the platform colour already in `src/content/campaign.ts`; sky is the stage `backgroundColor`. Parallax layers use shadow and base only; edge marks the walkable top of a platform.

## Silhouettes already shipped (bosses, 2026-09-10)

Rook square, Pyro maw, Tide crescent, Volt bolt, Basalt slab, Ferro blade, Mire drip, Gale wing, Glacier shard, Omega ring. Every new character claims a shape not in this list and must read in black at 48px.

## Master Higgsfield prompt (gpt_image_2)

Sheets: 4:3, 1k, medium. Turnarounds and single cells: 1:1, 1k, medium.

> 16-bit pixel art {sheet or turnaround} of one original video game {hero, enemy, boss} character, SNES action platformer style, crisp hard-edged pixels, no anti-aliasing, dark 1px outline, three-tone shading, light from the upper left. The character: {CHARACTER}. Layout: exactly {C} columns and {R} rows of equal square cells ({cell}px each) on a flat solid magenta background (#FF00FF), character centered in every cell, {view}, same size and same design in every cell, feet on one baseline, no grid lines, no borders, no text, no labels, no shadows, no extra objects. {ROWS}. Nothing else in the image.

Negative words, always appended: "no gradients, no blur, no soft shading, no photorealism, no glow effects, no background scenery, no watermark". For the hero add: "original design, not Mega Man, no round helmet gem, no large round shoulder pads".

Provenance: prompt and job id go into a `.prompts.md` beside the source PNG; the `free-source-attribution.v1.json` entry (`original-generated`) is written when the art becomes a runtime atlas, before first runtime use.
