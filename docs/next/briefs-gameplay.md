# Briefs: mechanics, combat and challenge

From the game-director seat's read-only deep dive on `main` a17b261 (2026-10-01), ranked by what a player feels most. Line numbers drift: grep the named symbol. `output/notes/13a/13a-combat.md` items 1 to 3 are fixed (shots live until they leave the view); do not redo them.

### 1. Boss pacing and a measured time to kill
- Why: wardens model at 70 to 82.5 s and the Omega Core at 87.5 s against Rook's 37.5 s (`docs/design/difficulty-curve.md`); boss HP is about 4x the classic 28, so a pellet is 1 of 120 and the bar barely moves; the ramp across the eight wardens is flat; the model ignores the saber (2/2/4 per about 0.9 s, `src/player/config.ts`). Volt Hopper and Gale Vixen are flagged, not retuned.
- Where: `src/bosses/roster.ts`, `src/boss/phaseKit.ts`, `scripts/content/warden-curve.mjs`, `tests/boss-phase-kits.test.ts`.
- Done when: a scripted-input bot measures buster-only, saber-only and weakness kill times per boss; a test pins a rising warden ramp and a weakness kill inside one 28-unit bar.
- Size: M. Needs: Craig's play.

### 2. Death has no stakes
- Why: Normal and Assist continue at the last checkpoint with lives reset (`src/scenes/game/gameOverLogic.ts`), four checkpoints per 12 or 13 screens, so lives and tank risk mean nothing; only the end rank counts deaths.
- Where: `gameOverLogic.ts`, `src/scenes/game/RunState.ts`, `src/progression/difficulty.ts`.
- Done when: Craig picks the rule at a STOP (recommended: a game over loses the attempt's unbanked pickups, or lives become a visible count that moves the continue point); a unit test and a smoke assertion pin it.
- Size: M. Needs: Craig.

### 3. One signature enemy per warden stage
- Why: 12 families over 10 stages, the district variants mostly unbuilt (`docs/working/enemy-ecology-and-variant-plan.md`); later stages reuse Heat Works' five types as recolours.
- Where: `src/enemy/EnemyBehaviorProfiles.ts`, `src/content/enemies/`, the plan's pilot rows.
- Done when: `content:lint` fails a warden stage with no variant whose attack differs; a test per variant checks its telegraph and recovery; sweep captures show distinct silhouettes.
- Size: L. Needs: art (Higgsfield).

### 4. Special weapons that open routes
- Why: every secret opens with a charged shot or a dash-jump; no barrier is keyed to an earned weapon, so weapons have no stage use (classic Mega Man and X reward backtracking with them).
- Where: `src/content/stages/*.ts` (breakable walls), `src/projectiles/weaponEffects.ts`, `src/scenes/game/StageBuilder.ts`.
- Done when: a `weaponGate` barrier breaks only to its weapon (Flame on crates, Frost on water, Quake on floors, Thunder on sockets); a smoke row per gate; `content:lint` wants one per warden stage once that weapon is earnable.
- Size: L. Needs: art.

### 5. Enemy attack contracts
- Why: `src/enemy/EnemyCombat.ts` dispatches projectile, lobbed and burst only; the one `beam` attack falls through to melee; a stun does not cancel a pending windup; aim is read at fire time.
- Where: `EnemyCombat.ts`, `EnemyAI.ts`, `src/enemy/attackHitbox.ts`.
- Done when: unit tests show a beam emits a telegraphed lane and a stunned enemy drops its windup; a smoke row shows the laser eye's lane.
- Size: M. Needs: none.

### 6. Veteran is longer, not harder
- Why: Veteran only multiplies HP x1.25 and damage x1.5 (`src/progression/difficulty.ts`): a 75 s fight becomes 94 s.
- Where: `difficulty.ts`, `src/boss/phaseKit.ts`, `src/enemy/EnemyBehaviorProfiles.ts`.
- Done when: Veteran shortens telegraphs and cooldowns (cadence floored at 250 ms, the legibility floor of the Rook retune) and keeps boss HP at x1; a test pins Veteran clear time at or under Normal x1.1.
- Size: S. Needs: Craig's play.

### 7. The rematch gauntlet is long
- Why: eight rematches of 49 to 58 s plus walking make the archive about 8 minutes, checkpoints only after clears 2, 4, 6 and 8, then the Core's 87.5 s (`docs/design/stage-briefs.md`, Central Core).
- Where: `src/content/omegaRematch.ts`, `src/content/omegaArchive.ts`, `src/scenes/game/OmegaActs.ts`.
- Done when: after Craig plays it, a retune (lower HP factor or a checkpoint per clear) is pinned by `tests/omega-archive.test.ts`.
- Size: S. Needs: Craig's play.

### 8. Real death and damage data
- Why: telemetry and the heatmap exist (`src/telemetry/segmentTelemetry.ts`, `scripts/content/heatmap.mjs`) but no real run fed them; Volt and Gale wait on deaths.
- Where: `scripts/smoke/`, the telemetry module, the heatmap script.
- Done when: a replay bot runs all ten stages on three difficulties into `output/telemetry/*.json`; the heatmap flags segments over a death threshold, recorded in a ledger row.
- Size: M. Needs: Craig's play to confirm.
