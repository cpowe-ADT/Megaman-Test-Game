# Mini-boss sheets v1, Higgsfield gpt_image_2, 2026-09-24 (EVAL-P6-005; the Heat Works brief's `custodian_walker`)

Through the Higgsfield MCP (`generate_image_batch`), 3:4, 1k, quality medium, no reference image. Licence `original-generated`. Enemy layout (4 columns x 5 rows on magenta): idle 3 + hurt, walk 4, stomp wind-up 3 (+ repeat), stomp impact 3 (+ repeat) with a flat orange shockwave, death 4. Faces right.

| File | Job | Picked | Design |
| --- | --- | --- | --- |
| custodian_walker_a.png | 310fec33-bcb8-49f4-a99e-15f4cc7cab47 | yes (clearest silhouette, readable stomp) | hulking two-legged foundry custodian, scorched steel with heat-scarred plating and glowing orange seams, furnace grille chest, piston legs with flat feet, small cab head with a red visor slit, stubby clamp arms |
| custodian_walker_b.png | a2ced42e-f30e-4d54-b476-256e05d40f6d | no (faces left; busier outline) | tall boiler-drum walker, digitigrade piston legs, smokestack, one red lens, hydraulic arms |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_22472{6,7}_<job>.png`. Cut 2026-09-24: `cd scripts/sprites && ../../.venv/bin/python cut_enemy_sheet.py --in ../../assets/sprites/source/minibosses/hf_v1/custodian_walker_a.png --type-key custodian_walker --move-group run` into `assets/sprites/enemies/custodian_walker/` (18 frames of 64x64, idle 54x52, feet row 62, from a template atlas that set `reskinTarget`). Not wired to a runtime family yet (EVAL-P6-005).

## The other three archetypes (2026-09-25, prompt 06 phase 6.3; finish audit)

Same template (4x5, 3:4, 1k, medium, faces right). Cut with `cut_enemy_sheet.py --type-key <key>` from a template atlas (`reskinTarget` in its meta); none wired to a runtime family yet.

| File | Job | Design | Atlas |
| --- | --- | --- | --- |
| relay_turret_nest_a.png | 73b01cec-eb9f-4b52-86ba-ebbc7eb448e3 | squat armored bunker on four clamp legs, rotating twin-barrel turret, radar dish, teal and grey plating with hazard stripes, one red sensor eye | `assets/sprites/enemies/relay_turret_nest/` 64x64, feet row 62, move group `run` |
| sentry_twin_a.png | a93824af-f977-47b3-8a95-8e8d9523cafd | one of a pair of round hovering security drones, big yellow lens, stabilizer fins, lightning emblem, yellow and navy armor | `assets/sprites/enemies/sentry_twin/` 48x48, feet row 44, move group `hover` |
| drill_serpent_a.png | cdd73d41-aff2-428d-973a-317ad26231f4 | segmented mechanical worm with a spinning cone drill head, moss green and rusted bronze plating, toxic green seams, emerging from a mud mound | `assets/sprites/enemies/drill_serpent/` 64x64, feet row 62, move group `run` (burrow); `--clear-top-rows 10 --cells attack_active=12,13,13` |

URLs `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260925_01201{7,8}_<job>.png`.
