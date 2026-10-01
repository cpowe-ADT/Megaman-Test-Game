# Hero brief: WREN, Recovery Unit 09

Status: prompt 05 §5.4. Reads with `style-sheet.md`. Names from `src/content/identity.ts` (`HERO_CALLSIGN` WREN, `HERO_UNIT` RECOVERY UNIT 09).

## The one word

**Recovery.** Not war. WREN puts things back where they belong and leaves. Everything on the body is a tool for reaching, lifting, tethering and signalling; nothing is a trophy or a threat display. It says less than it knows, so the design is quiet: small head, no teeth, no spikes, one light.

## Silhouette (must read at 48px, in black)

Three features, each at least 8px in the game cell:

1. **A crest or fin on the helmet.** One swept-back blade or a narrow front-to-back crest. It breaks the round-helmet outline and gives the run animation a lean to sell speed.
2. **The buster arm.** The right forearm is a squared recovery tool: a socket-shaped muzzle with a flat face, wider than the left forearm by a third. It reads as equipment, not a gun barrel.
3. **A scarf or cable.** A short signal cable from the back of the helmet, or a scarf of pale signal cloth. It trails on dashes and wall slides, so the motion reads even when the body is still.

The three together make a shape no boss owns: a lean vertical with one diagonal (the fin), one block (the arm) and one line (the cable).

## Palette (three tones plus outline)

| Part | Base | Shadow | Light |
| --- | --- | --- | --- |
| Armor (relay identity) | `#3F6FA6` | `#274A78` | `#7FB0DE` |
| Undersuit at the joints | `#8A94A6` | `#555E6E` | `#C4CBD6` |
| Accent (warm): chest stripe, joint lights, fin tip | `#F2A93B` | `#B8741C` | `#FFD27A` |
| Face plate or visor | `#E8F0F8` visor slit on `#1F2B3D` | | |
| Outline | `#141A26` | | |

The accent covers the chest stripe, one lamp per joint and the fin tip; nowhere else. Charge tiers add the accent as a flat second tone around the buster, never a glow.

## Must not resemble

No Mega Man, X or Zero silhouette: no round helmet gem on the forehead, no large round shoulder pads, no cyan-and-white bodysuit, no long blonde hair, no red armor with a beam saber hilt on the back. No visible face below the visor. No cape.

## Poses the sheet needs later (5.5)

idle, run (6), dash, jump, fall, wall slide, wall kick, shoot standing, shoot running, shoot jumping, charge hold, saber (3), hurt, death burst. 48px cells, baseline 44, facing right.

## Turnaround candidates (5.4, STOP 5.4)

Three candidates, each a front, side and back view on magenta, in `assets/sprites/source/player/hero_turnaround_v1_2026-09-24_{a,b,c2}.png` (the first C was excluded by the Art Director review for its ear-fin and face-plate helmet) with prompts and job ids in the `.prompts.md` beside them. Contact sheet with a 48px silhouette row: `output/art-review/hero-turnarounds.png`. Recommendation rule: the one whose silhouette reads at 48px without the colour.
