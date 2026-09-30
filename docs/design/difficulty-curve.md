# The warden curve

Part 13c (`EVAL-P13-006`, `EVAL-P6-012`). Craig's first-boss note ("the first boss fight should be a bit
easier") landed as a Rook-specific rebalance (`src/bosses/roster.ts`, `docs/prompts/13-polish-from-playtest.md`
part 13c). This doc checks the ramp that rebalance sits inside: every warden's time to kill and damage
output, measured from the roster's own numbers by `scripts/content/warden-curve.mjs`, not guessed.

## Method

- **Time to kill** is the Normal reference model already used elsewhere (`estimateNormalClearSeconds`,
  `src/boss/phaseKit.ts`): `maxHp / 1.6 HP/s`. The same model the roster's own tests hold every boss to
  (`tests/boss-phase-kits.test.ts`), and the one the 13c Decision used for Rook's own number ("about 38s").
- **Damage per minute to an idle hero** averages, over every phase-one attack, that attack's hit damage
  (the hitbox's own `damage` if authored, else the same per-state default `BossController` uses for
  contact) divided by a full telegraph-to-ready cycle (`telegraphMs + executeMs + cooldownMs`), scaled to
  a minute. An idle hero takes every attack the instant it is ready, so this is a ceiling, not a played
  number: it ranks bosses against each other, it does not predict a real run's damage taken.
- Regenerate with `node --import ./tools/register-ts-loader.mjs scripts/content/warden-curve.mjs --write`.

## The table

<!-- warden-curve:start -->
| Boss | Role | HP | Time to kill (Normal ref, 1.6 HP/s) | Damage/min to an idle hero (phase one) | Contact |
| --- | --- | --- | --- | --- | --- |
| sentinel_rook | tutorial | 60 | 37.5s | 46 | 1 |
| pyro_maw | warden | 120 | 75s | 52.1 | 2 |
| tide_reaver | warden | 120 | 75s | 48.3 | 2 |
| volt_hopper | warden | 116 | 72.5s | 83 | 2 |
| basalt_titan | warden | 132 | 82.5s | 58.8 | 2 |
| ferro_blade | warden | 116 | 72.5s | 66.4 | 2 |
| mire_wraith | warden | 116 | 72.5s | 64.7 | 2 |
| gale_vixen | warden | 112 | 70s | 80 | 2 |
| glacier_ronin | warden | 120 | 75s | 63.3 | 2 |
| omega_core | final | 140 | 87.5s | 59.9 | 2 |
<!-- warden-curve:end -->

## Reading the ramp

- **Time to kill** ramps cleanly: Rook 37.5s (tutorial, below every warden by design, 13c), then every
  warden sits in a tight 70 to 82.5s band, Omega Core highest at 87.5s (final, by design). No warden
  breaks this band; it is the metric the 13c Decision itself used for Rook's own number ("about 38s").
- **Damage/min to an idle hero** is noisier: it does not climb warden-to-warden in campaign order (Pyro
  Maw 52.1, then Tide Reaver *drops* to 48.3; Volt Hopper then jumps to 83, the highest figure in the
  table, above even Omega Core's 59.9). Two wardens sit well above the rest: **Volt Hopper (83)** and
  **Gale Vixen (80)**.
- Pyro Maw, the first warden in campaign order, still reads as a clear step up from Rook on both columns
  (confirmed in `tests/boss-phase-kits.test.ts`'s clear-time test), which is the comparison the 13c
  Decision named explicitly.
- Omega Core (final) is excluded from the retune pass below: its HP and pattern are a finale by design,
  not a rung on the regular warden ladder.

## Retunes

None beyond Rook's own 13c numbers (`src/bosses/roster.ts`, `EVAL-P13-006`).

Volt Hopper and Gale Vixen's damage/min are flagged, not retuned. The model here averages each phase-one
attack's damage over its own full cycle with equal weight; it cannot see telegraph readability, projectile
speed, room size or how often the boss AI actually picks a fast low-damage poke over a slow heavy one, any
of which could make a high raw number read as perfectly fair in a played fight (or could not). Changing a
shipped warden's numbers on this heuristic alone, without Craig asking about either fight the way he asked
about Rook's, would be re-balancing by a rough score rather than by evidence. The right next step is 6.8's
telemetry (real deaths and damage taken per segment, part 13c item 4) or a playtest note naming one of
these two fights specifically; either would confirm or clear the flag. Recorded here so the next pass does
not have to recompute it.
