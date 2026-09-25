export type SfxAssetKey =
  | 'ui_confirm'
  | 'ui_cancel'
  | 'ui_move'
  | 'pickup_health'
  | 'pickup_ammo'
  | 'pickup_bonus'
  | 'pause_open'
  | 'pause_resume'
  | 'jump'
  | 'land'
  | 'dash'
  | 'sword_swing'
  | 'sword_hit'
  | 'charge_start'
  | 'charge_loop'
  | 'shot_basic'
  | 'shot_charge_lv1'
  | 'shot_charge_lv2'
  | 'shot_charge_lv3'
  | 'shot_charge_lv4'
  | 'player_hit'
  | 'player_death'
  | 'enemy_hit'
  | 'boss_hit'
  | 'boss_hit_weak'
  | 'boss_activate'
  | 'boss_warning'
  | 'stage_clear'
  | 'game_over'
  | 'saber_combo_1'
  | 'saber_combo_2'
  | 'saber_combo_3'
  | 'saber_air_spin'
  | 'saber_reflect'
  | 'vent_arm'
  | 'vent_fire'
  | 'slag_rise'
  | 'wall_crack'
  | 'wall_break'
  | 'crumble_shake'
  | 'crumble_fall'
  | 'gate_open'
  | 'gate_close'
  | 'rail_arc'
  | 'rockfall'
  | 'icicle_shatter'
  | 'wind_gust'
  | 'miniboss_stomp'
  | 'miniboss_shockwave'

export type SfxAssetDefinition = {
  key: SfxAssetKey
  path: string
  volume: number
  rate?: number
  detune?: number
}

/** Rendered by scripts/audio/sfx-synth.mjs from assets/audio/sfx/generated/sfx-params.json (part 12h). */
const GENERATED = 'assets/audio/sfx/generated'

export const SFX_ASSETS: Record<SfxAssetKey, SfxAssetDefinition> = {
  ui_confirm: { key: 'ui_confirm', path: 'assets/audio/sfx/ui_confirm.ogg', volume: 0.3 },
  ui_cancel: { key: 'ui_cancel', path: 'assets/audio/sfx/ui_cancel.ogg', volume: 0.26 },
  ui_move: { key: 'ui_move', path: 'assets/audio/sfx/ui_move.ogg', volume: 0.18 },
  pickup_health: { key: 'pickup_health', path: 'assets/audio/sfx/pickup_health.ogg', volume: 0.26 },
  pickup_ammo: { key: 'pickup_ammo', path: 'assets/audio/sfx/pickup_ammo.ogg', volume: 0.24 },
  pickup_bonus: { key: 'pickup_bonus', path: 'assets/audio/sfx/pickup_bonus.ogg', volume: 0.28 },
  pause_open: { key: 'pause_open', path: 'assets/audio/sfx/pause_open.ogg', volume: 0.22 },
  pause_resume: { key: 'pause_resume', path: 'assets/audio/sfx/pause_resume.ogg', volume: 0.22 },
  jump: { key: 'jump', path: 'assets/audio/sfx/jump.wav', volume: 0.22 },
  land: { key: 'land', path: 'assets/audio/sfx/land.wav', volume: 0.2 },
  dash: { key: 'dash', path: 'assets/audio/sfx/dash.wav', volume: 0.2 },
  sword_swing: { key: 'sword_swing', path: 'assets/audio/sfx/sword_swing.wav', volume: 0.24 },
  sword_hit: { key: 'sword_hit', path: 'assets/audio/sfx/sword_hit.wav', volume: 0.24 },
  charge_start: { key: 'charge_start', path: 'assets/audio/sfx/charge_start.wav', volume: 0.22 },
  charge_loop: { key: 'charge_loop', path: 'assets/audio/sfx/charge_loop.wav', volume: 0.18 },
  shot_basic: { key: 'shot_basic', path: 'assets/audio/sfx/shot_basic.ogg', volume: 0.18 },
  shot_charge_lv1: { key: 'shot_charge_lv1', path: 'assets/audio/sfx/shot_charge_lv1.ogg', volume: 0.18 },
  shot_charge_lv2: { key: 'shot_charge_lv2', path: 'assets/audio/sfx/shot_charge_lv2.ogg', volume: 0.2 },
  shot_charge_lv3: { key: 'shot_charge_lv3', path: 'assets/audio/sfx/shot_charge_lv3.ogg', volume: 0.22 },
  shot_charge_lv4: { key: 'shot_charge_lv4', path: 'assets/audio/sfx/shot_charge_lv4.ogg', volume: 0.24 },
  player_hit: { key: 'player_hit', path: 'assets/audio/sfx/player_hit.ogg', volume: 0.26 },
  player_death: { key: 'player_death', path: `${GENERATED}/player_death.ogg`, volume: 0.26 },
  enemy_hit: { key: 'enemy_hit', path: 'assets/audio/sfx/enemy_hit.ogg', volume: 0.24 },
  boss_hit: { key: 'boss_hit', path: 'assets/audio/sfx/boss_hit.ogg', volume: 0.28 },
  boss_hit_weak: { key: 'boss_hit_weak', path: `${GENERATED}/boss_hit_weak.ogg`, volume: 0.26 },
  boss_activate: { key: 'boss_activate', path: 'assets/audio/sfx/boss_activate.ogg', volume: 0.28 },
  boss_warning: { key: 'boss_warning', path: `${GENERATED}/boss_warning.ogg`, volume: 0.24 },
  stage_clear: { key: 'stage_clear', path: 'assets/audio/sfx/stage_clear.ogg', volume: 0.28 },
  game_over: { key: 'game_over', path: 'assets/audio/sfx/game_over.ogg', volume: 0.28 },
  saber_combo_1: { key: 'saber_combo_1', path: `${GENERATED}/saber_combo_1.ogg`, volume: 0.22 },
  saber_combo_2: { key: 'saber_combo_2', path: `${GENERATED}/saber_combo_2.ogg`, volume: 0.22 },
  saber_combo_3: { key: 'saber_combo_3', path: `${GENERATED}/saber_combo_3.ogg`, volume: 0.25 },
  saber_air_spin: { key: 'saber_air_spin', path: `${GENERATED}/saber_air_spin.ogg`, volume: 0.22 },
  saber_reflect: { key: 'saber_reflect', path: `${GENERATED}/saber_reflect.ogg`, volume: 0.24 },
  vent_arm: { key: 'vent_arm', path: `${GENERATED}/vent_arm.ogg`, volume: 0.16 },
  vent_fire: { key: 'vent_fire', path: `${GENERATED}/vent_fire.ogg`, volume: 0.2 },
  slag_rise: { key: 'slag_rise', path: `${GENERATED}/slag_rise.ogg`, volume: 0.26 },
  wall_crack: { key: 'wall_crack', path: `${GENERATED}/wall_crack.ogg`, volume: 0.24 },
  wall_break: { key: 'wall_break', path: `${GENERATED}/wall_break.ogg`, volume: 0.28 },
  crumble_shake: { key: 'crumble_shake', path: `${GENERATED}/crumble_shake.ogg`, volume: 0.2 },
  crumble_fall: { key: 'crumble_fall', path: `${GENERATED}/crumble_fall.ogg`, volume: 0.22 },
  gate_open: { key: 'gate_open', path: `${GENERATED}/gate_open.ogg`, volume: 0.24 },
  gate_close: { key: 'gate_close', path: `${GENERATED}/gate_close.ogg`, volume: 0.26 },
  rail_arc: { key: 'rail_arc', path: `${GENERATED}/rail_arc.ogg`, volume: 0.16 },
  rockfall: { key: 'rockfall', path: `${GENERATED}/rockfall.ogg`, volume: 0.26 },
  icicle_shatter: { key: 'icicle_shatter', path: `${GENERATED}/icicle_shatter.ogg`, volume: 0.24 },
  wind_gust: { key: 'wind_gust', path: `${GENERATED}/wind_gust.ogg`, volume: 0.18 },
  miniboss_stomp: { key: 'miniboss_stomp', path: `${GENERATED}/miniboss_stomp.ogg`, volume: 0.28 },
  miniboss_shockwave: { key: 'miniboss_shockwave', path: `${GENERATED}/miniboss_shockwave.ogg`, volume: 0.26 }
}

/**
 * Strings the game passes to `playSfx` that are not sound keys, each mapped to a key or to `null` (silent on
 * purpose). Boss attack telegraphs arrive as the attack's display name (`BossProjectileController.onBossAttack`
 * through `BossBeats.playAttackSfx`); all of them are silent today, as they were before keys were checked.
 * `tests/audio-cue-map.test.ts` fails when the boss roster names an attack this table does not.
 */
export const SFX_ALIASES: Readonly<Record<string, SfxAssetKey | null>> = {
  'Giga Hop': null,
  'Guard Shot': null,
  'Stomp Shock': null,
  'Serpent Stream': null,
  'Ignition Dash': null,
  'Blaze Lob': null,
  'Jet Levitate': null,
  'Lance Volley': null,
  'Riptide Crash': null,
  'Capacitor Charge': null,
  'Rail Shot': null,
  'Impulse Dash': null,
  'Fault Punch': null,
  'Basalt Barrage': null,
  Crustquake: null,
  'Vector Slice': null,
  'Mag Disc': null,
  'Polar Snare': null,
  'Toxic Slide': null,
  'Glob Lob': null,
  'Toxic Bloom': null,
  'Turbine Slice': null,
  'Aero Volley': null,
  'Cyclone Lift': null,
  'Glacier Slide': null,
  'Frost Draw': null,
  'Shard Rain': null,
  'Directive Volley': null,
  'Lockdown Pulse': null,
  'Core Ram': null,
  'Override Cascade': null
}

export function isSfxAssetKey(key: string): key is SfxAssetKey {
  return Object.prototype.hasOwnProperty.call(SFX_ASSETS, key)
}

/**
 * The sound a `playSfx` string plays: a key, an alias's key, or `null` for a deliberate silence. An unknown
 * string throws when `strict` (development builds and smoke), so a typo or a new call site without its sound
 * fails loudly instead of playing nothing; production builds stay silent rather than crash.
 */
export function resolveSfxKey(key: string, strict: boolean): SfxAssetKey | null {
  if (isSfxAssetKey(key)) return key
  if (Object.prototype.hasOwnProperty.call(SFX_ALIASES, key)) return SFX_ALIASES[key] ?? null
  if (strict) {
    throw new Error(`[audio] unknown SFX key '${key}': add it to SFX_ASSETS (with a credited file) or SFX_ALIASES in src/audio/sfxLibrary.ts`)
  }
  return null
}

export function getSfxAssetEntries(): SfxAssetDefinition[] {
  return Object.values(SFX_ASSETS)
}
