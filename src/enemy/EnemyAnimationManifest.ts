import { EnemyAnimationEntry } from './types'

function createSet(base: string): EnemyAnimationEntry[] {
  return [
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

export const EnemyAnimationManifest: Record<string, EnemyAnimationEntry[]> = Object.fromEntries(
  keys.map((key) => [key, createSet(key)])
)
