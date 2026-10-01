Seat: narrative-designer
Commit: ffda356
Scope: 05b 5.7 tutorial_coach trigger (Rook's recorded intake prompts), lane key hints, validator rule and coverage, voice against the bible, order independence, dialogue grants nothing
Artifacts opened: output/packets/05b-5.7-tutorial-narrative-designer.md; src/content/dialogue/types.ts (grep only, for DIALOGUE_LINE_LIMITS); tests/dialogue-content.test.ts:185-208 (the failing fixtures)
Tokens: 35385

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MINOR | Line 1's phrasing ("walk before they run") is more idiomatic and soft than the other four, which are flat procedural statements ("That frame is armored", "The wall ahead is scrap"): a small tonal wobble in an otherwise tight set. | `src/content/dialogue/dialogue.v2.json:99` | "Step one. Clear the step ahead. The gate reads your stride, not your file." |
| MINOR | Each line's ordinal ("Step one" to "Step five") is baked into the text but the runtime binding is `lines[index]`; nothing ties the label to the lock it names, so a reordered or inserted lock silently mislabels the prompt. | `src/scenes/game/StoryDirector.ts:136` (`sequence?.lines[index]`), `src/content/dialogue/dialogue.v2.json:99-103` | No text fix now; the handoff must say that reordering hangar locks means editing prose, not only data. |
| MINOR | The bible gives Rook "two lines and a clean record" for the live override scene; the five recorded coach lines add Rook lines across the level. Not a contradiction (the staging note frames them as the pre-recorded clean voice before the held one), but the bible text itself does not carve out the exception. | `docs/story/story-bible.md:49`; `src/content/dialogue/dialogue.v2.json:98` (staging note); `docs/story/script.md:31,50-53` (the live scene still has exactly 2 Rook lines) | Add one clause to the bible's Rook entry: recorded intake prompts during the drill do not count as its live lines. |

No key names in the coach lines (verbs only: "burst your thrusters", "hold your buster", "cuts with the saber"); keys stay in the separate `hint` enqueue (`src/scenes/game/StoryDirector.ts:134`). No warden naming: `mentionsOtherWarden` runs on the tutorial's stage-bound lines too (`src/content/dialogue/validateDialogueContent.ts:247-254`). Validator rule enforced with failing fixtures: trigger scoped to `tutorial_sentinel` only (`src/content/dialogue/validateDialogueContent.ts:50`), speaker forced to `sentinel_rook` (`validateDialogueContent.ts:256-261`, fixture `tests/dialogue-content.test.ts:191-192`), 4 to 6 lines (`src/content/dialogue/types.ts:69`, fixture `tests/dialogue-content.test.ts:203-205`), coverage exactly once with a stage-mismatch fixture and a duplicate-sequence fixture (`tests/dialogue-content.test.ts:197-201,207-208`). `docs/story/script.md:29-37` renders the Coach section with the staging note and all five lines. Dialogue grants nothing: no reward, flag, kill or scene-change verbs, and `onRoomLockArmed` never calls `Save.markStorySeen`; it enqueues a `hint` then a `radio` line gated on `currentStoryPolicy().enabled` (`src/scenes/game/StoryDirector.ts:131-139`); the gate opens only on the verb.

| Rubric | Score |
| --- | --- |
| Voice matches the style guide | 4 |
| Order-independent and skip-safe | 4 |
| Every trigger consumed at runtime | 5 |
| Stakes shown, not told | 4 |

Verdict: SHIP (no BLOCK or MAJOR; the three MINORs are handoff notes, not blockers)
