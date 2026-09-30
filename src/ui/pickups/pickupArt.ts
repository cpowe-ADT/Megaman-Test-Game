import type { LocationCheckCategory } from '../../progression/types'
import type { Difficulty } from '../../progression/types'

/**
 * Pickups v2 (prompt 13 part 13e, `EVAL-P13-009`): a second Higgsfield gpt_image_2 sheet replaces v1's tiny,
 * confusable set (health/energy shared one can silhouette, the sub tank read as a lantern, the capsule was
 * energy-cyan, the extra life was a dark blob nothing dropped). Cut by scripts/sprites/cut_vfx_sheet.py
 * (scripts/sprites/pickups_v2.json) bottom-aligned with no pad, so a frame's own height is exactly twice its
 * centre-to-art-bottom distance at `PICKUP_ART_SCALE` 1 (native; v1's runtime 0.6 shrink is gone, the art is
 * drawn at the size it should read at). Two frames per group (`pickups_v2/<group>/000-001`, 001 glows; cut_vfx
 * always shares one frame box per group, so the glow never widens the sprite). Provenance:
 * assets/ui/source/pickups_v2_a.png (job 141b288e-d586-4c03-8919-0936fc3970fc), prompt in
 * assets/ui/source/ui_v2.prompts.md, licence `original-generated`; `assets/sprites/source/free-source-attribution.v1.json`.
 * A Game-scene resident atlas (`GAME_SCENE_ATLASES`); `PickupTextures.ts` draws the old code capsules only
 * when it is missing. Pure: no Phaser, so the tables are unit tested (tests/pickup-art.test.ts).
 */
export const PICKUPS_ATLAS = {
  key: 'atlas_pickups_v2',
  image: 'assets/sprites/pickups/pickups_v2/pickups_v2.png',
  data: 'assets/sprites/pickups/pickups_v2/pickups_v2.atlas.json'
} as const

export const PICKUP_ART_GROUPS = [
  'health_small',
  'health_large',
  'energy_small',
  'energy_large',
  'extra_life',
  'heart_tank',
  'sub_tank',
  'capsule',
  'bonus'
] as const
export type PickupArtGroup = (typeof PICKUP_ART_GROUPS)[number]

/** What a defeated enemy leaves: small health, large health (every mini-boss), weapon energy, the mixed bonus, or a rare extra life. */
export type EnemyDropType = 'health' | 'health_large' | 'ammo' | 'bonus' | 'life'
export const ENEMY_DROP_TYPES: readonly EnemyDropType[] = ['health', 'health_large', 'ammo', 'bonus', 'life']

export const DROP_ART: Record<EnemyDropType, PickupArtGroup> = {
  health: 'health_small',
  health_large: 'health_large',
  ammo: 'energy_small',
  // Part 13e: the bonus (1 HP and 3 energy) now wears its own gold star-burst instead of energy_large's hue.
  bonus: 'bonus',
  life: 'extra_life'
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

/** Part 13e: native size, no runtime shrink. The v2 cut already trims each frame to its final on-screen size. */
export const PICKUP_ART_SCALE = 1
/** The two frames alternate at this rate. */
export const PICKUP_FRAME_RATE = 4
/** Placed pickups (no gravity) float this many pixels up and back. */
export const PICKUP_BOB_PX = 2
export const PICKUP_BOB_MS = 700

export function pickupFrame(group: PickupArtGroup, index: 0 | 1 = 0): string {
  return `pickups_v2/${group}/${index === 1 ? '001' : '000'}`
}

export function pickupAnimationKey(group: PickupArtGroup): string {
  return `pickup_${group}`
}

/** The extra-life slice of the roll, taken from the pool that would otherwise drop nothing (part 13e, EVAL-P13-010). */
const LIFE_DROP_CHANCE: Record<Difficulty, number> = { assist: 0.04, normal: 0.02, veteran: 0.02 }

/**
 * An ordinary enemy's drop for a roll in [0, 1): health/ammo/bonus keep the pre-12h odds (nothing above
 * 0.45); a life is a further 2% (Normal/Veteran) or 4% (Assist) carved from that same "nothing" remainder,
 * so the original four boundaries below 0.45 never move.
 */
export function rollEnemyDrop(roll: number, difficulty: Difficulty = 'normal'): EnemyDropType | null {
  if (roll < 0.18) return 'health'
  if (roll < 0.33) return 'ammo'
  if (roll < 0.45) return 'bonus'
  if (roll < 0.45 + LIFE_DROP_CHANCE[difficulty]) return 'life'
  return null
}
