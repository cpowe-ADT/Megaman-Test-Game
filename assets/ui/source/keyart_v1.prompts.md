# Key art v1: the logo and the story panels (part 12i, EVAL-P8-003, 2026-09-30), Higgsfield gpt_image_2

Higgsfield MCP `generate_image_batch`, model `gpt_image_2`, 16:9, 1k, quality medium, paid from credits. Licence `original-generated` (Craig's own outputs, D-017). Author: original art generated with Higgsfield for this project. Eleven generations of the 24 allowed; 2718 credits before the run.

Result URLs: `https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260930_<time>_<job>.png` (time per row). Cut: `.venv/bin/python scripts/sprites/cut_keyart_v1.py` (the logo keyed, box-downsampled to 320px and snapped to the relay palette; the panels box-downsampled to 448x252, saturation 1.2, 48-colour octree, no dither).

## Logo (magenta background)

Prompt (both variants): "A 16-bit pixel art video game title logo, SNES era, reading exactly OMEGA RELAY in one line of bold, blocky, squared capital letters, every letter clearly legible and correctly spelled. The letters are steel-navy metal: #304A6D face, #5C7FA8 light on the top edges, #1C2E47 shadow on the lower edges, a crisp 2-pixel amber (#F2A93B) inner highlight along the top of each letter, and a thick dark outline #141A26. A thin red (#E23A3A) relay beam line runs under the words and ends in a small ring emblem. Straight upright letters, no italic slant, original design, not the Mega Man logo. The logo is centered on a flat solid magenta background (#FF00FF) that fills the entire image, with wide empty magenta margins on every side. No other text, no subtitle, no gradients, no blur, no glow, no drop shadow, no border, no watermark."

| File | Job | Time | Use |
| --- | --- | --- | --- |
| logo_v1_a.png | 2f1e144f-db6c-45bc-9ceb-8026bcf3b17d | 164311 | not used |
| logo_v1_b.png | 926d66ef-4f69-42fb-be28-f4ac570359fd | 164311 | picked: bolder strokes and ring at 1x; `assets/ui/logo/omega_relay_logo.png` (320x64) |

## Story panels

Shared prefix: "16-bit pixel art cutscene still for an original SNES-era action platformer: crisp hard-edged pixels, limited palette, flat three-tone shading, dark near-black outlines (#141A26), light from the upper left, no anti-aliasing. Palette: {palette}. Keep the lower third calm and dark (caption text sits there). Scene: {scene}. No text, no letters, no numbers, no UI, no gradients, no blur, no glow effects, no photorealism, no border, no watermark." The night panels use the relay palette (sky #0E1622, navy #304A6D and #1C2E47, steel #5C7FA8, amber #F2A93B, red #E23A3A, violet #4B3868); the dawn panels swap in dawn amber and pale sky blue #8FB8DD; the archive uses the Archives frost row (#4E79A6, #8FB8DD, #DDF4FF). The two panels with WREN pass the C2 turnaround (job 986ea4a5-dcfd-4cc8-b1f9-7bc5d22e949c) as the reference image.

| Panel (runtime `assets/ui/story/`) | Scene (abridged) | Job | Time |
| --- | --- | --- | --- |
| prologue_city | aerial night view of one city in eight coloured districts, a warden tower in each, amber relay lines to a violet central spire with a calm ring | 939219fc-dad5-408c-8e91-bd500ace72ad | 164310 |
| prologue_override | the same city in the minute everything failed: fires, flood, blackout, a leaning crane, a stalled train; red override rings over the towers, red beams from the spire; "no people, no figures" | 6d5113eb-ed6c-4bc6-b233-575ee5b51474 (v2) | 164540 |
| prologue_hangar | the hero from the reference alone in a vast dim training hangar facing a square training sentry with one visor slit; drill targets, hazard stripes, rain on the skylights | e9882d79-62cd-4ae2-b3b8-cd4c1423a849 | 164311 |
| prologue_vale | an operations room at night; a composed woman in her fifties, short silver hair, navy coat, amber collar pin, headset, seen from behind at a console; red network maps, one green signal | 1c20dc24-d595-4329-b67f-178e6495aec9 | 164310 |
| epilogue_dawn | the city at dawn from a hill: open windows, a calm reservoir, every warden tower lit steady, the spire dark | b5941afb-c6e4-4fc8-bb3e-b405327c7b07 | 164311 |
| epilogue_streets | street level in the morning: an elevated train on a violet line, a clinic with its doors open, people walking, a storm pushed out to sea | 113ae833-4a4c-47bb-8916-17e6905bf1e6 | 164311 |
| epilogue_archive | a public archive hall with frost-blue shelves of record cards, citizens reading; the same woman places a thick file in an open public case | 2571f04b-4f25-47c5-9b64-8a5b54b834c6 | 164311 |
| epilogue_choice | sunrise from a rooftop: the hero from the reference at the roof edge looking at the dark spire with its unlit ring; calm amber relay lines | 6b49febb-7637-4ed3-b3ea-40b4b2f01a94 | 164311 |

Rejected: `story_prologue_override_v1.png` (job 6e5def1e-0066-4577-92a4-0e87126be759, 164311) drew a caped figure in the foreground, a character the story does not have; v2 asked for no figures.
