# Mini-boss sheets v1, Higgsfield gpt_image_2, 2026-09-24 (EVAL-P6-005; the Heat Works brief's `custodian_walker`)

Through the Higgsfield MCP (`generate_image_batch`), 3:4, 1k, quality medium, no reference image. Licence `original-generated`. Enemy layout (4 columns x 5 rows on magenta): idle 3 + hurt, walk 4, stomp wind-up 3 (+ repeat), stomp impact 3 (+ repeat) with a flat orange shockwave, death 4. Faces right.

| File | Job | Picked | Design |
| --- | --- | --- | --- |
| custodian_walker_a.png | 310fec33-bcb8-49f4-a99e-15f4cc7cab47 | yes (clearest silhouette, readable stomp) | hulking two-legged foundry custodian, scorched steel with heat-scarred plating and glowing orange seams, furnace grille chest, piston legs with flat feet, small cab head with a red visor slit, stubby clamp arms |
| custodian_walker_b.png | a2ced42e-f30e-4d54-b476-256e05d40f6d | no (faces left; busier outline) | tall boiler-drum walker, digitigrade piston legs, smokestack, one red lens, hydraulic arms |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_22472{6,7}_<job>.png`. Cut 2026-09-24: `cd scripts/sprites && ../../.venv/bin/python cut_enemy_sheet.py --in ../../assets/sprites/source/minibosses/hf_v1/custodian_walker_a.png --type-key custodian_walker --move-group run` into `assets/sprites/enemies/custodian_walker/` (18 frames of 64x64, idle 54x52, feet row 62, from a template atlas that set `reskinTarget`). Not wired to a runtime family yet (EVAL-P6-005).
