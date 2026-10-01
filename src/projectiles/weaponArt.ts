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

/** The nine charged-form groups (13d, `EVAL-P13-008`), cut to their own atlas so the plain `weapons_v1` art is untouched. */
export const WEAPONS_CHARGED_ATLAS = {
  key: 'atlas_weapons_charged_v1',
  image: 'assets/sprites/projectiles/weapons_charged_v1/weapons_charged_v1.png',
  data: 'assets/sprites/projectiles/weapons_charged_v1/weapons_charged_v1.atlas.json'
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
  boss_orb: { width: 44, height: 30 },
  // Charged-effect sheets (13d, EVAL-P13-008): cut from assets/sprites/source/vfx/hf_v1/charged_a.png and
  // charged_b.png (scripts/sprites/weapons_charged_v1.json); sizes as printed by cut_vfx_sheet.py.
  flame_serpent_charged: { width: 58, height: 46 },
  hydro_lance_charged: { width: 62, height: 54 },
  thunder_spike_charged: { width: 62, height: 58 },
  quake_knuckle_charged: { width: 62, height: 50 },
  magcut_disc_charged: { width: 52, height: 52 },
  acid_glob_charged: { width: 58, height: 50 },
  aero_darts_charged: { width: 56, height: 52 },
  frost_shatter_charged: { width: 60, height: 40 }
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

/** The charged groups live in their own atlas (`WEAPONS_CHARGED_ATLAS`), named `<group>_charged`. */
export function isChargedArtGroup(group: string): boolean {
  return group.endsWith('_charged')
}

export function weaponArtFrame(group: string, index: number): string {
  const atlasKey = isChargedArtGroup(group) ? 'weapons_charged_v1' : 'weapons_v1'
  return `${atlasKey}/${group}/${String(((Math.floor(index) % 4) + 4) % 4).padStart(3, '0')}`
}

/** The texture key a group's frames live in (`weaponArtVisual`): the charged atlas for a `_charged` group. */
export function weaponArtTextureKey(group: string): string {
  return isChargedArtGroup(group) ? WEAPONS_CHARGED_ATLAS.key : WEAPONS_ATLAS.key
}
