# Hero sheets v1 (WREN, design C2), Higgsfield gpt_image_2, 2026-09-24 (prompt 05 §5.5, EVAL-P5-006)

Through the Higgsfield MCP (`generate_image_batch`; the CLI was not signed in: `higgsfield auth login` pending Craig). 1k, quality medium, reference image = the C2 turnaround job `986ea4a5-dcfd-4cc8-b1f9-7bc5d22e949c` (role `image`). Plan and groups: `docs/art/hero-sheets.md`. Licence: `original-generated`.

Shared character block (sheets A and B; C and D replace "left hand normal" with "left hand holds a short solid flat amber (#F2A93B) energy cutter blade (not a green beam, no hilt on the back)"):

> WREN, the same recovery android as in the reference image, redrawn as a compact action-game sprite about four heads tall with a slightly large helmet: angular slate-blue helmet with one single short swept-back fin on the crown (about half the helmet's height), a thin dark visor slit with an amber glint and no visible face, one dark cable from the back of the helmet to a small square relay backpack with one amber antenna light, right forearm is a squared slate-blue recovery tool cannon with a wide flat socket muzzle, left hand normal, slate-blue armor (#3F6FA6 base, #274A78 shadow, #7FB0DE light) with a single amber (#F2A93B) chest stripe and small amber joint lamps, dark grey undersuit at the joints, flat-soled boots.

The template is the style sheet's master prompt (6x4 at 3:2 for A and B, 4x6 at 2:3 for C and D), with the rows exactly as listed in `docs/art/hero-sheets.md`, and the negatives: "No gradients, no blur, no soft shading, no photorealism, no glow effects, no background scenery, no watermark." then the hero negatives from `docs/art/style-sheet.md` ("For the hero add") and "no ear fins, no face plate."

| Sheet | Variant | Job | Result URL | Picked |
| --- | --- | --- | --- | --- |
| A locomotion | 1 | 9d009c93-6f80-4b1d-b694-849131f14ce5 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_9d009c93-6f80-4b1d-b694-849131f14ce5.png (`hero_sheet_v1_2026-09-24_a1.png`) | no |
| A locomotion | 2 | 5223745e-1840-4bc7-8dd3-b0c46e48a980 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_5223745e-1840-4bc7-8dd3-b0c46e48a980.png (`hero_sheet_v1_2026-09-24_a2.png`, kept outside the repo; only the cleaned copy is committed) | yes (A2; wall line at x 294-297 of the wall-slide cell painted magenta in `hero_sheet_v1_2026-09-24_a2_clean.png`) |
| B dash, shoot, hurt | 1 | d84a6d84-7270-435d-9e59-ee642f59a871 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_d84a6d84-7270-435d-9e59-ee642f59a871.png (`hero_sheet_v1_2026-09-24_b1.png`) | no: mixed facing |
| B dash, shoot, hurt | 2 | 13b4c432-db8c-4e57-a986-a3d0d1f2c19d | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_13b4c432-db8c-4e57-a986-a3d0d1f2c19d.png (`hero_sheet_v1_2026-09-24_b2.png`) | yes (B2) |
| C ground saber, respawn | 1 | 1ec5baf9-8470-4fde-80f7-216a1a83d4d2 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_1ec5baf9-8470-4fde-80f7-216a1a83d4d2.png (`hero_sheet_v1_2026-09-24_c1.png`) | no: thinner arcs |
| C ground saber, respawn | 2 | 82768ca9-b9d2-4e36-abb4-115ee8a4f2a8 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_82768ca9-b9d2-4e36-abb4-115ee8a4f2a8.png (`hero_sheet_v1_2026-09-24_c2.png`) | yes (C2) |
| D air saber, victory | 1 | ee72b977-1fb9-4d22-be44-f5d98ebb4a31 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_ee72b977-1fb9-4d22-be44-f5d98ebb4a31.png (`hero_sheet_v1_2026-09-24_d1.png`) | no: forward air slash swings behind |
| D air saber, victory | 2 | 943a3bb7-f544-4a2e-a0eb-666a79e5c91d | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183252_943a3bb7-f544-4a2e-a0eb-666a79e5c91d.png (`hero_sheet_v1_2026-09-24_d2.png`) | no: forward air slash swings behind |
| D air saber, victory | 3 (regenerated: "faces LEFT ... every slash swings IN FRONT of the character") | 8515d55a-1d08-4d1c-b434-e4bec9c28e94 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183531_8515d55a-1d08-4d1c-b434-e4bec9c28e94.png (`hero_sheet_v1_2026-09-24_d3.png`) | yes (D3) |
| D air saber, victory | 4 (same) | f9397024-b3c6-4a33-9403-a5b753cee9dd | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_183531_f9397024-b3c6-4a33-9403-a5b753cee9dd.png (`hero_sheet_v1_2026-09-24_d4.png`) | no: cannon missing in rows 3 and 5 |

All picked sheets draw WREN facing left (as the C2 side view does); the atlas keeps that facing, which is what the runtime's flip rule expects (`shouldFlipPlayerSpriteForFacing` in `src/player/config.ts`). Muzzle flashes and charge rings drawn into the shoot and charge cells are removed at the cut (the runtime draws its own), the saber arcs and the death fragments are kept.

## Corrective sheet E (2026-09-24, after the first cut)

The first cut showed dash and jump poses drawn lying flat and wide shooting poses. One 4x4 sheet at 1:1 redraws them upright ("The torso stays UPRIGHT or leans forward at most 30 degrees in every cell; the body is never horizontal", no flashes drawn; the rest of the prompt as above): jump_rise, jump_apex, (fall, not used), knockdown; dash_start, dash_loop, dash_end, dash_shoot; airdash_start, airdash_loop, airdash_end, hurt_light; charge_release_lv1 to lv4.

| Variant | Job | Result URL | Picked |
| --- | --- | --- | --- |
| E1 | d23cd477-b1b0-4187-95c1-27a20ccaed54 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_190342_d23cd477-b1b0-4187-95c1-27a20ccaed54.png (`hero_sheet_v1_2026-09-24_e1.png`) | yes |
| E2 | 5ade6ffd-2a2c-4ec4-a7fd-0fe04f17b72a | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_190342_5ade6ffd-2a2c-4ec4-a7fd-0fe04f17b72a.png (`hero_sheet_v1_2026-09-24_e2.png`) | no: air dash flat again |

Cut: `scripts/sprites/cut_hero_v1.sh` (A, B, C, D, then E1 with `--append`). Credits: 12 generations, about 12 credits (balance 2,997.5 before).

