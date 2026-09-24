# Relay biome background v1 (Drill Hangar parallax), Higgsfield gpt_image_2, 2026-09-24 (phase 6.P, EVAL-P6-018)

Through the Higgsfield MCP (`generate_image_batch`), 21:9, 1k, quality medium, no reference image. Licence `original-generated`.

| Layer | Job | Result URL | Prompt (abridged; the palette and negatives as in the tileset prompt) |
| --- | --- | --- | --- |
| far (`relay_far_v1.png`) | a884f17e-5962-46fd-bca0-1522fe2200ae | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_211310_a884f17e-5962-46fd-bca0-1522fe2200ae.png | the FAR layer: the far wall of an enormous hangar with a distant skyline of drill towers, cranes and radio relay masts as dark silhouettes, horizontal bands, calm and low contrast, tiles seamlessly left to right |
| mid (`relay_mid_v1.png`) | 2b778587-50bc-441c-b897-495af9a36033 | https://d8j0ntlcm91z4.cloudfront.net/user_3DdtwRjBCpZegkKGFJcMMF2wN8Z/hf_20260924_211310_2b778587-50bc-441c-b897-495af9a36033.png | the MIDDLE layer: giant drill rigs, scaffolding towers, hanging chains, pipes and gantry supports standing on the bottom edge, flat magenta above and between them, darker than gameplay, tiles seamlessly |

Cut: `cut_background_layer.py --factor 3` (far, period 588px -> 196x192) and `--factor 4 --key` (mid, period 640px -> 160x144). In game both are tinted down (`src/content/stageBackgroundCatalog.ts`, tutorial_sentinel) so the hero reads in front.
