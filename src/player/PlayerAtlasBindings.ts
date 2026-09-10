export type PlayerAtlasBinding = {
  prefixes: string[]
  start?: number
  end?: number
}

const SLASH_FRAME_END = 3

const DIRECT_BINDINGS: Record<string, PlayerAtlasBinding> = {
  player_idle: { prefixes: ['player_main/idle/'], start: 0, end: 3 },
  player_idle_blink: { prefixes: ['player_main/idle/'], start: 2, end: 3 },
  player_turn: { prefixes: ['player_main/turn/'], start: 0, end: 0 },
  player_run: { prefixes: ['player_main/run/'], start: 0, end: 5 },
  player_run_start: { prefixes: ['player_main/run/'], start: 0, end: 1 },
  player_run_stop: { prefixes: ['player_main/run/'], start: 4, end: 5 },
  player_crouch_in: { prefixes: ['player_main/crouch_in/'], start: 0, end: 0 },
  player_crouch_hold: { prefixes: ['player_main/crouch_hold/'], start: 0, end: 0 },
  player_crouch_out: { prefixes: ['player_main/crouch_out/'], start: 0, end: 0 },
  player_jump_start: { prefixes: ['player_main/jump_start/'], start: 0, end: 0 },
  player_jump_rise: { prefixes: ['player_main/jump_rise/'], start: 0, end: 0 },
  player_jump_apex: { prefixes: ['player_main/jump_apex/'], start: 0, end: 0 },
  player_fall: { prefixes: ['player_main/fall/'], start: 0, end: 0 },
  player_wall_slide: { prefixes: ['player_main/wall_slide/'], start: 0, end: 0 },
  player_wall_jump: { prefixes: ['player_main/wall_jump/'], start: 0, end: 0 },
  player_land: { prefixes: ['player_main/land/'], start: 0, end: 0 },
  player_dash_start: { prefixes: ['player_main/dash_start/'], start: 0, end: 0 },
  player_dash_loop: { prefixes: ['player_main/dash_loop/'], start: 0, end: 0 },
  player_dash_end: { prefixes: ['player_main/dash_end/'], start: 0, end: 0 },
  player_airdash_start: { prefixes: ['player_main/airdash_start/'], start: 0, end: 0 },
  player_airdash_loop: { prefixes: ['player_main/airdash_loop/'], start: 0, end: 0 },
  player_airdash_end: { prefixes: ['player_main/airdash_end/'], start: 0, end: 0 },
  player_shoot_stand_fwd: { prefixes: ['player_main/shoot_ground/'], start: 0, end: 1 },
  player_shoot_run_fwd: { prefixes: ['player_main/shoot_run/'], start: 0, end: 1 },
  player_shoot_air_fwd: { prefixes: ['player_main/shoot_air/'], start: 0, end: 0 },
  player_shoot_dash_fwd: { prefixes: ['player_main/dash_shoot/'], start: 0, end: 0 },
  player_charge_start: { prefixes: ['player_main/charge_start/'], start: 0, end: 0 },
  player_charge_hold: { prefixes: ['player_main/charge_hold/'], start: 0, end: 1 },
  player_charge_release_lv1: { prefixes: ['player_main/charge_release_lv1/'], start: 0, end: 0 },
  player_charge_release_lv2: { prefixes: ['player_main/charge_release_lv2/'], start: 0, end: 0 },
  player_charge_release_lv3: { prefixes: ['player_main/charge_release_lv3/'], start: 0, end: 0 },
  player_charge_release_lv4: { prefixes: ['player_main/charge_release_lv4/'], start: 0, end: 0 },
  player_hurt_light: { prefixes: ['player_main/hurt_light/'], start: 0, end: 0 },
  player_hurt_heavy: { prefixes: ['player_main/hurt_heavy/'], start: 0, end: 0 },
  player_knockdown: { prefixes: ['player_main/knockdown/'], start: 0, end: 0 },
  player_getup: { prefixes: ['player_main/getup/'], start: 0, end: 0 },
  player_death: { prefixes: ['player_main/death/'], start: 0, end: 1 },
  player_respawn: { prefixes: ['player_main/respawn/'], start: 0, end: 2 }
}

const GROUND_SLASH_GROUPS: Record<string, string> = {
  n: 'slash_ground_n',
  ne: 'slash_ground_ne',
  e: 'slash_ground_e',
  se: 'slash_ground_se',
  s: 'slash_ground_s',
  sw: 'slash_ground_se',
  w: 'slash_ground_e',
  nw: 'slash_ground_ne'
}

const AIR_SLASH_GROUPS: Record<string, string> = {
  n: 'slash_air_n',
  ne: 'slash_air_ne',
  e: 'slash_air_e',
  se: 'slash_air_se',
  s: 'slash_air_s',
  sw: 'slash_air_se',
  w: 'slash_air_e',
  nw: 'slash_air_ne'
}

export function resolvePlayerAtlasBinding(animationKey: string): PlayerAtlasBinding {
  const direct = DIRECT_BINDINGS[animationKey]
  if (direct) {
    return direct
  }

  if (animationKey.startsWith('player_slash_ground_')) {
    const dir = animationKey.slice('player_slash_ground_'.length)
    const group = GROUND_SLASH_GROUPS[dir] ?? GROUND_SLASH_GROUPS.e
    return { prefixes: [`player_main/${group}/`], start: 0, end: SLASH_FRAME_END }
  }

  if (animationKey.startsWith('player_slash_air_')) {
    const dir = animationKey.slice('player_slash_air_'.length)
    const group = AIR_SLASH_GROUPS[dir] ?? AIR_SLASH_GROUPS.e
    return { prefixes: [`player_main/${group}/`], start: 0, end: SLASH_FRAME_END }
  }

  return { prefixes: ['player_main/idle/'], start: 0, end: 0 }
}

export function getRequiredPlayerAtlasPrefixes(): string[] {
  const prefixes = new Set<string>()
  Object.values(DIRECT_BINDINGS).forEach((binding) => binding.prefixes.forEach((prefix) => prefixes.add(prefix)))
  Object.values(GROUND_SLASH_GROUPS).forEach((group) => prefixes.add(`player_main/${group}/`))
  Object.values(AIR_SLASH_GROUPS).forEach((group) => prefixes.add(`player_main/${group}/`))
  return [...prefixes].sort()
}
