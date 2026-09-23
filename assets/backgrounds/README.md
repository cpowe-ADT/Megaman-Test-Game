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

## Usage

- Runtime loading is defined in `src/content/stageBackgroundCatalog.ts`.
- Stage-to-background mapping lives in `src/content/stageBackgroundCatalog.ts` and `src/content/campaign.ts`.
- Keep any new background imports documented here with source URL, author, and license.
