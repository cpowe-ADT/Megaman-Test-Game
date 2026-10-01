# Handoff 08: Audio, presentation and release

## Status: COMPLETE for content and gates except the live tag/URL (`EVAL-P8-010`, Craig's to trigger) and three review rows waiting on Craig's play. This file is a pointer: 08 has no lane of its own and was finished across prompt 12's parts 12h and 12i, and prompt 13's part 13h.

Prompt 08 (`docs/prompts/08-audio-presentation-and-release.md`) was never run as its own lane. Prompt 12's
audit folded its phases into part 12h (8.1 music and SFX) and part 12i (8.2 pixel font and key art, 8.3 the
beats, 8.4 gamepad/remap/touch/options, 8.5 the public build and deploy). Prompt 13 part 13h closed 8.6 (the
full-campaign smoke) and carries 8.7's release checklist: this documentation pass (`EVAL-P8-009`'s
playtest sheet, the README/ARCHITECTURE/TESTING/CHANGELOG updates and these handoffs). Detail and evidence
live in `docs/prompts/handoff/12-finish-the-game.md` and `docs/prompts/handoff/13-polish-from-playtest.md`.

## Branch and final commit

Branch `codex/05a-feel-hero-camera` @ `fc1eab1` (the tip this docs pass branched from).

## What changed (by area, with file paths)

- Audio (12h): `scripts/audio/compose.mjs` and `sfx-synth.mjs` (procedural, seeded), credits in
  `assets/audio/credits/README.md`, an unknown SFX key throws in development
  (`src/audio/PlaceholderAudioService.ts`).
- Presentation (12i): the bundled pixel font, logo and loading screen, Title attract, Stage Select district
  previews, eight story panels, Reduced Flashing; the beats (`src/ui/StageClearCards.ts`: READY, weapon-get,
  results, low HP, LIVES, campaign record).
- Gamepad, remap, touch, options (12i): `src/input/InputActions.ts`, the remap screen, `src/ui/
  GameplayTouchControls.ts` (D-020: weapon-cycle buttons beside pause, `Options > Touch Controls`).
- Release (12i): `npm run build:public`, `scripts/check-public-build.mjs`, `.github/workflows/deploy.yml`,
  `npm run package:itch` (`scripts/release/package-itch.mjs`).
- Full-campaign automation (13h.2): `scripts/smoke/full-campaign.mjs` (`47-full-campaign`, long tier only).
- Documentation (13h.4/13h.5, this pass): `README.md`, `ARCHITECTURE.md`, `TESTING.md` fixes,
  `CHANGELOG.md`'s Unreleased section, these handoffs, `docs/playtest/v1.0-checklist.md`.

## Decisions made (each with the reason and what it forecloses)

- D-020 (2026-09-25): finish touch controls (weapon buttons, pause menu by tap) rather than hide them behind
  a toggle; add the Options toggle anyway (Auto/On/Off).
- D-021 (2026-09-25): install `fontTools` into `.venv` to build one bundled pixel font, fixing Linux/Android
  font-metric smoke failures.

## Content inventory

See `docs/prompts/handoff/12-finish-the-game.md` and `13-polish-from-playtest.md` for audio-cue and screen
counts; this file does not duplicate them.

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

Ledger: `docs/prompts/archive/EVAL_LEDGER-pass-07-08-12.md` (PASS: P8-001, P8-002, P8-004, P8-005) and
`docs/prompts/EVAL_LEDGER.md` prompt 08 section (PASS: P8-006, P8-011; PENDING: P8-003, P8-007, P8-008,
P8-009, P8-010).

## Open risks and known debt

- `EVAL-P8-010` (the live URL after the tag) cannot pass before Craig tags a release; the deploy workflow
  itself is built and untriggered.
- `EVAL-P8-007`'s one flake (`58-glacier-route`) was fixed under `EVAL-P13-005`; `verify:public` needs a
  fresh run to flip that row.
- `EVAL-P8-003`'s four screens and `EVAL-P8-009`'s checklist wait on Craig's play.
- The v1.1 backlog (prompt 08 phase 8.7): character select, boss rush and time attack, New Game+, controller
  rumble, a localisation string table, an attract-mode demo from a replay script.

## Inputs for prompt 12 and 13 readers

- Read `docs/prompts/handoff/12-finish-the-game.md` and `13-polish-from-playtest.md` first; they carry the
  detail this pointer intentionally omits.
- The v1.1 backlog above is also repeated in `docs/prompts/handoff/13-polish-from-playtest.md`'s "Inputs for
  v1.1" section; keep both in sync if it changes.
