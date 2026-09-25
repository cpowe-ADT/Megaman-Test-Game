# Audio Credits

Every `.ogg` and `.wav` under `assets/audio` is listed here with its source, author and licence: `npm run audio:check` (`scripts/audio/check-credits.mjs`) and `tests/audio-cue-map.test.ts` fail on a file missing from this page or a path on this page missing from disk. Runtime music is normalized to one loudness target (ffmpeg loudnorm: -16 LUFS integrated, within 1 LU, true peak at most -1 dBTP) and every loop seam is measured (RMS of the last 250ms against the first 250ms, at most 3dB); the latest numbers are in `output/audio/check-credits.md`.

## Music: CC0 tracks (the shared cues)

- `assets/audio/music/stage_select.ogg`
  - Track: `8bit Action Stage Select`
  - Author: `MintoDog`
  - License: `CC0`
  - Source: <https://opengameart.org/content/8bit-action-stage-select>
  - Edit (12h): summed to mono, normalized to -16 LUFS, Ogg Vorbis q2 at 44.1kHz by `scripts/audio/master-music.mjs` from `assets/audio/music/source/stage_select.ogg`; length unchanged.
  - Runtime usage: cues `title`, `stage_select`, `completion` (Title, Stage Select, Prologue, Game Over, Ending)

- `assets/audio/music/stage_loop.ogg`
  - Track: `On the Offensive (CC0 Chiptune)`
  - Author: `bart`
  - License: `CC0`
  - Source: <https://opengameart.org/content/offensive-cc0-chiptune>
  - Edit (12h): summed to mono, normalized to -16 LUFS, Ogg Vorbis q0 at 32kHz by `scripts/audio/master-music.mjs` from `assets/audio/music/source/stage_loop.ogg`; length unchanged. Its seam (9.1dB, a decaying tail before the downbeat) is the one waiver in `scripts/audio/check-credits.mjs`.
  - Runtime usage: cue `stage` when no stage id is passed (every stage has its own loop below)

- `assets/audio/music/boss_loop.ogg`
  - Track: `Chiptune Battle Music`
  - Author: `Juhani Junkala`
  - License: `CC0`
  - Source: <https://opengameart.org/content/chiptune-battle-music>
  - Edit (12h): summed to mono, normalized to -16 LUFS with a soft knee from -8dBFS (the original peaks above 0dBTP), Ogg Vorbis q0 at 22.05kHz by `scripts/audio/master-music.mjs` from `assets/audio/music/source/boss_loop.ogg`; length unchanged.
  - Runtime usage: cues `boss` and `final` when no boss or stage id is passed

Originals, never shipped (the build skips `source` folders), kept so the masters can be rebuilt:

- `assets/audio/music/source/stage_select.ogg`, `assets/audio/music/source/stage_loop.ogg`, `assets/audio/music/source/boss_loop.ogg`: the three CC0 downloads above as first committed (34bde56), stereo 44.1kHz.
- `assets/audio/music/source/title_menu.ogg`: 11.1s stereo, never referenced by the game. Provenance unrecorded: it arrived in 34bde56 ("stabilize megaman runtime and asset pipeline") with no track, author or licence, and neither history nor this page ever named its source. Moved out of the build in 12h; it stays unused until it is credited or deleted.

## Music: generated (original work)

- Generated set: `Stage and boss loops (procedural chiptune)`
  - Author: `generated in this repository by scripts/audio/compose.mjs`
  - License: `Original work (original-generated)`
  - Generator: `scripts/audio/compose.mjs` synthesizes every note (two band-limited pulse waves, a stepped triangle bass, an LFSR noise kit); no samples, no AI model, no download. Each mood (key, mode, tempo, progressions, styles) and seed is in `STAGE_MOODS` and `BOSS_MOODS`; the seed writes the melody, so re-running rebuilds the same files. Measured loudness, true peak, seam and size per file: `assets/audio/music/generated/music-manifest.json`.
  - Runtime usage: `src/audio/musicLibrary.ts` (`STAGE_MUSIC`, `BOSS_MUSIC`); a boss's phase-two track is the same song with a driving layer, crossfaded in by `AudioService.setMusicPhase(2)`

| File | Plays for | Seed | BPM | Mood |
| --- | --- | ---: | ---: | --- |
| `assets/audio/music/generated/stage_tutorial_sentinel.ogg` | stage `tutorial_sentinel` | 1201 | 138 | drill hangar, bright and upbeat |
| `assets/audio/music/generated/stage_pyro_maw.ogg` | stage `pyro_maw` | 1202 | 152 | smelter, driving phrygian heat |
| `assets/audio/music/generated/stage_tide_reaver.ogg` | stage `tide_reaver` | 1203 | 126 | reservoir, flowing dorian arpeggios |
| `assets/audio/music/generated/stage_volt_hopper.ogg` | stage `volt_hopper` | 1204 | 168 | capacitor rooftops, fast and electric |
| `assets/audio/music/generated/stage_basalt_titan.ogg` | stage `basalt_titan` | 1205 | 116 | quarry, heavy half-time |
| `assets/audio/music/generated/stage_ferro_blade.ogg` | stage `ferro_blade` | 1206 | 150 | foundry, harmonic-minor duel |
| `assets/audio/music/generated/stage_mire_wraith.ogg` | stage `mire_wraith` | 1207 | 108 | biohazard lab, uneasy and slow |
| `assets/audio/music/generated/stage_gale_vixen.ogg` | stage `gale_vixen` | 1208 | 160 | skybridge, airy lydian lift |
| `assets/audio/music/generated/stage_glacier_ronin.ogg` | stage `glacier_ronin` | 1209 | 122 | frozen archive, sparse and cold |
| `assets/audio/music/generated/stage_omega_fortress.ogg` | stage `omega_fortress` | 1210 | 144 | central core, final march |
| `assets/audio/music/generated/boss_sentinel_rook.ogg` | boss `sentinel_rook` | 1301 | 150 | gatekeeper duel |
| `assets/audio/music/generated/boss_sentinel_rook_phase2.ogg` | boss `sentinel_rook`, phase two | 1301 | 150 | the same song, driving layer |
| `assets/audio/music/generated/boss_pyro_maw.ogg` | boss `pyro_maw` | 1302 | 164 | infernal engine |
| `assets/audio/music/generated/boss_pyro_maw_phase2.ogg` | boss `pyro_maw`, phase two | 1302 | 164 | the same song, driving layer |
| `assets/audio/music/generated/boss_tide_reaver.ogg` | boss `tide_reaver` | 1303 | 156 | abyssal hunter |
| `assets/audio/music/generated/boss_tide_reaver_phase2.ogg` | boss `tide_reaver`, phase two | 1303 | 156 | the same song, driving layer |
| `assets/audio/music/generated/boss_volt_hopper.ogg` | boss `volt_hopper` | 1304 | 176 | kinetic capacitor |
| `assets/audio/music/generated/boss_volt_hopper_phase2.ogg` | boss `volt_hopper`, phase two | 1304 | 176 | the same song, driving layer |
| `assets/audio/music/generated/boss_basalt_titan.ogg` | boss `basalt_titan` | 1305 | 140 | seismic warden |
| `assets/audio/music/generated/boss_basalt_titan_phase2.ogg` | boss `basalt_titan`, phase two | 1305 | 140 | the same song, driving layer |
| `assets/audio/music/generated/boss_ferro_blade.ogg` | boss `ferro_blade` | 1306 | 168 | vector duelist |
| `assets/audio/music/generated/boss_ferro_blade_phase2.ogg` | boss `ferro_blade`, phase two | 1306 | 168 | the same song, driving layer |
| `assets/audio/music/generated/boss_mire_wraith.ogg` | boss `mire_wraith` | 1307 | 146 | nebulous corruptor |
| `assets/audio/music/generated/boss_mire_wraith_phase2.ogg` | boss `mire_wraith`, phase two | 1307 | 146 | the same song, driving layer |
| `assets/audio/music/generated/boss_gale_vixen.ogg` | boss `gale_vixen` | 1308 | 172 | sonic saboteur |
| `assets/audio/music/generated/boss_gale_vixen_phase2.ogg` | boss `gale_vixen`, phase two | 1308 | 172 | the same song, driving layer |
| `assets/audio/music/generated/boss_glacier_ronin.ogg` | boss `glacier_ronin` | 1309 | 152 | cryo swordmaster |
| `assets/audio/music/generated/boss_glacier_ronin_phase2.ogg` | boss `glacier_ronin`, phase two | 1309 | 152 | the same song, driving layer |
| `assets/audio/music/generated/boss_omega_core.ogg` | boss `omega_core` | 1310 | 160 | central directive |
| `assets/audio/music/generated/boss_omega_core_phase2.ogg` | boss `omega_core`, phase two | 1310 | 160 | the same song, driving layer |

## SFX: CC0 packs

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

## SFX: generated (original work)

- Generated set: `Procedural sound effects (sfxr-style)`
  - Author: `generated in this repository by scripts/audio/sfx-synth.mjs`
  - License: `Original work (original-generated)`
  - Generator: `scripts/audio/sfx-synth.mjs` renders each sound from its parameter set and seed in `assets/audio/sfx/generated/sfx-params.json` (voices, slides, envelopes, filters; the seed drives the noise). No samples, no AI model, no download; `node scripts/audio/sfx-synth.mjs [names]` rebuilds the same files.

| File | Key | Seed |
| --- | --- | ---: |
| `assets/audio/sfx/jump.wav` | `jump` | 12001 |
| `assets/audio/sfx/land.wav` | `land` | 12002 |
| `assets/audio/sfx/dash.wav` | `dash` | 12003 |
| `assets/audio/sfx/sword_swing.wav` | `sword_swing` | 12004 |
| `assets/audio/sfx/sword_hit.wav` | `sword_hit` | 12005 |
| `assets/audio/sfx/charge_start.wav` | `charge_start` | 12006 |
| `assets/audio/sfx/charge_loop.wav` | `charge_loop` | 12007 |
| `assets/audio/sfx/generated/player_death.ogg` | `player_death` | 12008 |
| `assets/audio/sfx/generated/saber_combo_1.ogg` | `saber_combo_1` | 12101 |
| `assets/audio/sfx/generated/saber_combo_2.ogg` | `saber_combo_2` | 12102 |
| `assets/audio/sfx/generated/saber_combo_3.ogg` | `saber_combo_3` | 12103 |
| `assets/audio/sfx/generated/saber_air_spin.ogg` | `saber_air_spin` | 12104 |
| `assets/audio/sfx/generated/saber_reflect.ogg` | `saber_reflect` | 12105 |
| `assets/audio/sfx/generated/vent_arm.ogg` | `vent_arm` | 12201 |
| `assets/audio/sfx/generated/vent_fire.ogg` | `vent_fire` | 12202 |
| `assets/audio/sfx/generated/slag_rise.ogg` | `slag_rise` | 12203 |
| `assets/audio/sfx/generated/wall_crack.ogg` | `wall_crack` | 12204 |
| `assets/audio/sfx/generated/wall_break.ogg` | `wall_break` | 12205 |
| `assets/audio/sfx/generated/crumble_shake.ogg` | `crumble_shake` | 12206 |
| `assets/audio/sfx/generated/crumble_fall.ogg` | `crumble_fall` | 12207 |
| `assets/audio/sfx/generated/gate_open.ogg` | `gate_open` | 12208 |
| `assets/audio/sfx/generated/gate_close.ogg` | `gate_close` | 12209 |
| `assets/audio/sfx/generated/rail_arc.ogg` | `rail_arc` | 12210 |
| `assets/audio/sfx/generated/rockfall.ogg` | `rockfall` | 12211 |
| `assets/audio/sfx/generated/icicle_shatter.ogg` | `icicle_shatter` | 12212 |
| `assets/audio/sfx/generated/wind_gust.ogg` | `wind_gust` | 12213 |
| `assets/audio/sfx/generated/miniboss_stomp.ogg` | `miniboss_stomp` | 12301 |
| `assets/audio/sfx/generated/miniboss_shockwave.ogg` | `miniboss_shockwave` | 12302 |
| `assets/audio/sfx/generated/boss_hit_weak.ogg` | `boss_hit_weak` | 12303 |
| `assets/audio/sfx/generated/boss_warning.ogg` | `boss_warning` | 12304 |

The seven player `.wav` files (`jump` to `charge_loop`) keep their paths and format (22.05kHz 16-bit mono) but were re-rendered in 12h. The originals arrived in 34bde56 with no source, author or licence, and no generator survives; their pitch contours resemble the synthesized fallback tones in `src/audio/PlaceholderAudioService.ts` but do not match them. Because they could not be credited, the seeded renders replaced them.

Notes:

- SFX are loaded in `src/scenes/Preload.ts`. Music is fetched and decoded when its cue is first asked for and evicted when nothing plays it (`src/audio/MusicTrackLoader.ts`, `src/audio/musicResidency.ts`); a boss track decodes together with its phase-two track.
- `AudioService` plays these files and falls back to synthesized Web Audio tones only if an SFX file is unavailable at runtime. An SFX key with no entry in `src/audio/sfxLibrary.ts` throws in development builds.
