# Stage mechanic art v1, Higgsfield gpt_image_2, 2026-09-25 (finish plan; the vents, slag, walls, crumbles and teach gates were flat rectangles)

Through the Higgsfield MCP (`generate_image_batch`), 1:1, 1k, quality medium, no reference image. Licence `original-generated`. Cut with `scripts/sprites/cut_vfx_sheet.py --spec scripts/sprites/mechanics_v1.json` into `assets/sprites/mechanics/mechanics_v1/` (groups `vent_nozzle` 20x16, `vent_flame` 28x52, `breakable_wall` 42x52, `crumble` 58x34, `slag_surface` 30x16 and `slag_fill` 30x29 with no padding so they tile, `energy_gate` 32x64, `scrap_gate` 58x60; four frames each).

| File | Job | Content |
| --- | --- | --- |
| mechanics_pyro_a.png | 3efe5037-0b99-4491-b95b-ede21bd6cd2f | foundry palette (cast iron #3A2A24, rust #6C3520, brass #B07A3A, hot orange #FF6A1F, yellow-white #FFE9A8): flame vent nozzle cold, arming dull, arming bright, firing; four frames of a vertical fire jet; a scrap-plate breakable wall intact, cracked, heavily cracked, collapsing; a riveted catwalk slab intact, cracked, breaking, falling |
| mechanics_slag_gates_a.png | 4c0879be-b642-4480-a384-83863db7f46d | four frames of a bubbling molten slag surface strip (tileable), four molten slag fill tiles, four frames of a cyan energy barrier gate between steel emitters, a welded scrap barricade with a yellow-black hazard slash mark intact, cut once, cut twice, falling apart |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260925_000836_<job>.png`. Prompt frame as the other sheets ("16-bit pixel art sprite sheet ... for an original SNES action platformer, crisp hard-edged pixels, no anti-aliasing ... exactly 4 columns and 4 rows of equal square cells on a flat solid magenta background (#FF00FF) ... no grid lines, no borders, no text, no shadows"), rows as in the table.

## v2 (2026-09-25): the seven mechanics still to build (finish audit)

Same frame and settings. Cut with `scripts/sprites/cut_vfx_sheet.py --spec scripts/sprites/mechanics_v2.json` into `assets/sprites/mechanics/mechanics_v2/` (`conveyor` 56x18, `ice_tile` 16x16 tiling, `icicle` 28x36, `rockfall` 38x26, `power_rail` 56x28, `wind_gust` 50x30, `wind_lift` 34x46, `current` 48x26, `magnet_lift` 36x38).

| File | Job | Content |
| --- | --- | --- |
| mechanics_v2_objects_a.png | 2ebb4eee-76e7-4f4c-be03-01deee8ef05b | four frames of a conveyor segment with yellow chevrons stepping right; an ice floor tile, the tile cracked, an icicle hanging from a rock clump, the icicle shattering; rockfall (warning dust, boulder, falling boulder, rubble); an electrified power rail (off, arming sparks, arcing, fading) |
| mechanics_v2_forces_a.png | 659444c4-bfc0-47eb-bbee-d33830c0b5a4 | four frames each: a sideways wind gust (air streaks, leaves), an upward wind lift column, an underwater current (streams, bubbles), a magnetic lift (steel emitter plate, rising ring waves) |

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260925_012017_<job>.png`.
