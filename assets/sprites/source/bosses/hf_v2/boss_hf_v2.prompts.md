# Warden sheets v2, Higgsfield gpt_image_2 (finish plan, 2026-09-24)

The September v1 sheets are kept; v2 redraws a warden whose silhouette failed at 64px (game-director overhaul audit: Pyro "reads as a shapeless blob"). Same 4x3 layout (idle, move, shoot), 4:3, 1k, medium; cut by `scripts/sprites/cut_enemy_sheet.py --layout boss`.

## Pyro Maw

> 16-bit pixel art animation sprite sheet of one original boss robot ... PYRO MAW, a tall upright two-legged foundry warden robot with the proud stance of a lion knight: broad armored shoulders, a lion-like helmet whose jaw is a hinged furnace grille, a mane of flat stylised flame shapes (drawn as solid orange and yellow shapes, not glow), a chest furnace grate, thick clawed forearms, digitigrade legs, red and black armor (#8A2A1C base, #4A1510 shadow, #C8503A light) with brass rivets (#D9A441). Clear readable silhouette with separate arms and legs, standing tall, not a blob. Layout: exactly 4 columns and 3 rows ... side view facing LEFT ... Row 1: four idle frames. Row 2: four ignition dash frames. Row 3: four flame stream frames ... not a lion animal, a robot.

| Variant | Job | Picked |
| --- | --- | --- |
| a | 4afbb708-5773-4f1f-bb98-c0772c011f8d | no |
| b | 2a43f51a-5b70-44ee-8851-0fe9ef015d4b | yes: clearer jaw and shoulders |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_22125{8,9}_<job>.png`. Cut: `--layout boss --mirror --cells shoot=8,10,10,11` (the sheet faces left; the runtime expects right-facing bosses; cell 9's jet crossed into cell 8, so the clean firing cell 10 is used twice).
