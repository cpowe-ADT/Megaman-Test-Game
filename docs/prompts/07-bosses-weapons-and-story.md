# 07. Bosses, Weapons, and Story

Active seats: Orchestrator, Combat Designer (fight owner), Principal Game Engineer, Narrative Lead, Art Director (portraits, effects), QA / Eval Lead.

Four sessions: `07a` (7.0, 7.1 and 7.2), `07b` (7.3 and 7.4), `07c` (7.5), `07d` (7.6).

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 07a | 7.1 Hazards, telegraphs, and the end of the generic bullet | Engineer | twelve distinct hazards; drawn tells | P7-001 | approve two pilot fights |
| 07a | 7.2 Phase kits, desperation, weakness reaction, intro and death | Designer | fights with shape | P7-002, P7-003 | play Pyro and Tide |
| 07b | 7.3 Weapons that feel different; the weakness table | Designer | eight identities; no dead weapons | P7-004 | approve |
| 07b | 7.4 The other seven wardens and the Core | Designer | the campaign's fights | P7-005 | play the Core |
| 07c | 7.5 Portraits, dialogue presentation, effects art | Art, Narrative | faces, typewriter, blips | P7-006 | approve |
| 07c | 7.6 The unplayed beats and a voice pass | Narrative | the finale lines, mini-boss calls, verb signatures | P7-007 | read the script |

## Entry conditions

- Charter and amendments. `docs/prompts/handoff/06-levels-mechanics-and-enemies.md` is `COMPLETE`; every `EVAL-P6-*` row `PASS`.
- Read: the 05 and 06 handoffs, `docs/prompts/03-art-animation-bosses.md` section "Phase 3.3" (readability rules, reused), `docs/architecture/boss-framework.md`, `src/bosses/roster.ts`, `src/bosses/bossCombatProfiles.ts`, `src/bosses/BossController.ts`, `src/bosses/BossMotionController.ts`, `src/boss/framework/` in full (`BossBase`, `BossAttackController`, `AttackModules`, `BossProjectileController`, `bossDefinitionMapper`), `src/boss/config/volt_golem.json`, `src/content/weapons.ts`, `src/projectiles/`, `src/progression/seed.ts`, `src/progression/state.ts`, `src/progression/upgrades.ts`, `src/content/dialogue/` in full, `src/scenes/game/StoryDirector.ts`, `src/ui/DialogueOverlayController.ts`, `docs/story/story-bible.md`, `docs/story/style-guide.md`, `docs/story/script.md`.
- Ground truth (2026-09-22 audit): every warden is two attacks plus one unlocked at 55% with weight 3 and a cadence multiplier, chosen by weighted random with anti-repeat; twelve authored hazard ids resolve to one floor-spike spawner and four spread ids to one 3-fan; a watchdog fires an untelegraphed bullet after 1.5s without a spawn; `dash_strike` is injected for dash attacks with no spawn; the mapper hardcodes `warningFx: 'glow'` and `anchor: 'self'` and nothing draws them; the only tell is a tint and a 4% squash; `enraged` only scales think time; weakness hits are 1.75x with the same blink; `INTRO` shows idle; `onDied` destroys the boss the same frame; `PHASE_TRANSITION` shows the shoot frames; player hits give the boss 240ms i-frames; `piercesIFrames` is never read; `defense` and `resistances` are always empty for roster bosses. Weapons: none charges, none has an on-hit effect, energy 2 to 6 is squashed to 1 to 3. Classic mode `weakness_and_buster` makes every non-weakness special 0 damage (`BLOCKED`); Rook and Omega have no weakness profile so every special is blocked on the final boss; the 0.75 resist branch is dead code. Story: `finale_phase` (three Omega lines, WREN's self-line) and `miniboss_callout` have no consumer; dialogue has no portraits, no typewriter, no blip.

## Outcome of this prompt

Ten fights that each teach a pattern, escalate at phase two with a changed kit, and end with a death worth watching. Eight weapons a player chooses between for a reason. Every authored story beat plays. Speakers have faces.

## Phase 7.0: Extract before building (added on final review)

Half a session. Move the boss hitbox, hazard and projectile-controller block, the boss art placeholder, `applyDamageToBoss` with its hit feedback, `bossUpdate`, and the boss-defeated and victory flow into `src/scenes/game/BossBeats.ts` and `BossDamageRouter.ts`; weapon cycling, energy recharge, fire and labels into `src/scenes/game/WeaponRuntime.ts`; hit wires, contact handlers and bullet recycling into `src/scenes/game/HitWires.ts`. Ledger: `EVAL-P7-008` (`Game.ts` at or below 2,600 after this phase; full smoke green).

## Phase 7.1: Hazards, telegraphs, and the end of the generic bullet

Engineer leads.

1. Split `BossProjectileController` hazard spawning into real spawners with their own body, art and timing: ceiling `icicle_fall` (shadow then fall), `charge_mine` (placed on take-off, arms after 400ms, detonates on contact or timer), rising `tornado_pillar` and `splash_pillar`, lingering `burn_puddle` and `acid_trail`, `magnet_node` (pulls the player 40px/s within 96px), `stone_pillar` (rises and blocks), `vapor_pod` (delayed burst), `short_quake` and `ground_shockwave` (travel along the floor, jumpable), `wind_hitbox` (a moving box, not a bullet), `mag_disc` (out and back with a return path). Effects art on the effects atlas, generated where missing (Higgsfield, `#FF00FF`, 32 or 64px cells).
2. Draw the authored telegraph: the mapper stops overwriting `warningFx` and `anchor`; the boss-attack handler renders a reticle at the player for `target` anchors, a floor marker for `floor`, and a flash on the boss for `self`, for the attack's windup; `render_game_to_text().bossState.telegraph` lists it.
3. Retire the watchdog bullet and the `dash_strike` injection: every attack spawns something or has a real dash hitbox on `crossPlayer` attacks (a body attached to the boss during the active phase). `[Boss][Watchdog]` never appears in a full-fight log.
4. Pilot on Pyro Maw and Tide Reaver: Serpent Stream becomes a sweeping cone, Blaze Lob explodes into three arcs on landing, Lance Volley fires two to three lances as the roster says, Riptide Crash drops from the ceiling to the player's column.

Ledger: `EVAL-P7-001` (twelve spawner tests; sweep captures showing a different hazard silhouette per warden; watchdog absent).

## Phase 7.2: Phase kits, desperation, weakness reaction, intro and death

Designer leads.

1. Phase two changes the kit, not only the speed: each warden retires one attack, retimes one, adds one, through `attackWeightOverrides` plus an `enabled` flip in the mapper. Trace proves the retired id never fires in phase two.
2. Desperation at 20% HP: one new attack per warden, arena change where the room kind allows (vents all on, mines everywhere, pillars rising, anchors shifting), palette flash on the boss.
3. Weakness reaction: multiplier at or above 1.4 applies 200ms `hurtStunMs`, a double-length white flash, `boss_hit_weak` sfx, and interrupts a windup. Boss i-frames on player hits 240ms to 120ms; boss HP raised to keep a Normal clear around 60 to 90 seconds.
4. Intro: an `intro` frame group per boss (generate a 4-frame pose sheet per warden through Higgsfield with the existing sheet as the reference), an `INTRO` branch in `playAnimationForState`, the WARNING band and name-and-element card before `playBossIntro`, bar fill 0 to max over 900ms with a tick.
5. Death: `onDied` defers `destroy()` behind a defeat frame group, a 1.2s chained explosion, 20 frames of hit-stop, a white flash and a 900ms freeze; then the defeat dialogue.
6. `PHASE_TRANSITION` shows a pose, not the shoot frames.

Ledger: `EVAL-P7-002` (phase-kit traces for Pyro and Tide, desperation observed, weakness stagger observed), `EVAL-P7-003` (intro and death captures; smoke `39-boss-grounded` still green; new `44-boss-beats` asserts WARNING, bar fill, phase two, desperation, death sequence).

```
### STOP 7.2: Play Pyro and Tide
Show: the WARNING card, a telegraph capture, phase-two trace, desperation capture, death capture.
Ask Craig to fight both. Question: readable, fair, long enough? Recommended: tune from his notes, then batch.
```

## Phase 7.3: Weapons that feel different; the weakness table

Designer leads.

- Identities in `src/content/weapons.ts` (one hold or charge behaviour and one on-hit tag each): FlameSerpent hold-stream that leaves burn puddles; HydroLance aim up and down, pierces; ThunderSpike charge to chain between enemies; QuakeKnuckle lob that quakes on landing; MagcutDisc boomerang that pulls pickups; AcidGlob sticks and ticks; AeroDarts fan that bounces once; FrostShatter freezes an enemy solid for 1.5s (a platform). `ProjectileCollisionRouter` applies on-hit tags. Authored energy costs stop being squashed; holstered regen stays.
- Weakness table: `applyDamageToBoss` calls the authored ring (`damageMultiplier` in `bosses/types.ts`): weakness 1.75, neutral 1, resist 0.75 shows `RESISTED`; `BLOCKED` is gone in Classic. Rook takes Buster only (profile added); Omega rotates its weakness by phase (announced by the finale lines in 7.6). The `bossConfig` `defense` and `resistances` path is wired for roster bosses so elements matter.
- Projectile and impact art per weapon (added on review): each weapon gets its own projectile sheet and impact burst through Higgsfield (8 sheets, 32px cells, `#FF00FF`), replacing the shared bullet textures; the weapon icon for the pause grid and the HUD comes from the same sheet.
- `weapon_refill_small` and `weapon_refill_large` are queued by the progression state but never applied in `Game.applyPendingConsumable` (only `hp_` is); apply them (added on review).
- Tests per weapon on `resolvePlayerShot` and the collision router; smoke `12-weapon-switch-energy` extended with one shot per weapon and its on-hit tag in the payload.

Ledger: `EVAL-P7-004`.

## Phase 7.4: The other seven wardens and the Core

Gale Vixen is the wall-jumping boss (added on review): her `shaft` room from 06 has no floor to stand on for long; Turbine Slice sweeps the shaft, Aero Volley fires from the wall she clings to, Cyclone Lift pushes the player up the walls; the player fights from wall kicks and the entry ledge. Verify with an input-replay script that clears phase one from the walls only.

Apply 7.1 and 7.2 to Rook, Volt, Basalt, Ferro, Mire, Gale, Glacier, and Omega Core (three phases with the deck; Core Ram gets a real dash hitbox; Override Cascade uses four hazard kinds). One batch STOP per three bosses with the same evidence as STOP 7.2.

Ledger: `EVAL-P7-005` (every boss: phase-kit trace, desperation, intro and death captures, `44-boss-beats` green across the sweep).

```
### STOP 7.4: The Core
Ask Craig to fight Omega Core. Question: does the finale land? Recommended: tune, then 7.5.
```

## Phase 7.5: Portraits, dialogue presentation, effects art

Art and Narrative.

- Twelve speaker portraits at 48x48 through Higgsfield (the approved hero turnaround and each boss sheet as references; WREN, Iona, Omega, Rook, eight wardens), cut into `assets/sprites/portraits/`.
- `DialogueOverlayController`: portrait left, name plate, typewriter at 40 characters per second with a blip every two characters, confirm skips to the end of the line then advances, reduced-flashing honoured. Stage Select uses the same portraits.
- Effects atlas gaps from 7.1 filled and credited as original.

Ledger: `EVAL-P7-006` (portrait coverage test; smoke `34` to `37` with portraits; a typewriter unit test).

## Phase 7.6: The story a player will feel

Narrative leads. Everything below came from the 2026-09-22 narrative review; the samples are in `docs/story/review-2026-09-22.md` (write it from the review notes in this prompt's design memo). Rules: the validator in `validateDialogueContent.ts` is the contract; a new trigger needs a failing fixture, a coverage rule and a consumer in the same commit; every line under 180 characters; `npm run story:script` regenerates the script and its parity test stays green.

**A. Schema-free line pass** (edits in `dialogue.v2.json` only):

1. Earn Iona's turn: two defences of the design before milestone 4 (tutorial defeat line 3 and milestone 1 line 3, "It asks. It does not take."), so "I wrote the layer" turns "read" into "wrote".
2. Close the hangar hole and the "fail differently" repeat: the Core radio line becomes OMEGA admitting it left the hangar open on purpose ("A city that watches one unit choose badly asks to be held").
3. Close the consent hole: the Core intro gains an OMEGA line accusing WREN of taking eight wardens by force and calling it consent, so the phase-three refusal answers a charge that was laid.
4. Iona's reckoning: an epilogue line before "The network is holding" ("I filed what I wrote with the rest of it. Let the record argue with me too.").
5. Verb signatures, all eight: Pyro seals, Tide holds, Volt cycles, Basalt bears, Ferro counts, Mire doses, Gale steers, Glacier preserves; intro, defeat and epilogue card carry the verb; a test asserts the stem in all three. Pyro, Tide and Basalt stop sharing the "OMEGA says X is cheaper" template; Volt and Ferro stop sharing the forensic register. Iona takes contractions on the ticker so she stops sounding like OMEGA.
6. Name drift: one name for the last stage everywhere (`Central Core`), asserted in `tests/identity-strings.test.ts`.

**B. New triggers** (each: `types.ts` trigger and limit, validator coverage with a failing fixture, `StoryDirector` consumer, smoke assertion):

7. `tutorial_coach` landed in 05 §5.7; verify it here and give Rook a sixth line if the locks need it.
8. `capsule_pickup`: eight warden stages, 1 line, speaker the stage's own warden, a recorded cache log from before tonight shown above the effect label on the capsule card; the fiction is that every district kept a recovery cache for Unit 09's drills, one more piece of before-the-danger evidence.
9. `weapon_get`: eight lines, speaker Iona reading the district registry, keyed by the weapon's source stage so randomizer placements stay true; shown on the weapon-get card that 08 builds (write the card's data contract here).
10. `game_over`: global, 4 lines, three from OMEGA and one from Iona, rotated by death count over the Continue row.
11. `warden_phase`: eight warden stages, 1 line, OMEGA, on the boss's phase two; a distinct line, not the checkpoint intrusion replayed (`story-surfaces` asserts the checkpoint line is unchanged).
12. Milestone-4 turn beat: OMEGA between Iona's admission and WREN's close ("You wrote it to ask, Director. I taught it to hold."); add `omega_core` to the order-independent milestone speakers with a flipped fixture.
13. `epilogue_secret`: global, optional, 2 lines, plays only with all eight capsules, after the eighth card over the Drill Hangar panel from 08: the collectible gets a story payoff, not only a rank.

**C. OMEGA acts, not only speaks:**

14. Water District pilot: after the checkpoint intrusion, the master shaft's low-water line sits one notch higher for the rest of the stage (one level parameter tied to the radio flag). If it reads, every intrusion costs something the stage already teaches (vents tighten, rails arm faster).
15. Show, do not tell (from the first review): one freed-warden moment per district after the defeat, staged in the level: the district sign relights, a door opens, the briefing's civilian count ticks on the toast.

Ledger: `EVAL-P7-007` (every authored sequence id consumed; the verb-stem test; story-flag parity after a Core clear includes the finale ids; Craig reads the script), `EVAL-P7-009` (the seven new triggers each with a failing fixture, coverage, consumer and a smoke assertion; the water margin pilot asserted in `classic-campaign`).

```
### STOP 7.6: Read the script
Show: the diff of script.md, the consumer and verb tests, captures of a capsule log, a weapon-get line, a game-over line, the milestone-4 beat.
Ask Craig to read the script. Recommended: approve.
```

## Panel conditions (2026-09-22, delegated decisions)

From the art-director panel (`D-002`): the ten boss sheets are an approved baseline, not accepted art. 7.4 captures each boss's idle, move and shoot in the game at 1x and the art-director seat reviews them before a sheet counts as accepted; glacier_ronin and ferro_blade are re-cut with more space per cell (scarf fragments, a split disc) and every beam stays inside its cell.
From the narrative-designer panel (`D-001`), 7.6 also: defeat lines must be true for any placed reward ("{rewardLabel} will carry you above its walls" is wrong for a Heart Tank or an Access item); rewrite Glacier's OMEGA radio line ("Memory is the last district"), which reads differently by play order; extend A.6 to the tutorial ("drill hangar" vs the "SENTINEL DRILL" card); limit style-guide rule 15 to in-fiction lines so the "AI studio" credit stays. `miniboss_callout` and `finale_phase` are wired only through the wrapped ticker or the dialogue overlay (the Core's offer is 112 characters). STOP captures use the public build, and credits captures show a mid-scroll frame.

## Exit Gate

- `EVAL-P7-001` to `EVAL-P7-009` `PASS`.
- `npm run verify`, `npm run test:visual-sweep` green on the exit commit; `44-boss-beats` in the sweep for all ten.
- `git grep "Watchdog" src` prints nothing; `git grep "dash_strike" src` prints nothing.
- `wc -l src/scenes/Game.ts` at or below 2,600 after 7.0; boss beats, damage routing and the weapon runtime live under `src/scenes/game/`.
- Handoff with `Inputs for prompt 08`: the beat list with timings (WARNING, bar fill, death), the sfx ids each system emits, the portrait keys.

```
### STOP 7.EXIT
Question for Craig: start 08? Recommended: yes.
```
