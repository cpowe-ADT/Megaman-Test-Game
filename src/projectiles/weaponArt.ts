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

/** Source size of each group's frames (`weapons_v1.atlas.json`; tests/weapon-identities.test.ts checks it). */
export const WEAPON_ART_FRAME_SIZE: Record<string, { width: number; height: number }> = {
  arc_slash: { width: 38, height: 34 },
  flame_serpent: { width: 44, height: 22 },
  hydro_lance: { width: 46, height: 26 },
  thunder_spike: { width: 42, height: 24 },
  quake_knuckle: { width: 46, height: 24 },
  magcut_disc: { width: 34, height: 34 },
  acid_glob: { width: 40, height: 30 },
  aero_darts: { width: 38, height: 36 },
  frost_shatter: { width: 40, height: 32 },
  boss_orb: { width: 44, height: 30 }
}

/**
 * The HUD and pause-grid weapon icons (`assets/ui/hud_icons/hud_icons_v1/`, 18x18 cells): a Game-scene resident
 * atlas (`GAME_SCENE_ATLASES`). Weapons use their art group's name; the Buster has its own icon.
 */
export const HUD_ICONS_ATLAS = {
  key: 'atlas_hud_icons_v1',
  image: 'assets/ui/hud_icons/hud_icons_v1/hud_icons_v1.png',
  data: 'assets/ui/hud_icons/hud_icons_v1/hud_icons_v1.atlas.json'
} as const

export function weaponHudIconFrame(weaponId: string): string {
  const group = (WEAPON_ART_GROUPS as Record<string, string>)[weaponId] ?? 'buster'
  return `hud_icons_v1/${group}/000`
}

export function weaponArtFrame(group: string, index: number): string {
  return `weapons_v1/${group}/${String(((Math.floor(index) % 4) + 4) % 4).padStart(3, '0')}`
}
