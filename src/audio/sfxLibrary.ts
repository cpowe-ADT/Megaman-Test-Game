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
  | 'enemy_hit'
  | 'boss_hit'
  | 'boss_activate'
  | 'stage_clear'
  | 'game_over'

export type SfxAssetDefinition = {
  key: SfxAssetKey
  path: string
  volume: number
  rate?: number
  detune?: number
}

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
  enemy_hit: { key: 'enemy_hit', path: 'assets/audio/sfx/enemy_hit.ogg', volume: 0.24 },
  boss_hit: { key: 'boss_hit', path: 'assets/audio/sfx/boss_hit.ogg', volume: 0.28 },
  boss_activate: { key: 'boss_activate', path: 'assets/audio/sfx/boss_activate.ogg', volume: 0.28 },
  stage_clear: { key: 'stage_clear', path: 'assets/audio/sfx/stage_clear.ogg', volume: 0.28 },
  game_over: { key: 'game_over', path: 'assets/audio/sfx/game_over.ogg', volume: 0.28 }
}

export function getSfxAssetEntries(): SfxAssetDefinition[] {
  return Object.values(SFX_ASSETS)
}
