# UI art v1: portraits and title key art (finish plan, 2026-09-24), Higgsfield gpt_image_2

MCP `generate_image_batch`, 1k, medium, the WREN C2 turnaround (job 986ea4a5-dcfd-4cc8-b1f9-7bc5d22e949c) as the reference image. Licence `original-generated`.

| Asset | Prompt (abridged) | Variant a job (picked) | Variant b job |
| --- | --- | --- | --- |
| Portraits (4:3) | a 4x3 sheet of head-and-shoulders busts facing right on flat dark navy: WREN, Director Iona Vale (composed woman in her fifties, short silver hair, navy operations coat, amber collar pin, headset), Sentinel Rook, Pyro Maw; Tide Reaver, Volt Hopper, Basalt Titan, Ferro Blade; Mire Wraith, Gale Vixen, Glacier Ronin, Omega Core (each with its warden design line) | 64e0b7f1-e277-4092-aadc-36326cccf4d5 | b8d58c3f-6d88-48df-8303-678cf8b01adf |
| Title key art (16:9) | WREN on a rooftop relay mast over a night city of eight glowing districts, the Omega Core spire with a red eye and eight relay beams; upper left kept calm for the logo; no text | 09c0b6d9-1b3a-478f-b78a-2dcc0a8cb8b3 | 21ef8c52-5983-4df2-9362-85c0c60d1061 |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_223517_<job>.png`. Cut: `scripts/sprites/cut_portraits.py` (48px, `assets/ui/portraits/`), the key art by the pixel-art mode downscale to 448x252 (`assets/ui/title/title_keyart.png`).

## Pickups and HUD icons (2026-09-25, prompt 12; the pickups were drawn in code by `src/ui/pickups/PickupTextures.ts`, the HUD had no weapon icons)

Higgsfield MCP (`generate_image_batch`), 1:1, 1k, medium, no reference. Licence `original-generated`. Cut with `scripts/sprites/cut_vfx_sheet.py`: `--spec scripts/sprites/pickups_v1.json` into `assets/sprites/pickups/pickups_v1/` (health small and large, weapon energy small and large, extra life, heart tank, sub tank, upgrade capsule; two frames each, the second with a sparkle) and `--spec scripts/sprites/hud_icons_v1.json` into `assets/ui/hud_icons/hud_icons_v1/` (16 icons forced to 16x16: buster, the nine warden weapons, saber, shield, heart, sub tank, capsule, key card). Not wired yet.

| File | Job |
| --- | --- |
| pickups_v1_a.png | 0738f5f8-c903-4aa5-b6c5-91e9b9cf54c8 |
| hud_icons_v1_a.png | eac05d70-2690-49b1-86dc-65f6f91b9070 |

Result URLs `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260925_01455{8,9}_<job>.png`. The heart tank's pink glass keys out against magenta (it reads as clear glass); the extra-life token is WREN's helmet (original design).
