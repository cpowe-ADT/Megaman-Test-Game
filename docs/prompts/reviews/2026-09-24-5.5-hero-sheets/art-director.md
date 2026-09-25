Seat: art-director
Commit: 38514b7
Scope: WREN (design C2, D-014 fin shortened by a third) as a 48px sprite across all animation families, EVAL-P5-006 and EVAL-P5-007
Artifacts opened: output/packets/2026-09-241948-art-director.md, output/notes/05c-5.5.md, output/art-review/hero.png, output/art-review/hero-motion.png, assets/sprites/source/player/hero_turnaround_v1_2026-09-24_c2.png, output/art-review/hero-atlas.png
Tokens: 42552

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | A stray red or magenta pixel recurs at a joint in unrelated frames (shoot_ground frame 1, hurt_heavy, getup), consistent with a key-colour remnant the defringe pass missed. | `output/art-review/hero.png` rows shoot_ground, hurt_heavy, getup | Clear it in the cut and confirm with a test that no magenta survives. |
| MINOR | The fin tip is plain armour blue; the brief puts the amber accent on the fin tip too. | `docs/art/hero-brief.md:29`, `assets/sprites/source/player/hero_turnaround_v1_2026-09-24_c2.png` | Add a 1 to 2px amber tip on the next regeneration. |
| MINOR | The in-game slash capture overlaps the parked enemy block, so the full arc cannot be judged clean. | `output/art-review/hero-motion.png` panel 4 | Capture one slash with nothing behind it. |

Silhouette reads at 1x (fin, visor slit, backpack with antenna, squared buster wider than the off arm); palette matches the brief; clears the must-not-resemble list. All 45 groups present with the promised counts, one baseline, stable scale; nothing needs a full regeneration.

| Rubric | Score |
| --- | --- |
| Silhouette reads at 1x | 4 |
| Palette and style sheet match | 4 |
| Animation families complete and feet on the body | 5 |
| Provenance recorded (prompt, job id, licence) | 5 |

Verdict: FIX (clear the joint pixels on shoot_ground, hurt_heavy and getup; everything else holds)
