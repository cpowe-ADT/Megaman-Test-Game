# Warden sheets v2, Higgsfield gpt_image_2 (finish plan, 2026-09-24)

The September v1 sheets are kept; v2 redraws a warden whose silhouette failed at 64px (game-director overhaul audit: Pyro "reads as a shapeless blob"). Same 4x3 layout (idle, move, shoot), 4:3, 1k, medium; cut by `scripts/sprites/cut_enemy_sheet.py --layout boss`.

## Pyro Maw

> 16-bit pixel art animation sprite sheet of one original boss robot ... PYRO MAW, a tall upright two-legged foundry warden robot with the proud stance of a lion knight: broad armored shoulders, a lion-like helmet whose jaw is a hinged furnace grille, a mane of flat stylised flame shapes (drawn as solid orange and yellow shapes, not glow), a chest furnace grate, thick clawed forearms, digitigrade legs, red and black armor (#8A2A1C base, #4A1510 shadow, #C8503A light) with brass rivets (#D9A441). Clear readable silhouette with separate arms and legs, standing tall, not a blob. Layout: exactly 4 columns and 3 rows ... side view facing LEFT ... Row 1: four idle frames. Row 2: four ignition dash frames. Row 3: four flame stream frames ... not a lion animal, a robot.

| Variant | Job | Picked |
| --- | --- | --- |
| a | 4afbb708-5773-4f1f-bb98-c0772c011f8d | no |
| b | 2a43f51a-5b70-44ee-8851-0fe9ef015d4b | yes: clearer jaw and shoulders |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_22125{8,9}_<job>.png`. Cut: `--layout boss --mirror --cells shoot=8,10,10,11` (the sheet faces left; the runtime expects right-facing bosses; cell 9's jet crossed into cell 8, so the clean firing cell 10 is used twice).

## The other eight wardens and Rook (finish plan, same day)

One variant each, facing RIGHT as asked (no mirror), the September v1 design line for each warden with "clear readable silhouette" and effects "drawn as flat shapes". Cut by `cut_enemy_sheet.py --layout boss` (Gale Vixen with `--cells shoot=8,9,9,11`: its third attack cell holds only the darts).

| Warden | Job and URL |
| --- | --- |
| sentinel_rook | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_eef8aa8c-56fc-4938-b2d8-8d6587b01c04.png |
| tide_reaver | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_9bae6f7f-8e81-4728-8a5e-95ac91e8c414.png |
| volt_hopper | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_34e8a601-f7d5-492e-b37c-9811837663c0.png |
| basalt_titan | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_a6709423-bdbd-47c0-aa5b-0f81c8bb1c1a.png |
| ferro_blade | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_66efea51-7204-4cde-9534-6257c0530826.png |
| mire_wraith | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_f021421d-8635-495f-ac34-fc2051bf1bdb.png |
| gale_vixen | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222416_e0d1f31b-79ef-4876-86a9-5ca9ddd545f4.png |
| glacier_ronin | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_1eb93240-3abe-4c58-9069-787fa19a689a.png |
| omega_core | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_e9fe6eba-de2a-4cf7-a7e8-023aeebc8d88.png |
