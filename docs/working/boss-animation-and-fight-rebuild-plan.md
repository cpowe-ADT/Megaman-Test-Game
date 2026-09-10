# Boss Animation and Fight Rebuild Plan

- Status: working
- Owner scope: gameplay, art, content
- Prepared from the 2026-08-05 live Pyro Maw capture and current runtime/source audit

## Outcome

Turn the ten boss encounters from floating horizontal turrets into readable Mega Man-style duels: grounded or deliberately aerial movement, committed attacks with clear tells, action-specific animation, coherent facing/projectile direction, distinct silhouettes, and boss-room hazards that create movement decisions without obscuring fairness.

This plan does not change progression, rewards, save truth, dialogue, or the player combat contract. Those systems are already stable and should remain regression boundaries.

## Current Diagnosis

1. `BossController` disables gravity for every boss. Grounded bosses therefore hover at their authored spawn Y instead of landing on the arena floor.
2. `BossBase` returns only a horizontal `-1 / 0 / 1` movement direction. The runtime feeds it a player position whose Y is forced to the boss Y, so the brain cannot reason about jumps, landings, dives, platforms, or vertical projectiles.
3. Movement is range correction rather than strategy: approach, retreat, or stop. `jumpHeight` and most `movementProfile.mobilityNotes` are documentation-only.
4. Dash execution sets X velocity once, while hazards and many named attacks collapse into generic bullets or the same ground-hazard helper. Attack definitions sound distinct but share little behavior.
5. Runtime animation maps every attack to `shoot`. Attack telegraph animation names are authored but not consumed. Windup, active, recovery, landing, hurt, phase, and defeat do not have authoritative visual states.
6. Every non-Omega runtime atlas has only four `idle`, four `move`, and four `shoot` frames. The rebuild script synthesizes these by shifting/scaling one extracted pose; it does not contain real limb animation.
7. The existing boss action sheets are palette variants of one generic buster/sword character with labels, effects, and opaque backgrounds baked into the image. They cannot provide distinct production boss frames.
8. The free-source roster supplies legally trackable placeholders, but several bosses reuse the same mech silhouette with palette changes. It does not match the stronger distinct concepts in the original roster sheet.
9. Boss rooms deliberately filter route platforms and hazards out, producing the same flat arena for every encounter. A flat room is appropriate for several fights, but the current system cannot author controlled boss-room dynamics when a design needs them.

## Production Decisions

- Use original project art for the ten final boss silhouettes. Do not ship ripped Mega Man/Capcom sprites.
- Prefer image generation plus deterministic cleanup/slicing for boss bodies. Downloads are acceptable for CC0/CC-BY effects or temporary reference only, with license metadata added before intake.
- Keep body art and effects separate. Fire, water, wind, magnetic trails, telegraphs, muzzle flashes, and impact effects must not be baked into every body frame.
- Author the canonical body facing east and mirror west at runtime. One locked facing value must drive sprite mirroring, muzzle anchors, melee hitboxes, and projectile velocity.
- Standardize final atlas cells at 64x64 where practical, with a shared foot baseline and per-boss collision/body profile. Large effects can live in separate atlases.
- Build one pilot completely before generating the whole roster. Sentinel Rook proves grounded movement/landing; Pyro Maw proves dash-through facing, projectile telegraphs, and persistent hazards.

## Target Runtime Shape

### 1. Typed movement intent

Replace `BossTickResult.movementDirection` with a typed movement intent while retaining a compatibility adapter during migration:

- `hold`
- `walk_to` / `retreat_from`
- `jump_to` / `hop_over`
- `dash_through`
- `hover_to`
- `dive_to`
- `teleport_to`
- `slam_to_floor`

Add a Phaser-edge `BossMotionController` responsible for gravity, launch velocities, landing detection, arena clamps, safe destinations, and motion completion. `BossBase` should select intent and attack strategy without directly manipulating Arcade bodies.

Grounded bosses use gravity and platform/floor collision. Only Tide Reaver, Gale Vixen, Mire Wraith during phase movement, and Omega Core may enter explicit hover states. Hovering must have target heights, transitions, and landing/reposition behavior rather than a permanently disabled-gravity body.

### 2. Attack timeline and strategy

Extend each attack definition with:

- `animation`: windup, active, recovery, optional landing group
- `facingPolicy`: `lock_at_windup`, `track_until_active`, or `movement_driven`
- `motion`: intent and parameters for the attack
- `events`: frame/normalized-time events for projectile, melee, hazard, and camera/FX triggers
- `strategyTags`: punish, gap-close, zoning, anti-air, escape, setup, finisher
- `requirements`: grounded, airborne, room clearance, player side, active-hazard cap

Attack selection should use distance, player height, player velocity, arena occupancy, recent attacks, and current hazards. Preserve weighted choice, cooldowns, phase unlocks, and anti-repeat, but filter candidates through these tactical requirements.

### 3. Authoritative facing

At attack windup, resolve and store `attackFacing`. That value remains fixed through active frames unless the attack explicitly tracks. Use it for:

- `sprite.flipX`
- muzzle and effect anchors
- melee hitbox origin
- projectile direction/angle
- dash destination
- automation traces

Do not derive attack facing from current velocity. A boss can retreat, cross the player, or stop without its weapon firing backward.

### 4. Boss animator

Add a `BossAnimator` adapter with one action key at a time and animation-event callbacks. It consumes movement/attack state and refuses silent fallback for required production groups.

Minimum shared groups:

- `intro`, `idle`, `turn`, `walk` or `hover`
- `jump_start`, `jump_rise`, `jump_apex`, `fall`, `land`
- attack-specific windup/active/recovery groups
- `hurt`, `phase`, `defeat`

Not every boss needs every locomotion group. Atlas validation should derive the required set from its movement archetype and attack definitions.

### 5. Boss-room profiles

Extend `StageBossRoomDefinition` with an optional room profile containing boss-only platforms, anchor points, and bounded dynamic hazards. The default remains a safe flat room.

Room dynamics must be telegraphed, capped, and cleared on death/respawn. They should reinforce the boss rather than become unrelated stage hazards.

## Boss-by-Boss Fight Direction

| Boss | Movement identity | Core pattern and player decision | Required art/actions |
| --- | --- | --- | --- |
| Sentinel Rook | Grounded heavy with short committed hops | Guard Shot at range, hop over/onto player, Stomp Shock only on landing. Teaches shoot windows and dash-under timing. | idle, guard, shoot, jump phases, stomp fall, land, hurt, defeat |
| Pyro Maw | Grounded serpentine slide and dash-through | Stream controls a lane, Blaze Lob arcs over retreating players, Ignition Dash crosses the room and leaves a capped burn trail. Jump the dash or move before the lob lands. | coil idle, stream windup/fire, lob, dash start/loop/brake, hurt, defeat |
| Tide Reaver | Intentional hover with regular landing/reset | Levitate to one of three height anchors, aim Lance Volley from the air, then telegraph Riptide Crash to the floor. Move beneath volleys, then clear the dive zone. | hover, rise, aim, lance recoil, dive, splash-land, hurt, defeat |
| Volt Hopper | Fast chain hops with short ground pauses | Capacitor hop drops mines, Rail Shot punishes vertical alignment, Impulse Dash escapes corners. Read landing position and avoid being boxed by mines. | crouch, jump phases, mine drop, rail shot, dash, land, hurt, defeat |
| Basalt Titan | Grounded heavy, slow walk, armored commitment | Fault Punch gap-closes, Barrage raises limited pillars, Crustquake follows a short hop/slam. Bait a commitment and punish recovery. | heavy walk, brace, punch rush, pillar summon, hop/slam/land, armor hurt, defeat |
| Ferro Blade | Fast ground dash plus authored teleport anchors | Vector Slice crosses once, Mag Disc returns as a boomerang, Polar Snare restricts a zone. Track the disc while repositioning away from the snare. | idle, vanish/reappear, slice, throw/catch, summon, hurt, defeat |
| Mire Wraith | Low slide with temporary phase/hover transitions | Toxic Slide leaves a short trail, Glob Lob attacks predicted position, Bloom creates one or two vapor pods. Keep moving without filling the whole room. | ooze idle, phase fade, slide, throw, summon, reform, hurt, defeat |
| Gale Vixen | Deliberate aerial mobility and wall/height anchors | Aero Volley covers angles, Turbine Slice dashes through air, Cyclone Lift changes the safe lane. Alternate ground and air routes instead of permanent floating. | hover, wall launch, aerial dash, volley, lift cast, land, hurt, defeat |
| Glacier Ronin | Grounded spacing and counter-style slide | Glacier Slide changes sides, Frost Draw is a readable close cone, Shard Rain marks floor lanes before falling. Punish the draw recovery and move out of marked lanes. | stance idle, slide, draw/slash, summon, sheath/recover, hurt, defeat |
| Omega Core | Intentional hover at authored anchors with phase scripts | Phase 1 tests projectile movement, Phase 2 adds armored rams, Phase 3 runs a controlled cascade sequence. Use deterministic pattern decks, not unrestricted random spam. | existing original base plus hover, charge, volley, ram, pulse, phase transforms, defeat |

## Implementation Sequence

### Step 0 — Lock measurable contracts

- Add animation-group coverage validation for every boss atlas.
- Extend `render_game_to_text().bossState.runtime` with body Y/VY, grounded/airborne, motion intent, attack lifecycle phase, locked facing, animation key/frame, and active hazard count.
- Extend the visual sweep to capture windup, active, recovery/landing, and direction reversal—not only a generic boss-room screenshot.
- Add deterministic boss RNG injection for repeatable tests and pattern playback.

Exit gate: current defects are visible as failing assertions without changing fight behavior.

### Step 1 — Build motion, animation, and event foundations

- Add `BossMotionController`, `BossAnimator`, and attack event timelines as typed modules outside `Game.ts`.
- Enable gravity for grounded archetypes and use the existing platform collision system.
- Add safe jump/dash destination resolution within boss-room bounds and below the gameplay ceiling.
- Lock facing at attack commit and route every spawn/hitbox through the same facing/anchor snapshot.
- Keep existing projectile and damage pipelines; replace only their boss-origin/action inputs.

Exit gate: a test fixture can walk, jump, land, dash through, face correctly, and emit one event at the authored frame at 30 and 60 fps.

### Step 2 — Sentinel Rook vertical slice

- Create a distinct original 64x64 Sentinel sheet with the required groups.
- Implement Giga Hop as a real parabolic jump, Guard Shot as a grounded aimed shot, and Stomp Shock as a landing event.
- Add readable telegraphs and recovery windows.
- Validate the tutorial fight manually and through a dedicated browser scenario.

Exit gate: Sentinel is grounded when idle, uses all three attacks, cannot float, never fires backward, and teaches a reproducible dodge/punish loop.

### Step 3 — Pyro Maw production slice

- Create a distinct serpentine Pyro sheet instead of another humanoid recolor.
- Implement stream cadence, arcing lob behavior, dash-through motion, burn-puddle lifetime/cap, and attack-facing lock.
- Add screenshot and trace assertions for east/west stream shots and both dash directions.

Exit gate: the exact screenshot failure is gone; Pyro reads as one grounded creature with a clear head/weapon direction and three strategically different attacks.

### Step 4 — Roll out shared primitives in pairs

1. Volt Hopper + Basalt Titan: grounded jumps, landing attacks, mines/pillars.
2. Glacier Ronin + Ferro Blade: dash/slide, boomerang, marked zones, teleport anchors.
3. Tide Reaver + Gale Vixen: height anchors, aerial dash/dive, intentional landing/reset.
4. Mire Wraith + Omega Core: phase movement, capped persistent hazards, scripted phase decks.

For each pair: generate/import art, validate atlas coverage, implement attacks, add one logic test per primitive, one focused smoke scenario per boss, and inspect visual artifacts before moving on.

### Step 5 — Add restrained arena dynamics

- Preserve flat rooms for Sentinel, Pyro, Volt, and Glacier.
- Basalt may create temporary pillars; Ferro uses fixed teleport/snare anchors; Tide/Gale use height anchors; Mire uses capped vapor zones; Omega changes anchor/pattern rules by phase.
- Add cleanup on boss death, player death, scene shutdown, and checkpoint restore.

Exit gate: room state never leaks across retries and every dynamic has an obvious telegraph and safe response.

### Step 6 — Full polish and release gate

- Standardize palette readability, scale, foot baselines, hit flashes, shadows, and death effects.
- Add a subtle ground shadow for grounded/airborne depth reading; shrink/fade it by height.
- Verify muzzle flashes and projectiles originate from the weapon side in both directions.
- Run unit tests, build, sprite validation, full smoke, production-preview smoke, and ten-mission visual sweep.
- Perform manual no-damage readability passes for every boss and record unavoidable hits or ambiguous tells as blockers.

## Test Matrix

- Pure tests: movement intent selection, parabolic launch solving, landing events, safe destination clamps, pattern deck/anti-repeat, facing lock, event-once timing, room hazard caps/cleanup.
- Atlas tests: required group existence, non-empty alpha bounds, common foot baseline, distinct-frame hash threshold, declared FPS/frame count, action anchor coverage.
- Browser tests per boss: intro unlock, two directional attacks, jump/hover/land path, phase transition, hurt/defeat, retry cleanup.
- Cross-mission sweep: one visible boss, correct atlas/config identity, grounded or explicitly hovering state, at least two attack IDs, attack animation matching active attack, projectile direction matching locked facing, no ceiling/room escape.
- Feel review: each attack must have a visible tell, a consistent dodge response, a punish/recovery window, and bounded simultaneous hazards.

## Token- and Risk-Efficient Execution

- Do not generate ten complete sheets before the runtime contract is proven.
- Reuse movement primitives and event timelines; keep boss uniqueness in data, animation, projectile/hazard behavior, and pattern composition.
- Make Sentinel and Pyro the supervised approval checkpoints. Their implementation decides the final body scale, outline style, palette density, animation timing, and atlas layout.
- Generate one contact sheet, slice it deterministically, inspect it in-game, and revise before generating the next boss.
- Keep each boss or shared primitive in a reviewable commit-sized package with its own focused browser evidence.

## Recommended First Implementation Package

Implement Step 0 and the typed foundation from Step 1, then finish Sentinel Rook only. This fixes the floating architecture and establishes the exact art/runtime contract without spending time generating nine sheets that may need to be redone. Pyro Maw should be the second supervised package because it directly covers the reported backward-shot and low-quality silhouette problem.
