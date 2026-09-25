/**
 * Warden weapon shots and the boss orb (prompt 07 phase 7.3, EVAL-P7-004; prompt 12 part 12f): Higgsfield art cut in
 * `assets/sprites/projectiles/weapons_v1/` (four frames per group, travelling right; the runtime flips). Loaded by the
 * Game scene with its resident atlases (`src/scenes/game/stageBackgroundLoading.ts`); wiring the weapons to these frames
 * is part 12f's weapon-identity work.
 */
export const WEAPONS_ATLAS = {
  key: 'atlas_weapons_v1',
  image: 'assets/sprites/projectiles/weapons_v1/weapons_v1.png',
  data: 'assets/sprites/projectiles/weapons_v1/weapons_v1.atlas.json'
} as const

/** Weapon id (`src/projectiles/definitions/coreProjectiles.ts` PLAYER_WEAPON_FRAMES keys) to its art group. */
export const WEAPON_ART_GROUPS = {
  ArcSlash: 'arc_slash',
  FlameSerpent: 'flame_serpent',
  HydroLance: 'hydro_lance',
  ThunderSpike: 'thunder_spike',
  QuakeKnuckle: 'quake_knuckle',
  MagcutDisc: 'magcut_disc',
  AcidGlob: 'acid_glob',
  AeroDarts: 'aero_darts',
  FrostShatter: 'frost_shatter'
} as const

export const BOSS_ORB_GROUP = 'boss_orb'

export function weaponArtFrame(group: string, index: number): string {
  return `weapons_v1/${group}/${String(((Math.floor(index) % 4) + 4) % 4).padStart(3, '0')}`
}
