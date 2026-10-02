# Briefs: story, UX and the first five minutes

From the narrative-designer seat's read-only deep dive on `main` a17b261 (2026-10-01). Ranked by what a new player feels most. Each brief is self-contained: open the "Where" files first, prove it with "Done when". Line numbers drift: grep the named symbol if a line moved.

### 1. Hints that match the device
- Why: every on-screen hint names keyboard keys while Craig plays on touch: the tutorial toast `JUMP: Z` (`src/mechanics/roomLock.ts`), the Prologue footer `ENTER NEXT ESC SKIP` (`src/scenes/PrologueScene.ts`), the dialogue footer `ENTER / CLICK • ESC SKIP` (`src/ui/DialogueOverlayController.ts`), `Q / E TO SWITCH` (`src/ui/beats/weaponGet.ts`), the Title and Ending footers.
- Where: a new `src/content/strings.ts` (the seed of the v1.1 string table) with `hintFor(action, device)`; then each file above.
- Done when: a unit test returns the touch label with touch on and the key otherwise; a smoke with `touchControls=on` finds no "ENTER" or "ESC" on Title, Prologue or the dialogue box.
- Size: M. Needs: none.

### 2. Tutorial hints that persist
- Why: each teach lock shows its verb for 2.4 s (`KEY_HINT_MS` in `src/scenes/game/StoryDirector.ts`); a player who misses it stands at a locked gate.
- Where: `StoryDirector.ts` (`onRoomLockArmed`), `src/mechanics/roomLock.ts`, `src/mechanics/adapters/RoomLockAdapter.ts`.
- Done when: a unit test shows the hint returning after about 8 s idle at an armed lock; a smoke reads it from `render_game_to_text`.
- Size: S. Needs: none.

### 3. The Title's cancel wipes the run without asking
- Why: `src/scenes/Title.ts` binds cancel to `Save.clearActiveRun()` with no confirm; on touch, SELECT sends cancel and sits beside START. The footer says "ESC CLEAR RUN" next to jargon ("TUTORIAL PENDING / FINAL LOCKED").
- Where: `Title.ts`, `src/input/menuInputBinder.ts`.
- Done when: a test shows cancel needs a second confirm; Craig reads the footer as plain English.
- Size: S. Needs: none.

### 4. Game over races its line
- Why: `src/scenes/GameOverScene.ts` counts 5 s under a line up to 180 characters, any tap continues, the body is 9px system monospace (not the bundled pixel font), and nothing says what killed you.
- Where: `GameOverScene.ts`, `src/scenes/game/gameOverLogic.ts`, `StoryDirector.ts` (`gameOverLine`); killed-by already lands in `src/telemetry/segmentTelemetry.ts`.
- Done when: the countdown starts after the line is read; one tip per stage or boss ("Dash under the lunge"), with a coverage test like `validateDialogueContent`.
- Size: M. Needs: writing.

### 5. Stage Select never says where to go
- Why: nine equal tiles; Craig's notes (D-016, D-018) were about not knowing where to go; the weakness hint is 8px slot text (`src/scenes/StageSelect.ts`).
- Where: `StageSelect.ts`, `src/scenes/stage-select/`.
- Done when: a pure `suggestedNextStage(save)` with a unit test; the footer reads "FREE 8 WARDENS TO OPEN THE CORE: n/8"; Craig never wonders what to do next.
- Size: S. Needs: none.

### 6. WREN's one moment is a ticker
- Why: the story bible gives WREN one self-line, the refusal, delivered as a non-blocking ticker mid-fight (`docs/story/script.md`, Core phase 3) where a dodging player cannot read it; the prologue never plants the "built here" wound.
- Where: `src/content/dialogue/dialogue.v2.json`, `StoryDirector.ts`, `docs/story/story-bible.md`.
- Done when: the offer and refusal are a short blocking beat at the phase break with one earlier foreshadow line; `47-full-campaign` skip and read still end equal (rule 8); Craig reads it.
- Size: M. Needs: writing, Craig.

### 7. Secrets and cans read as scenery
- Why: charge-breakable walls look like walls (the charged shot is taught once); some pickups still read poorly at game size (`output/notes/13a/13a-pickups-beats.md`; pickups v2 improved them, Craig has not confirmed).
- Where: `assets/sprites/pickups/`, `src/ui/pickups/pickupArt.ts`, the breakable walls in `src/content/stages/`, each stage's briefing lines.
- Done when: a crack or shimmer on breakable walls shows in the sweep; each briefing hints one secret; Craig names each can at game size.
- Size: M. Needs: art, writing.

### 8. No human first-boot check yet
- Why: every box in `docs/playtest/v1.0-checklist.md` is unticked; the Rook retune (`EVAL-P13-006`) waits on Craig's play.
- Where: the checklist, `scripts/content/heatmap.mjs`, `src/telemetry/segmentTelemetry.ts`.
- Done when: Craig ticks the checklist from a cold boot; the heatmap shows Rook in its 30 to 40 s band; notes go to `docs/prompts/DECISIONS.md`.
- Size: S. Needs: Craig.
