# Player flow and onboarding, 2026-09-22 (input to 05 §5.6, §5.7 and 08 §8.3)

## The flow today

Boot and Preload draw nothing (no progress bar). Title: `BEGIN A NEW CAMPAIGN` or `CONTINUE`, keys C, O, N, Esc = clear run without confirmation. NewCampaign: difficulty, `START CAMPAIGN`, no on-screen cancel. Prologue pages. Game: a 900ms stage card nobody can skip (`advanceIntro`/`skipIntro` have no caller), a three-line briefing, then control with no prompt. Boss clear: defeat dialogue, then a web dialog `Boss Defeated ... [Next]`, then Stage Select where the first Enter is refused until the cursor moves. Esc at Stage Select opens the route console. Three deaths: game over with a 5-second auto-continue that any click triggers.

## Onboarding

The briefing names the verbs ("Jump, dash, wall jump, charge, saber, in that order") but never a key; the only key list is the Controls screen. The tutorial is a 640px flat room; Rook is reachable without dashing, kicking, charging or drawing the saber. No `room_lock`, no shaft, no capsule, no crumble; five placements. The tutorial grants no weapon, so Q/E feel dead. Pause and sub tanks are never announced.

## Friction

- Esc at Title clears the autosave with no confirmation.
- `Save.exists()` is key presence: changing Difficulty in Options at the Title creates the key, and the next Enter skips the difficulty pick and the prologue.
- Esc means six things across scenes; Enter on an Options cycle row closes the screen; Enter on the pause Weapon row resumes.
- Space is jump and confirm; the dialogue overlay does not flush input, so the Space that dismisses the last briefing line is a live jump.
- Options has no pointer handlers and no Back row; NewCampaign has no tappable cancel; the touch pad has no weapon button.
- Game over: rows not interactive, any pointerdown continues, the countdown runs from the first frame.
- No feedback for loading, saving or resuming.
- Two different locked-stage messages; toasts size to unwrapped text and can overrun the canvas; the Stage Select preview description can overlap the details line.
- Labels: `RETRY x03` for lives, `BOSS ???` from frame one, `MISSION CONTROL` over the start button.

## Older audit (`docs/working/consultant-audit.md`)

Resolved: click selects then confirms, hover inert, slot text reduced, weakness shown, selection stroke, menu sounds, manifest validated. Remaining: preview is one strip not three blocks, game-over counts never shown, portraits are idle frames with no transition (owned by 08 §8.2).

## The twelve changes

05: the tutorial as briefed (`49-tutorial-verbs`); a first-run controls page per profile (`41-profiles`); new-versus-continue from a campaign-started flag (`38c`). 08: Esc confirm at Title (`38c`); pointer and touch on every menu (`4c`); game-over choice (`50-game-over-choice`); weapon-get card naming the weapon, energy and switch keys (`45`); one toast rule (`33`); skippable stage card, READY, first-control hint (`45`); save feedback (`13`); a menu key-semantics table; preview and HUD labels (`33`).
