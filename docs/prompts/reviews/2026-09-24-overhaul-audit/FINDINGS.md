# Overhaul audit, 2026-09-24 (during 05c)

Brief: `output/notes/05c-overhaul-audit.md` (Craig's words; gaps between his ask and prompts 06 to 08). Four blind seats, read-only, at most 12 calls each. Ranked lists as returned, condensed by the orchestrator; every file:line is the seat's. Acted on in the "Additions from the 2026-09-24 overhaul audit" sections of prompts 06 and 07 (EVAL-P6-015, P6-016, P7-010).

## level-designer (39,241 tokens, 10 calls)

1. Flat single-height floor, no pits, no verticality: already 6.1 (`06-*.md:32-51`); rank first because it unblocks everything.
2. Undifferentiated floor and unoutlined platform bars blend into parallax: already 6.4 tilesets; name platform-edge contrast in the style sheet when 6.4 runs.
3. Backgrounds read as placeholder silhouettes (Pyro a green grid, Glacier one grey): already 6.4.
4. No secrets, gates or pacing beats: already 6.5 to 6.7. 5. Enemy density far below the 18-placement budget: 6.5 to 6.7.
No new gap outside 06. Advice: do not let 6.4 art land before 6.1 geometry.

## art-director (44,341 tokens, 12 calls)

1. Backgrounds do not match the biome palette (`pyro_maw/boss-room.png` green-teal against `#6C3520`/`#FF6A1F`): 6.4, highest payoff (fills the frame).
2. Enemies: all twelve atlases already have 18 frames (idle 4, move 4, attack 4, hurt 2, death 4); content is CC0 placeholder: 6.4 re-skin.
3. Bosses: baseline, glacier_ronin and ferro_blade named for re-cuts in 07's panel note.
4. Portraits and typewriter: 7.5. 5. HUD chrome generic (no weapon icon, boss portrait, sub-tank pips): 8.2.
6. Ledges and tiles: 6.4's largest line; check with mid-stage captures. No new phase needed.

## game-director (42,387 tokens, 10 calls)

1. The eight warden base sheets are never regenerated in 06 or 07; Pyro reads as a shapeless blob next to a readable hero (`27-boss-sword-hit/shot-1.png`, `39-boss-grounded/shot-boss-grounded.png`); 7.2 reuses the existing sheet as reference. Fix: regenerate in 6.4 before 7.2's STOP. L.
2. Regular enemies have no hurt or stagger tell (7.2 gives bosses one; 6.3 does not): add to 6.3. S.
3. No boss-grounding check when art regenerates (`bossBodyAlignment.ts` re-measures the idle frame): add a grounding capture to 6.4's STOP. S.
4. 6.3 behaviour, 7.1 hazards and 7.3 weapons already match the ask.

## game-code-reviewer (42,505 tokens, 12 calls)

1. Three boxes per enemy; the sword uses the drawn frame (`Game.ts:1960-1965`), shots the body (`EnemyMotor.ts:88-95`), the catalog hurtbox (`types.ts:93`, `EnemyCatalog.ts:18-19`) is never read: one `resolveHurtbox`, 6.0. S.
2. Enemy melee checks `player.getBounds()` (`EnemyCombat.ts:163-164`), not the body profile; untested: 6.0. S.
3. Boss body does three jobs (`BossController.ts:163`, `Game.ts:1994-1999`, `Game.ts:1010`, `2696-2708`); attacks have no hitbox shape (`AttackModules.ts:48`): split in 7.0. M.
4. All hit wiring lives in untyped `Game.ts` (985-1040, 1433-1444, 2657-2708); move `HitWires.ts` into 6.0, lower EVAL-P6-014 to about 2,700. S.
5. Automation has no box checks: report boxes and lint them in 6.9. S-M.
6. Every hazard is 28x10 for 1 damage (`Game.ts:1401-1402`): 6.1. S.
7. (Checked by the orchestrator: false positive; `attachActor` calls `clearAttachedColliders` first, `PlatformCollisionSystem.ts:115`.) `installEntityPlatformCollisions` runs at four sites (`Game.ts:478, 1418, 1430, 1504`) and `attachActor` never detaches (`PlatformCollisionSystem.ts:111-134`): make idempotent, 6.0. S.
8. Dead `applySaberDamage` (`Game.ts:1905`, hardcoded 44x36): delete, 6.0. S.
9. Shots hit platforms by drawn bounds (`Game.ts:917-924`): 7.1. S.
Already tested: sword hitbox, projectile router, boss body alignment, body profiles. Untested: enemy melee, touch damage, hazard contact, overlap wiring.
