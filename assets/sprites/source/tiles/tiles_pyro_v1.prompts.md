# Heat Works tileset v1 (pyro_maw), Higgsfield gpt_image_2, 2026-09-24 (finish plan, Pyro Maw)

MCP `generate_image_batch`, 3:2, 1k, medium. Same layout and template as `tiles_relay_v1.prompts.md`, with the pyro palette (rusted iron #6C3520, shadow #1E1410/#3E1C10, edge #A5583A, brass #D9A441, flame #FF6A1F on hazards only), a grate catwalk, iron walls with brass pipes, and a floor flame vent in place of the spike cell. Decor: pressure gauge, chain, valve wheel, flame hazard sign.

| Variant | Job | Result URL | Picked |
| --- | --- | --- | --- |
| a | bac0ffbd-96bb-4d10-81ef-c18c87e1705e | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_221258_bac0ffbd-96bb-4d10-81ef-c18c87e1705e.png | yes |
| b | 7719c38d-e6a8-4e56-bcee-3f7f22d54877 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_221258_7719c38d-e6a8-4e56-bcee-3f7f22d54877.png | no |

Cut: `cut_tileset.py --biome pyro --grid 6x4 --brighten 1.15`, names as relay with cell 17 `vent` (no `spike`).
