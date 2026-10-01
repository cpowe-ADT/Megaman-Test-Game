# Rogue enemy robots v1 (relay biome), Higgsfield gpt_image_2, 2026-09-24 (phase 6.P, EVAL-P6-018)

Through the Higgsfield MCP (`generate_image_batch`), 3:4, 1k, quality medium, no reference image. Licence `original-generated`. Two variants per family; variant a picked for all six (clearest silhouettes and poses).

Shared template: "16-bit pixel art animation sprite sheet of one original enemy robot for an SNES action platformer, crisp hard-edged pixels, no anti-aliasing, dark 1px outline, three-tone shading, light from the upper left. The enemy: {DESIGN}. Layout: exactly 4 columns and 5 rows of equal cells on a flat solid magenta background (#FF00FF), one robot centered in every cell, side view facing RIGHT, same size and same design in every cell, feet on one baseline, no grid lines, no borders, no text, no shadows. Row 1: three idle frames, then a hurt frame (flashing white). Row 2: four walking (or hovering) frames. Row 3: three attack wind-up frames, then the last wind-up pose again. Row 4: three firing frames with a small flat muzzle flash, then the last firing pose again. Row 5: four explosion frames: sparks, the body breaking apart, a burst of orange and grey debris, a small puff of smoke. No gradients, no blur, no photorealism, no glow, no watermark, original design." Armor for all: gunmetal grey (#5A5F6B base, #3A3E47 shadow, #8A909C light) with red hazard stripes (#E23A3A).

| Family (atlas) | Design | Variant a job (picked) | Variant b job |
| --- | --- | --- | --- |
| enemy_gunner_bot | squat two-legged sentry, boxy head, red visor slit, heavy arm cannon | da4a9c87-7a44-47da-ba15-b8660a5bd2b8 | ebd19826-112b-47ed-a237-45f548ce7a79 |
| enemy_shock_hopper | round body on one coiled spring leg, two electric coil antennae, red eye | aac2d7e4-6010-47ed-8612-346483c71436 | d88a99ef-6394-4c53-9e9f-a985664cac63 |
| enemy_drone | wide flat drone, two rotor pods, one big red lens | 23ad830c-bc66-4eb6-a90e-487ffeaf75a5 | 7e24db37-5d89-4bb6-b782-32d177d0b286 |
| enemy_armored_bot | wide tracked dozer, angled plow shield, stubby cannon, red visor | c709240b-8383-49a7-851e-b7b7fa5b5b07 | 5bf3e893-950a-48a4-9c4d-2e83a8b43c9e |
| enemy_shield_drone | ducted-fan drone behind a tall curved riot shield, red eye | 03a09bf3-ab39-4e98-aee9-8792b55cfeb5 | 55e9b061-47ee-4ac6-9595-af42af8477f6 |
| enemy_rocket_bot | lean biped with a shoulder rocket pod, four red-tipped rockets | cf7aa3e0-4b50-4bc8-aa7d-b74e11a882a3 | f9cbd10c-6b3f-4fc2-87fb-9f2284cd6849 |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_2123NN_<job>.png` (NN 27 to 29; the exact names are the downloaded files' sources: `enemy_<family>_{a,b}.png` here).

Cut (from `scripts/sprites`): `../../.venv/bin/python cut_enemy_sheet.py --in ../../assets/sprites/source/enemies/hf_v1/enemy_<family>_a.png --type-key <atlas>`; the shield drone adds `--fill-height` (its old art was a flat 38x19 box; the new design is taller, the body still sits at the frame bottom). Each atlas keeps its frame names, frame size and feet row; the target box is recorded in the atlas meta (`reskinTarget`) so reruns do not drift.

## Pyro Maw families (finish plan, 2026-09-24)

| Family (atlas) | Design | Variant a job (picked) | Variant b job |
| --- | --- | --- | --- |
| enemy_mine_bot | low dome crawler on four legs, two sensor feelers, a mortar tube lobbing glowing mines | 7001853e-8989-4b90-b526-07bfeb51ce82 | b07f1557-5d25-4ef9-9ff5-ef6dcda225f2 |
| enemy_slicer_bot | lean biped with a circular saw on its front arm | 7f07b2f0-9d4e-473b-b177-b1600574b6bf | bff2fd40-0e27-4063-91f1-2b6079f6de53 |
| enemy_bouncer | steel wrecking-ball robot on two piston feet, red visor band | d502da56-3bb9-479a-98f8-2750ea7a097e | 33c20330-e483-48b9-b67f-86f3064b10a2 |

Result URLs `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_221258_<job>.png`. The mine bot and bouncer cut with `--fill-height` (their old art used a corner of the frame).

## The last three families (finish plan, same day)

| Family (atlas) | Design | Job and URL |
| --- | --- | --- |
| enemy_frost_turret | hovering boxy cryo turret with a frost cannon | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_8e12f2f3-e8b8-4936-bfc8-4826eab85e9a.png (`enemy_frost_a.png`) |
| enemy_laser_eye | floating sentry eye in an armored clam shell, thin red laser | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_1c41a439-90b1-4904-8d4c-900cd9253153.png (`enemy_laser_a.png`) |
| enemy_fly_trap | floating snap-trap pod with toothed jaws and a rotor | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_222417_08f58881-a6c9-411b-bede-4000c07be38e.png (`enemy_flytrap_a.png`) |

All three cut with `--fill-height`.
