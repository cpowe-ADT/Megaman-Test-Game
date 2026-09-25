/**
 * Boss arena hazards (prompt 07 phase 7.1, EVAL-P7-001; prompt 12 part 12f wave 4): `charge_mine`, `vapor_pod`,
 * `ground_shockwave`, `stone_pillar`, `tornado_pillar`, `splash_pillar`, `burn_puddle`, `acid_trail`, four frames
 * each (`hazards_v1/<group>/000-003`), bottom-aligned so a hazard's base stays on the floor while it grows.
 * Higgsfield art (`assets/sprites/source/vfx/hf_v1/vfx_hf_v1.prompts.md`), loaded by the Game scene with its
 * resident atlases (`src/scenes/game/stageBackgroundLoading.ts`).
 */
export const HAZARDS_ATLAS = {
  key: 'atlas_hazards_v1',
  image: 'assets/sprites/effects/hazards_v1/hazards_v1.png',
  data: 'assets/sprites/effects/hazards_v1/hazards_v1.atlas.json'
} as const

export const HAZARD_ART_GROUPS = [
  'charge_mine',
  'vapor_pod',
  'ground_shockwave',
  'stone_pillar',
  'tornado_pillar',
  'splash_pillar',
  'burn_puddle',
  'acid_trail'
] as const

export type HazardArtGroup = (typeof HAZARD_ART_GROUPS)[number]

export function hazardFrame(group: HazardArtGroup, index: number): string {
  return `hazards_v1/${group}/${String(Math.max(0, Math.min(3, Math.floor(index)))).padStart(3, '0')}`
}
