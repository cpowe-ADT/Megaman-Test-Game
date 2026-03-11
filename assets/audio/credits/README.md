# Audio Credits

The game ships with CC0 music and CC0 authored retro SFX.

Used in runtime music:

- `assets/audio/music/stage_select.ogg`
  - Track: `8bit Action Stage Select`
  - Author: `MintoDog`
  - License: `CC0`
  - Source: <https://opengameart.org/content/8bit-action-stage-select>
  - Runtime usage: `Title`, `StageSelect`, `CompletionScene`

- `assets/audio/music/stage_loop.ogg`
  - Track: `On the Offensive (CC0 Chiptune)`
  - Author: `bart`
  - License: `CC0`
  - Source: <https://opengameart.org/content/offensive-cc0-chiptune>
  - Runtime usage: regular stage gameplay

- `assets/audio/music/boss_loop.ogg`
  - Track: `Chiptune Battle Music`
  - Author: `Juhani Junkala`
  - License: `CC0`
  - Source: <https://opengameart.org/content/chiptune-battle-music>
  - Runtime usage: boss encounters and final route gameplay

Used in runtime SFX:

- Source pack: `UI Audio`
  - Author: `Kenney`
  - License: `CC0`
  - Source: <https://kenney.nl/assets/ui-audio>
  - Runtime files:
    - `assets/audio/sfx/ui_move.ogg`
    - `assets/audio/sfx/pause_open.ogg`
    - `assets/audio/sfx/pause_resume.ogg`

- Source pack: `Digital Audio`
  - Author: `Kenney`
  - License: `CC0`
  - Source: <https://kenney.nl/assets/digital-audio>
  - Runtime files:
    - `assets/audio/sfx/ui_confirm.ogg`
    - `assets/audio/sfx/ui_cancel.ogg`
    - `assets/audio/sfx/pickup_health.ogg`
    - `assets/audio/sfx/pickup_ammo.ogg`
    - `assets/audio/sfx/pickup_bonus.ogg`
    - `assets/audio/sfx/shot_basic.ogg`
    - `assets/audio/sfx/shot_charge_lv1.ogg`
    - `assets/audio/sfx/shot_charge_lv2.ogg`
    - `assets/audio/sfx/shot_charge_lv3.ogg`
    - `assets/audio/sfx/shot_charge_lv4.ogg`
    - `assets/audio/sfx/boss_activate.ogg`
    - `assets/audio/sfx/stage_clear.ogg`
    - `assets/audio/sfx/game_over.ogg`

- Source pack: `Impact Sounds`
  - Author: `Kenney`
  - License: `CC0`
  - Source: <https://kenney.nl/assets/impact-sounds>
  - Runtime files:
    - `assets/audio/sfx/player_hit.ogg`
    - `assets/audio/sfx/enemy_hit.ogg`
    - `assets/audio/sfx/boss_hit.ogg`

Notes:

- Music and SFX are loaded in `src/scenes/Preload.ts`.
- `AudioService` now prefers authored audio files and only falls back to synthesized Web Audio tones if an SFX asset is unavailable at runtime.
