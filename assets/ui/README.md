# UI art: sources, licences and loading

Every file here is original art generated with Higgsfield (`gpt_image_2`) for this project, licence `original-generated` (Craig's own outputs, D-017). Sources live in `assets/ui/source/` and do not ship (the build excludes `assets/**/source`). The credits the Ending scrolls come from `assets/sprites/source/free-source-attribution.v1.json` through `npm run credits:build`.

| Runtime path | What | Source (model, prompt, job) | Cut | Loads / evicted |
| --- | --- | --- | --- | --- |
| `logo/omega_relay_logo.png` | the OMEGA RELAY logo, 320x64, keyed, relay palette | `source/logo_v1_b.png`, job 926d66ef-4f69-42fb-be28-f4ac570359fd; prompt in `source/keyart_v1.prompts.md` | `scripts/sprites/cut_keyart_v1.py` | `Preload` (the loading screen draws it first); resident, the Title draws it next |
| `story/prologue_*.png` (4) | the prologue panels, 448x252, 48 colours | `source/story_prologue_*.png`; jobs and prompts in `source/keyart_v1.prompts.md` | `scripts/sprites/cut_keyart_v1.py` | `PrologueScene.preload`; removed at its shutdown |
| `story/epilogue_*.png` (4) | the epilogue panels, 448x252, 48 colours | `source/story_epilogue_*.png`; jobs and prompts in `source/keyart_v1.prompts.md` | `scripts/sprites/cut_keyart_v1.py` | `EndingScene.preload`; removed at its shutdown |
| `portraits/portraits.{png,atlas.json}` | twelve 48x48 speaker portraits | `source/portraits_v1_a.png`, job 64e0b7f1-e277-4092-aadc-36326cccf4d5 (`source/ui_v1.prompts.md`) | `scripts/sprites/cut_portraits.py` | first use (dialogue, Stage Select, the HUD boss badge); kept once loaded |
| `hud_icons/hud_icons_v1/` | sixteen 16x16 HUD icons | `source/hud_icons_v1_a.png`, job eac05d70-2690-49b1-86dc-65f6f91b9070 (`source/ui_v1.prompts.md`) | `scripts/sprites/cut_vfx_sheet.py` | the Game scene's atlases |

Retired: `title/title_keyart.png` (jobs 09c0b6d9 and 21ef8c52, `source/ui_v1.prompts.md`) left the runtime in part 12i. The Title now draws the logo over the hero on the relay district's own parallax; the key art's sources stay in `source/title_keyart_v1_*.png` for a store page or press kit.

Screens that compose existing art instead of new generations: the Title's attract cycle and Stage Select's district preview both draw the stages' own parallax layers (`assets/backgrounds/`, provenance in `assets/backgrounds/README.md`).
