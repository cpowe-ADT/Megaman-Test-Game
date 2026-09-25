import type { LocationCheckCategory } from '../../progression/types'

/**
 * Pickups v1 (prompt 12 part 12h): original Higgsfield art cut by scripts/sprites/cut_vfx_sheet.py
 * (scripts/sprites/pickups_v1.json), two frames per group (`pickups_v1/<group>/000-001`, the second glows).
 * A Game-scene resident atlas (`GAME_SCENE_ATLASES`); `PickupTextures.ts` draws the old code capsules only
 * when it is missing. Pure: no Phaser, so the tables are unit tested (tests/pickup-art.test.ts).
 */
export const PICKUPS_ATLAS = {
  key: 'atlas_pickups_v1',
  image: 'assets/sprites/pickups/pickups_v1/pickups_v1.png',
  data: 'assets/sprites/pickups/pickups_v1/pickups_v1.atlas.json'
} as const

export const PICKUP_ART_GROUPS = [
  'health_small',
  'health_large',
  'energy_small',
  'energy_large',
  'extra_life',
  'heart_tank',
  'sub_tank',
  'capsule'
] as const
export type PickupArtGroup = (typeof PICKUP_ART_GROUPS)[number]

/** What a defeated enemy leaves: small health, large health (every mini-boss), weapon energy, or the mixed bonus. */
export type EnemyDropType = 'health' | 'health_large' | 'ammo' | 'bonus'
export const ENEMY_DROP_TYPES: readonly EnemyDropType[] = ['health', 'health_large', 'ammo', 'bonus']

export const DROP_ART: Record<EnemyDropType, PickupArtGroup> = {
  health: 'health_small',
  health_large: 'health_large',
  ammo: 'energy_small',
  // No group is a mixed refill; the bonus (1 HP and 3 energy) was the larger gold core before 12h.
  bonus: 'energy_large'
}

/**
 * A stage's placed pickups draw by location category, as before 12h. The classic seed puts a large health
 * refill in every `pickup_bonus` location (src/progression/seed.ts), so it draws as one.
 */
export const LOCATION_ART: Record<Exclude<LocationCheckCategory, 'boss_clear'>, PickupArtGroup> = {
  capsule: 'capsule',
  heart_tank: 'heart_tank',
  sub_tank: 'sub_tank',
  pickup_bonus: 'health_large'
}

/** One scale for every group keeps the sheet's relative sizes (a small capsule is 11x24px of art, drawn about 7x14). */
export const PICKUP_ART_SCALE = 0.6
/** The two frames alternate at this rate. */
export const PICKUP_FRAME_RATE = 4
/** Placed pickups (no gravity) float this many pixels up and back. */
export const PICKUP_BOB_PX = 2
export const PICKUP_BOB_MS = 700

export function pickupFrame(group: PickupArtGroup, index: 0 | 1 = 0): string {
  return `pickups_v1/${group}/${index === 1 ? '001' : '000'}`
}

export function pickupAnimationKey(group: PickupArtGroup): string {
  return `pickup_${group}`
}

/** An ordinary enemy's drop for a roll in [0, 1): nothing above 0.45, the pre-12h odds. */
export function rollEnemyDrop(roll: number): EnemyDropType | null {
  if (roll > 0.45) {
    return null
  }
  return roll < 0.18 ? 'health' : roll < 0.33 ? 'ammo' : 'bonus'
}
