# Handoff 07: Bosses, weapons and story

## Status: COMPLETE for content and gates; the human-review half of several rows (Craig's play-approval, the narrative seat's script read) is still open. This file is a pointer: 07 has no lane of its own and was finished across prompt 12's part 12f and 12g, and prompt 13's parts 13c, 13d and 13g.

Prompt 07 (`docs/prompts/07-bosses-weapons-and-story.md`) was never run as its own lane. Prompt 12's audit
folded its phases into part 12f (7.0 extraction, 7.1 telegraphs, 7.2 phase kits, 7.3 weapon identities and
boss intro/death, 7.10 boss bodies) and part 12g (7.6 the story pass and its five new triggers). Prompt 13
then extended that work: 13c tunes Sentinel Rook, the first fight; 13d gives every weapon a charged form;
13g adds the pre-stage boss-intro card, the weapon demo and the district return debrief. Detail and
evidence live in `docs/prompts/handoff/12-finish-the-game.md` and
`docs/prompts/handoff/13-polish-from-playtest.md`.

## Branch and final commit

Branch `codex/05a-feel-hero-camera` @ `fc1eab1` (the tip this docs pass branched from).

## What changed (by area, with file paths)

- Boss fights (12f): `BossBeats`, `BossDamageRouter`, `HitWires`, `WeaponRuntime`, `BossTelegraphs` out of
  `Game.ts` (under `src/scenes/game/`); thirteen hazard spawners; phase kits and the weakness stagger in
  `src/bosses/roster.ts`; eight weapon identities in `src/content/weapons.ts`.
- Story (12g): the text pass, five new dialogue triggers, `src/scenes/game/StoryDirector.ts`, portraits and
  the typewriter (`src/ui/dialogueTypewriter.ts`).
- Rook tuned to a fair first fight (13c): `tests/boss-roster.test.ts`.
- Charged weapons (13d): `SPECIAL_WEAPON_CHARGED_FORMS` in `src/content/weapons.ts` (one charged form per
  warden weapon, double cost, triple boss damage), the 28-unit energy bar, `src/ui/beats/weaponDemo.ts`.
- The beats Craig asked for (13g): `src/scenes/bossIntro/BossIntroLogic.ts` and `src/scenes/BossIntroScene.ts`
  (the pre-stage card); the weapon demo wired after the WEAPON GET card; eight district return debriefs in
  `docs/story/script.md` and `dialogue.v2.json`.

## Decisions made (each with the reason and what it forecloses)

- D-022 (2026-09-25): kept OMEGA's milestone-4 line "I taught it to hold" over the narrative seat's
  suggested rewrite; each warden's verb stays its own signature.
- 13d (delegated default): every weapon charges as its own move, not a bigger copy, costing double and
  dealing triple on bosses; Flame Serpent's charge is a release after its held stream.

## Content inventory

See `docs/prompts/handoff/12-finish-the-game.md` and `13-polish-from-playtest.md` for boss/weapon/dialogue
counts; this file does not duplicate them.

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

Ledger: `docs/prompts/archive/EVAL_LEDGER-pass-07-08-12.md` (PASS: P7-001, P7-002, P7-004, P7-008, P7-010)
and `docs/prompts/EVAL_LEDGER.md` prompt 07 section (PASS: P7-006; PENDING: P7-003, P7-005, P7-007, P7-009,
each noted "left: Craig plays/reads").

## Open risks and known debt

- The narrative seat's one MAJOR (the "hold"/"wait" line) went to Craig at D-022 and was kept; no other
  open narrative findings.
- `EVAL-P7-007`'s script read and `EVAL-P7-009`'s review are Craig's, not engineering work.

## Inputs for prompt 12 and 13 readers

- Read `docs/prompts/handoff/12-finish-the-game.md` and `13-polish-from-playtest.md` first; they carry the
  detail this pointer intentionally omits.
