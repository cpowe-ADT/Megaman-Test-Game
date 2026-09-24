# UI art v1: portraits and title key art (finish plan, 2026-09-24), Higgsfield gpt_image_2

MCP `generate_image_batch`, 1k, medium, the WREN C2 turnaround (job 986ea4a5-dcfd-4cc8-b1f9-7bc5d22e949c) as the reference image. Licence `original-generated`.

| Asset | Prompt (abridged) | Variant a job (picked) | Variant b job |
| --- | --- | --- | --- |
| Portraits (4:3) | a 4x3 sheet of head-and-shoulders busts facing right on flat dark navy: WREN, Director Iona Vale (composed woman in her fifties, short silver hair, navy operations coat, amber collar pin, headset), Sentinel Rook, Pyro Maw; Tide Reaver, Volt Hopper, Basalt Titan, Ferro Blade; Mire Wraith, Gale Vixen, Glacier Ronin, Omega Core (each with its warden design line) | 64e0b7f1-e277-4092-aadc-36326cccf4d5 | b8d58c3f-6d88-48df-8303-678cf8b01adf |
| Title key art (16:9) | WREN on a rooftop relay mast over a night city of eight glowing districts, the Omega Core spire with a red eye and eight relay beams; upper left kept calm for the logo; no text | 09c0b6d9-1b3a-478f-b78a-2dcc0a8cb8b3 | 21ef8c52-5983-4df2-9362-85c0c60d1061 |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_223517_<job>.png`. Cut: `scripts/sprites/cut_portraits.py` (48px, `assets/ui/portraits/`), the key art by the pixel-art mode downscale to 448x252 (`assets/ui/title/title_keyart.png`).
