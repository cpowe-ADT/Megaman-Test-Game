# Hero turnarounds v1, Higgsfield gpt_image_2, 2026-09-24 (prompt 05 §5.4, EVAL-P5-005)

All three: 1:1, 1k, quality medium, through the Higgsfield MCP (`generate_image_batch`). Brief: `docs/art/hero-brief.md`; template: `docs/art/style-sheet.md`. Licence on pick: `original-generated` (the attribution entry is written in 5.5 when the chosen design becomes a runtime atlas).

Shared block:

> 16-bit pixel art character turnaround of one original video game hero, SNES action platformer style, crisp hard-edged pixels, no anti-aliasing, dark 1px outline, three-tone shading, light from the upper left. The character: {CHARACTER}. Layout: exactly 3 columns and 1 row of equal square cells on a flat solid magenta background (#FF00FF), character centered in every cell: cell 1 front view, cell 2 side view facing right, cell 3 back view, same size and same design in every cell, feet on one baseline, no grid lines, no borders, no text, no labels, no shadows, no extra objects. Nothing else in the image. [the hero negatives from `docs/art/style-sheet.md`, Master Higgsfield prompt, "For the hero add"], no gradients, no blur, no soft shading, no photorealism, no glow effects, no background scenery, no watermark.

| File | Job | Character block |
| --- | --- | --- |
| `hero_turnaround_v1_2026-09-24_a.png` | 698a9bf0-47f9-4560-a5f9-8b82d66735b4 | a slim recovery android called WREN, angular helmet with one swept-back fin blade on the crown, narrow pale visor slit and no visible face, right forearm is a squared recovery tool cannon with a flat socket muzzle wider than the left forearm, left hand normal, a short signal cable trails from the back of the helmet like a scarf, slate-blue armor (#3F6FA6 base, #274A78 shadow, #7FB0DE light) with a single amber (#F2A93B) chest stripe, small amber lamp at each joint and an amber fin tip, grey undersuit at the joints, flat-soled boots, lean build, calm neutral stance |
| `hero_turnaround_v1_2026-09-24_b.png` | fc2e14a6-7684-4eef-8fcb-516c7a7fea47 | a compact recovery android called WREN, helmet with a tall narrow crest running front to back like a dorsal fin, dark visor band and no visible face, a short scarf of pale grey signal cloth around the neck with one loose end, right forearm is a squared recovery tool cannon with a flat socket muzzle wider than the left forearm, one small amber lamp on the left shoulder, slate-blue armor (#3F6FA6 base, #274A78 shadow, #7FB0DE light) with a single amber (#F2A93B) chest stripe and amber crest tip, grey undersuit at the joints, kneepads, sturdy flat boots, medium build, calm neutral stance |
| `hero_turnaround_v1_2026-09-24_c.png` | 409cd9e7-bfee-4656-bac0-32aeda1b11f0 | a lean recovery android called WREN, angular helmet with two small swept fins over the ears and a white face plate with a thin dark visor slit, a single cable runs from the back of the helmet down to a small square relay backpack with one amber antenna light, right forearm is a squared recovery tool cannon with a wide flat muzzle, left hand normal, slate-blue armor (#3F6FA6 base, #274A78 shadow, #7FB0DE light) with a single amber (#F2A93B) chest stripe and amber joint lamps, grey undersuit at the joints, thin frame, flat-soled boots, calm neutral stance |

Result URLs and the contact sheet (`output/art-review/hero-turnarounds.png`) are recorded below once the jobs finish.

## Results (2026-09-24, all three completed, Higgsfield gpt_image_2, 1024x1024)

| File | Result URL |
| --- | --- |
| `hero_turnaround_v1_2026-09-24_a.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_161304_698a9bf0-47f9-4560-a5f9-8b82d66735b4.png |
| `hero_turnaround_v1_2026-09-24_b.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_161304_fc2e14a6-7684-4eef-8fcb-516c7a7fea47.png |
| `hero_turnaround_v1_2026-09-24_c.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_161304_409cd9e7-bfee-4656-bac0-32aeda1b11f0.png |

Contact sheet (three at 480px, side view at 42px, 4x nearest and 4x silhouette): `output/art-review/hero-turnarounds.png`, built by `output/art-review/make_hero_contact.py`.

## Redraw after the Art Director review (2026-09-24, `docs/prompts/reviews/2026-09-24-5.4-hero/MERGED.md`)

Candidate C (job 409cd9e7) is **excluded**: twin ear fins plus a white face plate read as the helmet of the franchise the style sheet names (MAJOR; wording in `docs/prompts/reviews/2026-09-24-5.4-hero/MERGED.md`). Kept on disk as the record of the review. Replaced by C2:

| File | Job | Character block | Result URL |
| --- | --- | --- | --- |
| `hero_turnaround_v1_2026-09-24_c2.png` | 986ea4a5-dcfd-4cc8-b1f9-7bc5d22e949c | a lean recovery android called WREN, angular helmet with one single swept-back fin on the crown and a thin dark visor slit only, no face plate and no visible face, a single cable runs from the back of the helmet down to a small square relay backpack with one amber antenna light, right forearm is a squared recovery tool cannon with a wide flat muzzle held slightly forward and away from the body, left hand normal, slate-blue armor (#3F6FA6 base, #274A78 shadow, #7FB0DE light) with a single amber (#F2A93B) chest stripe and amber joint lamps, grey undersuit at the joints, thin frame, flat-soled boots, calm neutral stance (negative words add: no ear fins, no face plate) | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_161810_986ea4a5-dcfd-4cc8-b1f9-7bc5d22e949c.png |

The contact sheet now shows A, B and C2.
