# Merged review: 2026-09-24-5.4-hero

Seats: art-director (FIX, mean 4.0)

| Severity | Seat | Finding | Evidence | Fix | Agreed |
| --- | --- | --- | --- | --- | --- |
| MAJOR | art-director | Candidate C pairs twin small fins over the ears with a white face-plate that reads as a rounded face rather than a slit; together this is the closest of the three to the classic Mega Man ear-finlet helmet + face silhouette, and it breaks the brief's "one fin, no visible face" spec. | `hero_turnaround_v1_2026-09-24_c.png` front/side cells; `docs/art/hero-brief.md:13` (one crest only), `docs/art/hero-brief.md:33` (no visible face below visor) | Drop C from the pool, or redraw with a single fin and shrink the plate to a thin visor band only |  |
| MINOR | art-director | All three outlines look flat black, not the specified cool near-black `#141A26`. | `hero_turnaround_v1_2026-09-24_a.png`, `_b.png`, `_c.png`; `docs/art/style-sheet.md:13` | Confirm or adjust hue in the quantize pass before the atlas cut |  |
| MINOR | art-director | Shading on all three shows soft blue-to-blue gradients across the torso and limbs rather than a flat base/shadow/light triad; the raw Higgsfield output has not been posterized yet. | Same three files; `docs/art/style-sheet.md:14` ("three tones... no gradients") | Verify `hf_sheet_to_atlas.py --quantize 32` flattens to 3 tones per material before 5.5; if not, add a posterize step |  |
| MINOR | art-director | Style sheet gives no pixel-grid or downscale rule for going from the 1024px Higgsfield canvas to the 48/64/32px game cells, so nothing guarantees feet land on the stated baseline or lines snap to whole pixels once shrunk. | `docs/art/style-sheet.md:5-9` (cell and baseline spec, no resize method) | Add one line: target px-per-cell downscale factor and nearest-neighbour snap before the 5.5 sheet is cut |  |

All reviews valid.
