# 08. Audio, Presentation, and Release

Active seats: Orchestrator, Audio Director, Principal Game Engineer, Game Director (beats), Art Director (logo, screens), Release Engineer, QA / Eval Lead.

Three sessions: `08a` (8.1 and 8.2), `08b` (8.3 and 8.4), `08c` (8.5 to 8.7).

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 08a | 8.1 Music and SFX | Audio | every screen has its music; combat sounds like combat | P8-001, P8-002 | listen |
| 08a | 8.2 Pixel font, logo, Title and Stage Select art | Art | the front of the game | P8-003 | approve four screens |
| 08b | 8.3 The beats | Director | READY, WARNING, weapon-get, results, low-HP, beam-in, record | P8-004 | approve timing |
| 08b | 8.4 Gamepad, remap, options, fullscreen, touch | Engineer | plays on a pad | P8-005 | touch: finish or hide |
| 08c | 8.5 Public build and deploy | Release | a URL | P8-006, P8-007 | proceed |
| 08c | 8.6 Full-campaign automation and the human playthrough | QA | none | P8-008, P8-009 | play the whole game |
| 08c | 8.7 Release | Release | v1.0.0 | P8-010 | tag |

## Entry conditions

- Charter and amendments. `docs/prompts/handoff/07-bosses-weapons-and-story.md` is `COMPLETE`; every `EVAL-P7-*` row `PASS`.
- Read: the 05, 06 and 07 handoffs, `docs/prompts/04-presentation-audio-release.md` in full (its cue map, sourcing rules, beats list, gamepad and options spec, public build, full-campaign automation and release checklist are reused verbatim below unless amended), `src/audio/` in full, `assets/audio/credits/README.md`, `src/scenes/Title.ts`, `src/scenes/StageSelect.ts`, `src/ui/menu/menuTheme.ts`, `src/ui/HUD.ts`, `src/ui/VictoryModal.ts`, `src/scenes/game/StageIntroSequence.ts`, `src/ui/StageIntroPresenter.ts`, `src/config/hdRender.ts` (text is HD; a bitmap font is a sprite and scales like one).
- Ground truth (2026-09-22 audit): three CC0 tracks serve six cues (`title`, `stage_select`, `completion` share one file; `boss` and `final` share one; every stage shares `stage_loop`); `title_menu.ogg` is unreferenced and uncredited; loop seams measure 4.4 to 18.8dB RMS delta; loudness spread 5.8 LUFS; cue changes are hard cuts; seven `.wav` player sounds are uncredited; `charge_loop` is a 60ms blip; every weapon uses the same shot sound; sword hits on bosses play two sounds; enemy death reuses `enemy_hit`; dialogue, checkpoint, death, gate, wall kick have no sound; `PlaceholderAudioService.normalizeKey` maps unknown keys to silence without error. Presentation: system fonts everywhere, `HUD.ts` checks for a bitmap font `'font'` that `Preload` never loads; Title is a settings dialog; Stage Select is nine rectangles; `StageIntroSequence` READY "completes immediately"; `VictoryModal` is a web dialog; `reducedFlashing` has no consumer; `SaveData.stats` exist for the record card.

## Outcome of this prompt

The game sounds like a game and stages every beat a player expects. It plays on a pad, in fullscreen. A public build with no private assets deploys to a URL. One automated scenario plays the entire campaign. Craig plays it through. v1.0.0 is tagged.

## Phase 8.1: Music and SFX

Implement prompt 04 "Phase 4.1" verbatim, amended:

- Per-stage cues resolve from `stage.id`; `PrologueScene`, `GameOverScene` and `EndingScene` stop playing the stage-select track. Music may be AI-generated (record tool, prompt and mark `original-generated`) or CC0 packs by one author; either way one `ffmpeg loudnorm` target and a loop-seam check under 3dB for every track, recorded in the ledger row.
- Adaptive boss music (added on review): the boss track has a phase-two layer (a second stem mixed in at the phase change, or a second track crossfaded); desperation adds a pulse. Recorded as two files per boss cue.
- Crossfade 600ms on every cue change; duck 6dB under dialogue, pause and the victory card. Boss entry crossfades to `boss`.
- SFX: per-weapon shot and impact, charge loop that loops, enemy death, boss roar and phase change, boss death explosion, wall kick, player death, checkpoint chime, gate open, dialogue blip, menu open and close, low-HP beep, weapon-get jingle, boss-intro siren, stage-clear jingle, sub-tank drink, district restored, mini-boss activate, one ambient loop per biome. `normalizeKey` throws in dev on an unknown key. The duplicate sword-on-boss sound goes. The seven `.wav` files are credited or replaced.
- `tests/audio-cue-map.test.ts` and `scripts/audio/check-credits.mjs` as prompt 04 specifies.

Ledger: `EVAL-P8-001`, `EVAL-P8-002`.

```
### STOP 8.1: Listen
Show: the cue map, the loudness and loop table, the credits check output.
Ask Craig to listen to Title, a stage, a boss and the ending. Question: any track to replace? Recommended: replace what he names.
```

## Phase 8.2: Pixel font, logo, Title and Stage Select art

Art leads.

- One bitmap pixel font (CC0 or generated) loaded in `Preload`; `HUD.ts` already branches on it; `MENU_FONT_*` and every `'monospace'` style go. Text rendered through `Text` stays for dialogue where HD anti-aliased glyphs read better; decide per surface and record it in `docs/architecture/rendering.md`.
- Title: a drawn logo (Higgsfield, then cleaned), the hero on a parallax of the relay district, `PRESS START` blink, a 20s attract cycle of three stage backgrounds. Stage Select: boss portraits from 07 with a reveal slide, a cursor that moves, a stage preview strip, the district-restored tile flip with its sting. Game over, options, controls and ending screens restyled on the same theme.
- `reducedFlashing` wired to the charge ring, explosions and the low-HP pulse, exposed in Options.
- Loading screen (added on review): `Preload` draws a progress bar and the logo while atlases load; a first-visit note names the controls.
- Key art (added on review): eight prologue and epilogue panels and nine Stage Select district previews generated through Higgsfield as stills (16:9, 1k) in the style sheet's palette, quantized to the game's colour depth; `PrologueScene` and `EndingScene` show the panels behind the text; Stage Select shows the district preview for the selected warden.
- HUD (added on review): weapon icon from the 07 projectile sheets, sub-tank pips, lives, boss portrait beside the boss bar, low-HP pulse.

Ledger: `EVAL-P8-003` (four screens captured at 2x through `40-hd-render` style scenarios; `33-classic-stage-select` layout assertions green).

```
### STOP 8.2: Four screens
Show: Title, Stage Select, Options, Ending at 2x.
Question for Craig: approve the look? Recommended: approve.
```

## Phase 8.3: The beats

Implement prompt 04 "Phase 4.2" verbatim (READY, boss door and WARNING as staged in 07, weapon-get card replacing `VictoryModal`, capsule card, stage results, low-HP, game over, district restored, ending with the CAMPAIGN RECORD, attract). Smoke `45-beats-flow`.

Ledger: `EVAL-P8-004`.

## Phase 8.4: Gamepad, remap, options, fullscreen, touch

Implement prompt 04 "Phase 4.3" verbatim (pad map, remap screen, Options additions, colourblind hazard patterns, touch decision, smoke `46-gamepad-and-remap`). The `Pixel scaling` option is already integer through `hdRender`; expose a `Smooth` fallback for windows under 2x.

Ledger: `EVAL-P8-005`.

## Phase 8.5: Public build, bundle, deploy

Implement prompt 04 "Phase 4.4" verbatim. Since 05 deleted `assets/private/`, the public build check asserts no private path exists rather than stripping it; keep the identity regex check.

Ledger: `EVAL-P8-006`, `EVAL-P8-007`.

## Phase 8.6: Full-campaign automation and the human playthrough

Implement prompt 04 "Phase 4.5" verbatim (`SMOKE_LONG=1` scenario `47-full-campaign` twice, once skipping and once reading every line; the playtest checklist).

Ledger: `EVAL-P8-008`, `EVAL-P8-009`.

```
### STOP 8.6: Play the whole game
Ask Craig to play through on a pad and return the checklist. Recommended: fix everything reported, rerun the gates and 47.
```

## Phase 8.7: Release

Implement prompt 04 "Phase 4.6" verbatim (version, CHANGES, README, AGENTS, ARCHITECTURE, TESTING, docs archive, progress entry, tag on Craig's word).

Store kit (added on review): `output/release/store-kit/`: six 2x screenshots chosen from the sweep (title, Stage Select, two stages, a boss WARNING, the ending record), a 30-second gameplay capture recorded through the input-replay harness, page copy (title, one paragraph, controls, credits line), and a `CONTENT.md` that states which assets were generated with Higgsfield and which are CC0, matching the credits file. README carries the same disclosure.

v1.1 backlog to hand off (not v1.0): character select (`docs/working/zero-character-select-backlog.md`), boss rush and time attack from the per-stage bests, New Game+ with the weakness ring rotated, controller rumble, a string table for localisation (UI strings are hard-coded today), an attract-mode demo from a replay script.

Ledger: `EVAL-P8-010`.

## Exit Gate

- `EVAL-P8-001` to `EVAL-P8-009` `PASS`; `EVAL-P8-010` may be `PENDING` until the tag.
- `npm run verify`, `npm run verify:public`, `npm run test:visual-sweep`, `npm run content:audit`, `npm run content:lint`, and `SMOKE_LONG=1 SMOKE_ONLY=47-full-campaign npm run test:smoke` result lines with artifact paths, all on the release commit.
- The charter's section 10 Definition of Final checked item by item with evidence paths.
- `wc -l src/scenes/Game.ts` at or below 3,000 and `grep -rl "@ts-nocheck" src` prints only `src/scenes/Game.ts` (or nothing).
- Handoff with `Inputs for v1.1`.

```
### STOP 8.EXIT: Ship
Question for Craig: tag v1.0.0? Recommended: yes.
```
