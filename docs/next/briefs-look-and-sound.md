# Briefs: graphics, animation, audio and presentation

From the art-director seat's read-only deep dive on `main` a17b261 (2026-10-01), ranked by what a player notices first. Art comes from Higgsfield `gpt_image_2` through `docs/content/sprite-imagegen.md`; audio is procedural or CC0 only (Higgsfield audio is barred). Line numbers drift: grep the symbol.

### 1. Its own title, ending and game-over music
- Why: Title, Prologue, Game Over, Stage Select and Ending all play the one CC0 `stage_select.ogg` (`src/audio/musicLibrary.ts`), the first sound a player hears.
- Where: `musicLibrary.ts`, `scripts/audio/compose.mjs`, `assets/audio/music/generated/music-manifest.json`.
- Done when: a test asserts distinct keys for title, stage select and completion; the manifest lists the new tracks at -16 LUFS with loop seams under 2 dB.
- Size: M. Needs: procedural audio.

### 2. HUD and toast clutter
- Why: the boss portrait straddles the HUD frame's edge; a full-width opaque toast ("Checkpoint 2", "ACT 3 = THE CORE") covers about 15% of the playfield; the centre box shows an empty second line.
- Where: `src/ui/HUD.ts`, `src/ui/hudBossPortrait.ts`, `src/ui/hudLayout.ts`, `src/ui/ToastLane.ts`.
- Done when: a layout test puts the portrait inside the boss-bar frame; captures show a one-line toast pill clear of the playfield.
- Size: S. Needs: none.

### 3. Fill the window
- Why: 1280x720 captures show the game at 896x504 with about 30% black border (whole-number zoom, `docs/architecture/rendering.md`); the hero is about 25px tall. Read `src/ui/menu/displayOptions.ts` (the `pixelScaling` default) and decision D-010 first.
- Where: `src/config/hdRenderMath.ts`, `src/config/hdRender.ts`, `tests/hd-render.test.ts`.
- Done when: smoke `40-hd-render` asserts the canvas covers at least 95% of the shorter window axis by default, with the integer mode still offered.
- Size: M. Needs: Craig's look.

### 4. Finale and warden presence
- Why: the Omega Core is a 64px cell, minion-sized; Pyro Maw vanishes into its own fire; every boss shares one cell size and scale.
- Where: `assets/sprites/bosses/`, `scripts/sprites/hf_sheet_to_atlas.py`, `src/scenes/game/BossPresentation.ts`.
- Done when: a 96 to 128px re-cut with a rim light for the Omega Core and Pyro Maw shows each at least 1.5x taller in the same captures.
- Size: L. Needs: about 6 to 8 Higgsfield generations, Craig's look.

### 5. Backdrop seams and ambient layers
- Why: a hard seam shows in the Weather District's cloud band at the 448px repeat; the eight districts share one far and mid template; no stage has ambient motion (embers, snow, rain).
- Where: `src/content/stageBackgroundCatalog.ts`, `src/scenes/game/StageBackdrop.ts`, `assets/backgrounds/`.
- Done when: a test fails any far or mid layer whose edge columns differ past a threshold; an ambient particle layer shows in captures of at least three stages.
- Size: M. Needs: 0 to 4 Higgsfield regenerations.

### 6. Boss attack animation variety
- Why: boss atlases hold six 4-frame groups (idle, move, shoot, intro, defeat, phase), so every attack collapses onto a few poses (`src/bosses/BossController.ts`, `attackProfile.animation`); the 20 enemy atlases share one template, variants are recolours.
- Where: `BossController.ts`, `assets/sprites/source/bosses/`, `docs/content/sprite-imagegen.md`.
- Done when: the sweep's boss samples record at least four distinct animation keys per warden; a contact sheet shows a hurt frame per boss.
- Size: L. Needs: about 16 to 24 Higgsfield generations, Craig's look.

### 7. Longer stage music and ambience
- Why: each stage loop is about 31 s at 22.05 kHz while stages run for minutes; no stage has an ambient bed (lava, wind, water).
- Where: `scripts/audio/compose.mjs`, `src/audio/musicLibrary.ts`, `src/audio/PlaceholderAudioService.ts`.
- Done when: stage tracks run at least 60 s with an intro and bridge; per-stage beds duck under sound effects; the seam and loudness checks stay green.
- Size: M. Needs: procedural or CC0 audio, credited.

### 8. Sound-effect identity
- Why: no enemy-death or explosion key, every enemy shares `enemy_hit.ogg`, no per-boss attack stings, no footsteps or landings (`src/audio/sfxLibrary.ts`).
- Where: `sfxLibrary.ts`, `assets/audio/sfx/generated/sfx-params.json`, `src/enemy/EnemyEntity.ts`.
- Done when: a test requires every enemy kind and boss to map to a death or attack sound; the manifest lists the new files with seeds.
- Size: S to M. Needs: procedural audio.
