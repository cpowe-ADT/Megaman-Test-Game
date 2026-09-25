# Hero combat VFX v1, Higgsfield gpt_image_2, 2026-09-24 (combo slice, reflect, buster; Craig: "fix the buster and the sword and get better graphics for that from Higgsfield")

Through the Higgsfield MCP (`generate_image_batch`), 1:1, 1k, quality medium, no reference image. Licence `original-generated`. All sheets are 4x4 cells on magenta; cut with `scripts/sprites/cut_vfx_sheet.py` (specs `scripts/sprites/vfx_hero_v1.json` for `projectiles_hero`, `scripts/sprites/vfx_hero_effects_v1.json` for `effects_hero`).

| File | Job | Picked | Content |
| --- | --- | --- | --- |
| projectiles_a.png | e47022a6-bbd6-44f6-8824-df62a3e94bfa | yes | buster pellet, mid and full charge shots, reflected orb, enemy orb and missile, three muzzle flashes, impact |
| projectiles_b.png | 4c256022-ae9c-404e-8d2f-d67fe20fc60c | no (softer edges, no outline) | same rows |
| slashes_a.png | 2bde2f0f-00b2-4071-a831-f9be7bc95f86 | yes | combo arcs: horizontal, rising, overhead finisher, spinning air slash; amber saber palette B8741C/F2A93B/FFD27A/FFF4D6 |
| hits_a.png | 6e599a1f-427c-4f10-bc59-73f60d731f8e | yes | sword hit spark, deflect star, charge aura, small explosion |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_2258NN_<job>.png` (NN 09 or 10).

Prompts (shared frame: "16-bit pixel art sprite sheet of ... for an original SNES action platformer, crisp hard-edged pixels, no anti-aliasing ... exactly 4 columns and 4 rows of equal square cells on a flat solid magenta background (#FF00FF) ... no grid lines, no borders, no text"):
- projectiles: row 1 two small lemon-shaped arm-cannon pellets (pale yellow-white core, amber rim), two medium charged shots (amber-gold oval, short swept tail); row 2 two full charged plasma blasts (gold-white crescent head, layered amber and cyan-white tail), two reflected enemy bullets (orb turned gold, white star spark ring); row 3 two red enemy orbs, two grey enemy missiles (red tip, orange exhaust); row 4 small, medium and large muzzle flashes and a small impact burst.
- slashes: row 1 a quick horizontal forward crescent, streak to full arc to fade; row 2 a rising diagonal crescent; row 3 a large overhead finisher down to the ground in front; row 4 a round spinning air slash. Every slash swings to the right; no character.
- hits: row 1 a sword hit spark (white and gold X flash breaking into sparks); row 2 a parry and deflect spark (white star, gold ring); row 3 a charge-up aura (pale gold and cyan particles, pulsing larger); row 4 a small explosion (flash, fireball, debris, smoke).

## Boss attack tells (2026-09-25, prompt 07 phase 7.1; the finish audit found telegraphs defined but never drawn)

| File | Job | Content |
| --- | --- | --- |
| telegraphs_a.png | 759dfff1-2109-4195-b1a8-68c94581a96c | red #E23A3A, orange #FF8A2A, yellow #FFD27A, white: four frames each of a reticle locking on, a floor danger marker, a warning flash starburst, a charging energy glow |

URL `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260925_012017_759dfff1-2109-4195-b1a8-68c94581a96c.png`. Cut with `scripts/sprites/cut_vfx_sheet.py --spec scripts/sprites/telegraphs_v1.json` into `assets/sprites/effects/telegraphs_v1/` (`reticle` 28x28, `floor_marker` 54x40, `warning_flash` 34x40, `charge_glow` 32x32).
