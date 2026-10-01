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

## Intro, defeat and phase-two poses (2026-09-25, prompt 07 phase 7.2 items 4 to 6; prompt 12 part 12f)

One 4x3 sheet per boss at 4:3, 1k, medium, the boss's own v2 sheet as the reference image (role `image`; Pyro Maw's variant b). Prompt: "exactly the same robot as in the reference sheet ... facing RIGHT ... Row 1, the entrance intro: four frames of a proud power-up pose ... Row 2, the defeat: four frames (heavily damaged with sparks, staggering, collapsing to one knee with smoke, broken and dark with smoke). Row 3, the phase-two power-up: four frames of an enraged pose with a bright energy aura building around the body" (Omega Core: the ring lighting up segment by segment; cracking and breaking away). Cut with `scripts/sprites/cut_enemy_sheet.py --layout boss-extra --clear-top-rows 6` (Pyro Maw with `--mirror`: its first intro frame matched the standing frame mirrored, silhouette IoU 0.895 against 0.717; the other nine matched unmirrored), appending `intro`, `defeat` and `phase` groups (4 frames each) to `assets/sprites/bosses/<key>.{png,json}`; the existing idle, move and shoot frames keep their silhouettes exactly (checked frame by frame). Omega's phase row lost most of its red aura to the magenta key; the runtime adds its flash.

| Boss | Job |
| --- | --- |
| sentinel_rook | 729527f5-50a3-42c1-8fa1-bbd013e3acab |
| pyro_maw | 607f65d9-b22a-4923-9308-061436126e07 |
| tide_reaver | ddda4ff2-8328-4dd1-9405-492d0481c3d8 |
| volt_hopper | 2eabba16-1cdf-43b5-b577-1c6617a8b216 |
| basalt_titan | c67c4ecf-0b61-439a-97f1-5c9b151a4e13 |
| ferro_blade | 7eb4f56a-9d3f-4203-bd41-21886ddff118 |
| mire_wraith | e27aa3e3-a168-41f7-9b37-21775f62452d |
| gale_vixen | 28304b16-c0be-4e3d-b53f-6a574bf7a39c |
| glacier_ronin | 2d53adba-2b0e-4418-ab15-17e75e00bc84 |
| omega_core | 3c9c23f3-5312-4510-815a-6da74f64254f |

Result URLs `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260925_014010_<job>.png`; sources `assets/sprites/source/bosses/hf_v2/<key>_extra_a.png`.
