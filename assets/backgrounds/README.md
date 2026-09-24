# Background Sources

This folder contains stage background layers extracted from permissively licensed OpenGameArt packs.

## Sources

- `opengameart/industrial/*`
  - Source: https://opengameart.org/content/industrial-parallax-background
  - Title: `Industrial Parallax Background`
  - Author: `ansimuz`
  - License: `CC0`
  - Notes: extracted layered PNGs plus the original `license.txt`

- `opengameart/admurin_*/*`
  - Source: https://opengameart.org/content/parallax-backgrounds
  - Title: `Parallax Backgrounds`
  - Author: `Admurin`
  - License: `CC-BY 4.0`
  - Attribution notice from source: `https://admurin.itch.io/ - Admurin`
  - Notes: extracted PNG layers from the Cave, Dead Forest, Dock, Plains, and Snowy Mountains packs

- `relay/*` (the tutorial's Drill Hangar, phase 6.P, 2026-09-24)
  - Source: generated
  - Title: `Drill Hangar parallax`
  - Author: `Original art generated with Higgsfield (gpt_image_2) for this project`
  - License: `original-generated`
  - Notes: prompts, job ids and result URLs in `source/relay/relay_v1.prompts.md`; cut to one seamless period and a third (far) or a quarter (mid) of the source size by `scripts/sprites/cut_background_layer.py`

- `pyro/*` (Heat Works, finish plan, 2026-09-24)
  - Source: generated
  - Title: `Heat Works parallax`
  - Author: `Original art generated with Higgsfield (gpt_image_2) for this project`
  - License: `original-generated`
  - Notes: prompts and jobs in `source/pyro/pyro_v1.prompts.md`

## Usage

- Runtime loading is defined in `src/content/stageBackgroundCatalog.ts`.
- Stage-to-background mapping lives in `src/content/stageBackgroundCatalog.ts` and `src/content/campaign.ts`.
- Keep any new background imports documented here with source URL, author, and license.
