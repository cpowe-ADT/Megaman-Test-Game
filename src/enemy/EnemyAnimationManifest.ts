import { EnemyAnimationEntry } from './types'

type AnimationSuffix = 'idle' | 'move' | 'attack_windup' | 'attack_active' | 'death'

function createSet(base: string, frameRates: Partial<Record<AnimationSuffix, number>> = {}): EnemyAnimationEntry[] {
  const entries: EnemyAnimationEntry[] = [
    {
      key: `${base}_idle`,
      frameRate: 6,
      repeat: -1,
      frameStart: 0,
      frameEnd: 1,
      events: []
    },
    {
      key: `${base}_move`,
      frameRate: 8,
      repeat: -1,
      frameStart: 0,
      frameEnd: 3,
      events: [{ frame: 1, event: 'footstep' }]
    },
    {
      key: `${base}_hover`,
      frameRate: 8,
      repeat: -1,
      frameStart: 0,
      frameEnd: 3,
      events: []
    },
    {
      key: `${base}_attack_windup`,
      frameRate: 10,
      repeat: 0,
      frameStart: 0,
      frameEnd: 2,
      events: [{ frame: 1, event: 'play_sfx', payload: { key: 'enemy_windup' } }]
    },
    {
      key: `${base}_attack_active`,
      frameRate: 12,
      repeat: 0,
      frameStart: 0,
      frameEnd: 2,
      events: [
        { frame: 0, event: 'enable_hitbox' },
        { frame: 1, event: 'spawn_projectile' },
        { frame: 2, event: 'disable_hitbox' }
      ]
    },
    {
      key: `${base}_hurt`,
      frameRate: 12,
      repeat: 0,
      frameStart: 0,
      frameEnd: 0,
      events: [{ frame: 0, event: 'spawn_vfx', payload: { key: 'hit_spark' } }]
    },
    {
      key: `${base}_death`,
      frameRate: 14,
      repeat: 0,
      frameStart: 0,
      frameEnd: 3,
      events: [{ frame: 0, event: 'spawn_vfx', payload: { key: 'enemy_death' } }]
    },
    {
      key: `${base}_spawn`,
      frameRate: 10,
      repeat: 0,
      frameStart: 0,
      frameEnd: 2,
      events: [{ frame: 0, event: 'play_sfx', payload: { key: 'enemy_spawn' } }]
    },
    {
      key: `${base}_turn`,
      frameRate: 8,
      repeat: 0,
      frameStart: 0,
      frameEnd: 1,
      events: []
    },
    {
      key: `${base}_stunned`,
      frameRate: 6,
      repeat: -1,
      frameStart: 0,
      frameEnd: 1,
      events: []
    },
    {
      key: `${base}_explode`,
      frameRate: 16,
      repeat: 0,
      frameStart: 0,
      frameEnd: 3,
      events: [{ frame: 1, event: 'spawn_vfx', payload: { key: 'boom' } }]
    }
  ]
  return entries.map((entry) => {
    const rate = frameRates[entry.key.slice(base.length + 1) as AnimationSuffix]
    return rate ? { ...entry, frameRate: rate } : entry
  })
}

const keys = [
  'enemy_gunner_bot',
  'enemy_rocket_bot',
  'enemy_slicer_bot',
  'enemy_armored_bot',
  'enemy_shock_hopper',
  'enemy_bouncer',
  'enemy_mine_bot',
  'enemy_frost_turret',
  'enemy_laser_eye',
  'enemy_drone',
  'enemy_shield_drone',
  'enemy_fly_trap'
] as const

export const EnemyAnimationManifest: Record<string, EnemyAnimationEntry[]> = {
  ...Object.fromEntries(keys.map((key) => [key, createSet(key)])),
  // Mini-boss (atlas custodian_walker, 64px frames): a heavy walk, a 500 ms leg-raise tell (three frames
  // at 6 fps), a 250 ms stomp and four death frames over 500 ms (CUSTODIAN_TUNING).
  custodian_walker: createSet('custodian_walker', { idle: 5, move: 6, attack_windup: 6, attack_active: 12, death: 8 }),
  // 12c: the walker's skins keep its timings; the relay nest's barrel glows over 600 ms (three wind-up
  // frames at 5 fps; the mortar plays them faster); the sentry twin's hover frames trail speed lines (the
  // swoop) and its lens crackles over 600 ms; the drill serpent coils over 500 ms (three frames at 6 fps)
  // and lunges over 450 ms. Every death is four frames over 500 ms.
  ...Object.fromEntries(
    (
      [
        ['custodian_walker_basalt', { idle: 5, move: 6, attack_windup: 6, attack_active: 12, death: 8 }],
        ['custodian_walker_glacier', { idle: 5, move: 6, attack_windup: 6, attack_active: 12, death: 8 }],
        ['relay_turret_nest', { idle: 5, move: 6, attack_windup: 5, attack_active: 12, death: 8 }],
        ['relay_turret_nest_ferro', { idle: 5, move: 6, attack_windup: 5, attack_active: 12, death: 8 }],
        ['sentry_twin', { idle: 6, move: 12, attack_windup: 5, attack_active: 10, death: 8 }],
        ['sentry_twin_gale', { idle: 6, move: 12, attack_windup: 5, attack_active: 10, death: 8 }],
        ['drill_serpent', { idle: 5, move: 8, attack_windup: 6, attack_active: 7, death: 8 }]
      ] as Array<[string, Partial<Record<AnimationSuffix, number>>]>
    ).map(([key, rates]) => [key, createSet(key, rates)])
  )
}
