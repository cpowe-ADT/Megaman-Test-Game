import { EnemyAnimationEntry, EnemyAnimationKeys } from './types'
import { EnemyCatalog } from './EnemyCatalog'

type RequiredSuffix = 'idle' | 'move' | 'attack_windup' | 'attack_active' | 'hurt' | 'death'
type OptionalSuffix = 'hover' | 'spawn' | 'turn' | 'stunned' | 'explode'
type AnimationSuffix = RequiredSuffix | OptionalSuffix

// Always present: `EnemyAnimationKeys`' non-optional fields. `hover`, `spawn`, `turn`, `stunned` and
// `explode` are its optional fields, so a family gets that entry only when its own `animations` map
// actually names it (12c: "the animation manifest is per family... frames that exist, or dropped").
// Today that is `hover` for the turret/drone/flyer families whose `move` slot points at it, and
// `stunned` for the families with a dedicated stunned pose; nothing yet names `spawn`, `turn` or
// `explode`, so every family drops all three rather than carry dead, alias-covered entries.
const REQUIRED_SUFFIXES: RequiredSuffix[] = ['idle', 'move', 'attack_windup', 'attack_active', 'hurt', 'death']
const OPTIONAL_SUFFIXES: OptionalSuffix[] = ['hover', 'spawn', 'turn', 'stunned', 'explode']

function buildEntry(base: string, suffix: AnimationSuffix, frameRate: number | undefined): EnemyAnimationEntry {
  const key = `${base}_${suffix}`
  switch (suffix) {
    case 'idle':
      return { key, frameRate: frameRate ?? 6, repeat: -1, frameStart: 0, frameEnd: 1, events: [] }
    case 'move':
      return {
        key,
        frameRate: frameRate ?? 8,
        repeat: -1,
        frameStart: 0,
        frameEnd: 3,
        events: [{ frame: 1, event: 'footstep' }]
      }
    case 'hover':
      return { key, frameRate: frameRate ?? 8, repeat: -1, frameStart: 0, frameEnd: 3, events: [] }
    case 'attack_windup':
      return {
        key,
        frameRate: frameRate ?? 10,
        repeat: 0,
        frameStart: 0,
        frameEnd: 2,
        events: [{ frame: 1, event: 'play_sfx', payload: { key: 'enemy_windup' } }]
      }
    case 'attack_active':
      return {
        key,
        frameRate: frameRate ?? 12,
        repeat: 0,
        frameStart: 0,
        frameEnd: 2,
        events: [
          { frame: 0, event: 'enable_hitbox' },
          { frame: 1, event: 'spawn_projectile' },
          { frame: 2, event: 'disable_hitbox' }
        ]
      }
    case 'hurt':
      return {
        key,
        frameRate: frameRate ?? 12,
        repeat: 0,
        frameStart: 0,
        frameEnd: 0,
        events: [{ frame: 0, event: 'spawn_vfx', payload: { key: 'hit_spark' } }]
      }
    case 'death':
      return {
        key,
        frameRate: frameRate ?? 14,
        repeat: 0,
        frameStart: 0,
        frameEnd: 3,
        events: [{ frame: 0, event: 'spawn_vfx', payload: { key: 'enemy_death' } }]
      }
    case 'spawn':
      return {
        key,
        frameRate: frameRate ?? 10,
        repeat: 0,
        frameStart: 0,
        frameEnd: 2,
        events: [{ frame: 0, event: 'play_sfx', payload: { key: 'enemy_spawn' } }]
      }
    case 'turn':
      return { key, frameRate: frameRate ?? 8, repeat: 0, frameStart: 0, frameEnd: 1, events: [] }
    case 'stunned':
      return { key, frameRate: frameRate ?? 6, repeat: -1, frameStart: 0, frameEnd: 1, events: [] }
    case 'explode':
    default:
      return {
        key,
        frameRate: frameRate ?? 16,
        repeat: 0,
        frameStart: 0,
        frameEnd: 3,
        events: [{ frame: 1, event: 'spawn_vfx', payload: { key: 'boom' } }]
      }
  }
}

/** The optional suffixes `base`'s own animation map actually points at (e.g. `move: '${base}_hover'`). */
function referencedOptionalSuffixes(base: string, animations: EnemyAnimationKeys): Set<OptionalSuffix> {
  const prefix = `${base}_`
  const referenced = new Set<OptionalSuffix>()
  for (const value of Object.values(animations)) {
    if (typeof value === 'string' && value.startsWith(prefix)) {
      const suffix = value.slice(prefix.length) as OptionalSuffix
      if ((OPTIONAL_SUFFIXES as readonly string[]).includes(suffix)) {
        referenced.add(suffix)
      }
    }
  }
  return referenced
}

function createSet(
  base: string,
  animations: EnemyAnimationKeys,
  frameRates: Partial<Record<AnimationSuffix, number>> = {}
): EnemyAnimationEntry[] {
  const referenced = referencedOptionalSuffixes(base, animations)
  const suffixes: AnimationSuffix[] = [
    ...REQUIRED_SUFFIXES,
    ...OPTIONAL_SUFFIXES.filter((suffix) => referenced.has(suffix))
  ]
  return suffixes.map((suffix) => buildEntry(base, suffix, frameRates[suffix]))
}

// Mini-boss (atlas custodian_walker, 64px frames): a heavy walk, a 500 ms leg-raise tell (three frames
// at 6 fps), a 250 ms stomp and four death frames over 500 ms (CUSTODIAN_TUNING). 12c: the walker's
// skins keep its timings; the relay nest's barrel glows over 600 ms (three wind-up frames at 5 fps; the
// mortar plays them faster); the sentry twin's hover frames trail speed lines (the swoop) and its lens
// crackles over 600 ms; the drill serpent coils over 500 ms (three frames at 6 fps) and lunges over
// 450 ms. Every death is four frames over 500 ms.
const FRAME_RATE_OVERRIDES: Record<string, Partial<Record<AnimationSuffix, number>>> = {
  custodian_walker: { idle: 5, move: 6, attack_windup: 6, attack_active: 12, death: 8 },
  custodian_walker_basalt: { idle: 5, move: 6, attack_windup: 6, attack_active: 12, death: 8 },
  custodian_walker_glacier: { idle: 5, move: 6, attack_windup: 6, attack_active: 12, death: 8 },
  relay_turret_nest: { idle: 5, move: 6, attack_windup: 5, attack_active: 12, death: 8 },
  relay_turret_nest_ferro: { idle: 5, move: 6, attack_windup: 5, attack_active: 12, death: 8 },
  sentry_twin: { idle: 6, move: 12, attack_windup: 5, attack_active: 10, death: 8 },
  sentry_twin_gale: { idle: 6, move: 12, attack_windup: 5, attack_active: 10, death: 8 },
  drill_serpent: { idle: 5, move: 8, attack_windup: 6, attack_active: 7, death: 8 }
}

/** Per family (the twelve base enemies, every mini-boss archetype and skin): built from the catalog's
 * own `animations` map, so an entry exists only when a family names it (12c). */
export const EnemyAnimationManifest: Record<string, EnemyAnimationEntry[]> = Object.fromEntries(
  Object.entries(EnemyCatalog).map(([typeKey, definition]) => [
    typeKey,
    createSet(typeKey, definition.animations, FRAME_RATE_OVERRIDES[typeKey] ?? {})
  ])
)
