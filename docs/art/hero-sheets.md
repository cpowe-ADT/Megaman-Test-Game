# Hero sheets: WREN (C2), prompt 05 §5.5

Status: 05c, 2026-09-24. Design: C2 (`assets/sprites/source/player/hero_turnaround_v1_2026-09-24_c2.png`, job `986ea4a5-dcfd-4cc8-b1f9-7bc5d22e949c`), Craig's pick with the fin shortened by a third (D-014). Style: `style-sheet.md`; brief: `hero-brief.md`.

## Inventory

The runtime binds 45 groups and 89 frames (`src/player/PlayerAtlasBindings.ts`; the same 45 group names the retired private spec used). Frames are `player_main/<group>/<index>` with a three-digit index, in one atlas `assets/sprites/player/main/player_main.{png,atlas.json}`, 48px cells, feet on row 46 (the row the tuned body profiles end on: `PLAYER_BODY_PROFILES` offsetY + height = 46 for stand, crouch and dash; the style sheet's 44 would move every body 2px). Extra frames past a binding's `end` are harmless and kept for later use.

## Sheets (Higgsfield `gpt_image_2`, 1k, medium, C2 turnaround as the reference image)

Cells are row-major; every figure faces left, as the C2 side view does and the player flip rule expects; magenta `#FF00FF` background. Sheets A, B, C and D were picked from two variants each (`assets/sprites/source/player/hero_sheets_v1_2026-09-24.prompts.md`).

| Sheet | Grid (aspect) | Row 1 | Row 2 | Row 3 | Row 4 | Rows 5 and 6 |
| --- | --- | --- | --- | --- | --- | --- |
| A locomotion | 6x4 (3:2) | idle 0-3, turn, land | run 0-5 | crouch_in, crouch_hold, crouch_out, jump_start, jump_rise, jump_apex | fall, wall_slide, wall_jump, dash_start, dash_loop, dash_end | |
| B dash, shoot, hurt | 6x4 (3:2) | airdash_start, airdash_loop, airdash_end, dash_shoot, shoot_air, charge_start | shoot_ground 0-1, shoot_run 0-1, charge_hold 0-1 | charge_release_lv1-lv4, hurt_light, hurt_heavy | knockdown, getup, death 0-3 | |
| C ground saber | 4x6 (2:3) | slash_ground_e 0-3 | slash_ground_ne 0-3 | slash_ground_n 0-3 | slash_ground_se 0-3 | slash_ground_s 0-3; respawn 0-3 |
| D air saber | 4x6 (2:3) | slash_air_e 0-3 | slash_air_ne 0-3 | slash_air_n 0-3 | slash_air_se 0-3 | slash_air_s 0-3; victory 0-3 |

## Pose notes per group

- idle: calm stance, buster arm lowered, frames 2-3 a visor blink (amber slit dims) and a small breath; turn: mid-turn three-quarter view; land: knees bent, weight low.
- run: six-frame run cycle, forward lean, cable trailing, buster arm swinging at the side.
- crouch_in / hold / out: bending, full crouch, rising. jump_start: knees bent about to leap; jump_rise: legs tucked, rising; jump_apex: body level, arms out; fall: legs extended down, cable up.
- wall_slide: back to a wall on the right edge of the cell, one hand and one foot on it, sliding down; wall_jump: kicking off, body angled away from the wall.
- dash_start / loop / end: low forward lunge, full dash with body almost horizontal and cable streaming, braking. airdash: the same pose in the air.
- shoot poses: buster arm extended straight forward at shoulder height with a small amber muzzle flash (flat colour, no glow); dash_shoot: dash pose firing.
- charge_start / hold: buster held forward, a flat amber ring around the muzzle, bigger on hold frame 1; release lv1-lv4: recoil poses with a muzzle flash that grows per level.
- hurt_light: flinch backward; hurt_heavy: thrown back, arms up; knockdown: on the back; getup: one knee rising; death 0-3: flash, break-up into amber and blue fragments, scatter, only fragments.
- saber: a short amber energy cutter in the left hand (flat amber blade, not a green beam, not a hilt on the back). Frames 0-3 per direction: wind-up, swing, full arc (amber crescent trail as a flat shape), recover. Directions: e forward, ne up-forward, n straight up, se down-forward, s straight down (ground: a downward stab from a crouch; air: a plunging slash).
- respawn 0-3: a vertical amber beam column, the body forming inside it, formed crouching, standing ready. victory 0-3: buster raised, small nod, relaxed stand, visor bright.

## Cut

The exact commands are `scripts/sprites/cut_hero_v1.sh`: `--baseline 46`, `--body-height` 40 for A, 37 for B to D and 39 for the corrective sheet E1, `--flash-cells` for B's shooting and charge cells, `--body-only-cells` for the saber cells (the runtime draws the saber trail), one run per sheet with `--append` after the first. Prompts, job ids and result URLs go into `assets/sprites/source/player/hero_sheets_v1_2026-09-24.prompts.md`.
