import type { Direction8 } from './config'

export type AnimationEventMarker = {
  frame: number
  event: string
  payload?: Record<string, unknown>
}

export type AnimationManifestEntry = {
  key: string
  frameStart: number
  frameEnd: number
  frameRate: number
  repeat: number
  fallbackFrameKey: string
  events?: AnimationEventMarker[]
}

const base = (key: string, fallbackFrameKey: string, events?: AnimationEventMarker[]): AnimationManifestEntry => ({
  key,
  frameStart: 0,
  frameEnd: 0,
  frameRate: 1,
  repeat: key.includes('_loop') || key.includes('run') || key.includes('hold') || key.includes('idle') ? -1 : 0,
  fallbackFrameKey,
  events
})

const swordEntries = (prefix: 'player_slash_ground' | 'player_slash_air', fallback: string) => {
  const dirs: Direction8[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  return dirs.map((dir) => base(`${prefix}_${dir}`, fallback, [{ frame: 0, event: 'hitbox.enable', payload: { dir } }]))
}

const animationEntries: AnimationManifestEntry[] = [
  base('player_idle', 'player_idle_0'),
  base('player_idle_blink', 'player_idle_1'),
  base('player_turn', 'player_run_1'),
  base('player_run', 'player_run_0'),
  base('player_run_start', 'player_run_0'),
  base('player_run_stop', 'player_run_1'),
  base('player_crouch_in', 'player_slide'),
  base('player_crouch_hold', 'player_slide'),
  base('player_crouch_out', 'player_slide'),
  base('player_jump_start', 'player_jump'),
  base('player_jump_rise', 'player_jump'),
  base('player_jump_apex', 'player_jump'),
  base('player_fall', 'player_fall'),
  base('player_land', 'player_run_1'),

  base('player_dash_start', 'player_slide', [{ frame: 0, event: 'fx.spawn', payload: { key: 'dash_dust' } }]),
  base('player_dash_loop', 'player_slide'),
  base('player_dash_end', 'player_run_1'),
  base('player_airdash_start', 'player_slide', [{ frame: 0, event: 'fx.spawn', payload: { key: 'dash_dust' } }]),
  base('player_airdash_loop', 'player_slide'),
  base('player_airdash_end', 'player_fall'),

  base('player_shoot_stand_fwd', 'player_shoot', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_pellet' } }]),
  base('player_shoot_run_fwd', 'player_shoot', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_pellet' } }]),
  base('player_shoot_air_fwd', 'player_shoot_air', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_pellet' } }]),
  base('player_shoot_dash_fwd', 'player_shoot', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_pellet' } }]),
  base('player_charge_start', 'player_shoot'),
  base('player_charge_hold', 'player_shoot'),
  base('player_charge_release_lv1', 'player_shoot', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_charge_lv1' } }]),
  base('player_charge_release_lv2', 'player_shoot', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_charge_lv2' } }]),
  base('player_charge_release_lv3', 'player_shoot', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_charge_lv3' } }]),
  base('player_charge_release_lv4', 'player_shoot', [{ frame: 0, event: 'projectile.spawn', payload: { key: 'proj_charge_lv4' } }]),

  ...swordEntries('player_slash_ground', 'player_shoot'),
  ...swordEntries('player_slash_air', 'player_shoot_air'),

  base('player_hurt_light', 'player_hurt'),
  base('player_hurt_heavy', 'player_hurt'),
  base('player_knockdown', 'player_hurt'),
  base('player_getup', 'player_idle_0'),
  base('player_death', 'player_hurt'),
  base('player_respawn', 'player_idle_0')
]

export const AnimationManifest = {
  animations: Object.fromEntries(animationEntries.map((entry) => [entry.key, entry])) as Record<
    string,
    AnimationManifestEntry
  >,
  vfx: {
    fx_muzzle_small: { fallbackTexture: 'px' },
    fx_charge_aura_lv1: { fallbackTexture: 'px' },
    fx_charge_aura_lv2: { fallbackTexture: 'px' },
    fx_charge_aura_lv3: { fallbackTexture: 'px' },
    fx_charge_aura_lv4: { fallbackTexture: 'px' },
    fx_sword_trail_dir_any: { fallbackTexture: 'slash' },
    fx_hit_spark: { fallbackTexture: 'px' },
    fx_impact_small: { fallbackTexture: 'px' },
    fx_impact_charge_lv1: { fallbackTexture: 'px' },
    fx_impact_charge_lv2: { fallbackTexture: 'px' },
    fx_impact_charge_lv3: { fallbackTexture: 'px' },
    fx_impact_charge_lv4: { fallbackTexture: 'px' },
    dash_dust: { fallbackTexture: 'px' }
  },
  projectiles: {
    proj_pellet: { fallbackTexture: 'bullet_player' },
    proj_charge_lv1: { fallbackTexture: 'bullet_player' },
    proj_charge_lv2: { fallbackTexture: 'bullet_player' },
    proj_charge_lv3: { fallbackTexture: 'bullet_player' },
    proj_charge_lv4: { fallbackTexture: 'bullet_player' }
  }
} as const

export type AnimationManifestType = typeof AnimationManifest
