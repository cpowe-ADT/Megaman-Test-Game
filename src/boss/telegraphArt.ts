/**
 * Boss attack tells (prompt 07 phase 7.1; prompt 12 part 12f): `reticle`, `floor_marker`, `warning_flash`,
 * `charge_glow`, four frames each (`telegraphs_v1/<group>/000-003`), Higgsfield art cut in cbdac1e. Loaded by
 * the Game scene with its resident atlases (`src/scenes/game/stageBackgroundLoading.ts`).
 */
export const TELEGRAPHS_ATLAS = {
  key: 'atlas_telegraphs_v1',
  image: 'assets/sprites/effects/telegraphs_v1/telegraphs_v1.png',
  data: 'assets/sprites/effects/telegraphs_v1/telegraphs_v1.atlas.json'
} as const

export type TelegraphGroup = 'reticle' | 'floor_marker' | 'warning_flash' | 'charge_glow'

export function telegraphFrame(group: TelegraphGroup, index: number): string {
  return `telegraphs_v1/${group}/${String(Math.max(0, Math.min(3, Math.floor(index)))).padStart(3, '0')}`
}
