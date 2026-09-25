/**
 * Presentation data for the hero's buster and saber (Higgsfield gpt_image_2 art, cut by
 * scripts/sprites/cut_vfx_sheet.py; provenance in assets/sprites/source/free-source-attribution.v1.json).
 * Pure data: the Game scene loads the atlases (src/scenes/game/stageBackgroundLoading.ts) and the
 * adapters (VfxSfxRouter, the sword-hit path) read the frames and anchors from here.
 *
 * Shots and arcs are drawn facing RIGHT; flip them when the hero faces left. Hero body frames face LEFT.
 * Offsets are game pixels from the hero sprite's centre, for a hero facing right (negate x when facing left).
 */
import type { Direction8 } from '../player/config'
import type { SlashMove } from '../player/types'

export const HERO_PROJECTILES_ATLAS = {
  key: 'atlas_projectiles_hero',
  image: 'assets/sprites/projectiles/projectiles_hero/projectiles_hero.png',
  data: 'assets/sprites/projectiles/projectiles_hero/projectiles_hero.atlas.json'
} as const

export const HERO_EFFECTS_ATLAS = {
  key: 'atlas_effects_hero',
  image: 'assets/sprites/effects/effects_hero/effects_hero.png',
  data: 'assets/sprites/effects/effects_hero/effects_hero.atlas.json'
} as const

/** Every hero combat atlas the Game scene keeps resident (small: 128x92 and 256x266). */
export const HERO_COMBAT_ATLASES = [HERO_PROJECTILES_ATLAS, HERO_EFFECTS_ATLAS] as const

function frames(atlas: 'projectiles_hero' | 'effects_hero', group: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${atlas}/${group}/${String(index).padStart(3, '0')}`)
}

export type FrameStrip = { frames: readonly string[]; frameRate: number; width: number; height: number }

const strip = (atlas: 'projectiles_hero' | 'effects_hero', group: string, count: number, frameRate: number, width: number, height: number): FrameStrip => ({
  frames: frames(atlas, group, count),
  frameRate,
  width,
  height
})

// ---------------------------------------------------------------------------------------------- buster

export type ChargeLevel = 0 | 1 | 2 | 3 | 4

/**
 * Shot art per charge level: pellet for lv0, mid for lv1-2, full for lv3-4. `scale` sets the drawn
 * size, and the projectile definition's body width is the frame width (so the body is as wide as the
 * drawing); the body height stays the tall combat sensor (coreProjectiles.ts) so a muzzle-height shot
 * still meets short ground enemies.
 */
export const BUSTER_SHOT_VISUALS: Record<ChargeLevel, FrameStrip & { scale: number }> = {
  0: { ...strip('projectiles_hero', 'buster_pellet', 2, 16, 10, 8), scale: 1.25 },
  1: { ...strip('projectiles_hero', 'buster_mid', 2, 16, 26, 12), scale: 1 },
  2: { ...strip('projectiles_hero', 'buster_mid', 2, 16, 26, 12), scale: 1.15 },
  3: { ...strip('projectiles_hero', 'buster_full', 2, 14, 32, 20), scale: 1.2 },
  4: { ...strip('projectiles_hero', 'buster_full', 2, 14, 32, 20), scale: 1.6 }
}

export const REFLECTED_SHOT_VISUAL: FrameStrip & { scale: number } = {
  ...strip('projectiles_hero', 'reflected', 2, 16, 28, 20),
  scale: 1
}

export const HERO_ENEMY_SHOT_VISUALS = {
  orb: strip('projectiles_hero', 'enemy_orb', 2, 12, 10, 12),
  missile: strip('projectiles_hero', 'enemy_missile', 2, 12, 26, 28)
} as const

export const SHOT_IMPACT_FRAME = 'projectiles_hero/impact/000'

/** Muzzle flash: small for lv0, mid for lv1-2, large for lv3-4. Drawn with origin (0, 0.5) at the cannon tip. */
export function muzzleFrameForLevel(level: ChargeLevel): string {
  const index = level === 0 ? 0 : level <= 2 ? 1 : 2
  return `projectiles_hero/muzzle/${String(index).padStart(3, '0')}`
}

export type MuzzlePose = 'stand' | 'run' | 'air' | 'dash'

/** Cannon tip per shooting pose, read off player_main shoot_ground, shoot_run, shoot_air and dash_shoot frame 000. */
export const MUZZLE_ANCHORS: Record<MuzzlePose, { x: number; y: number }> = {
  stand: { x: 20, y: 0 },
  run: { x: 21, y: 1 },
  air: { x: 18, y: 0 },
  dash: { x: 13, y: 1 }
}

export function muzzleAnchor(pose: MuzzlePose, facing: 1 | -1): { x: number; y: number } {
  const anchor = MUZZLE_ANCHORS[pose]
  return { x: anchor.x * facing, y: anchor.y }
}

// ------------------------------------------------------------------------------------------ charge tell

/** The visible charge tell: `charge_aura` centred on the hero, tinted and scaled by level. */
export const CHARGE_AURA = strip('effects_hero', 'charge_aura', 4, 14, 48, 48)

export const CHARGE_AURA_BY_LEVEL: Record<1 | 2 | 3 | 4, { tint: number; scale: number; alpha: number; frameRate: number }> = {
  1: { tint: 0x9fe8ff, scale: 0.85, alpha: 0.55, frameRate: 10 },
  2: { tint: 0x5fd4ff, scale: 1, alpha: 0.7, frameRate: 12 },
  3: { tint: 0xffe27a, scale: 1.1, alpha: 0.8, frameRate: 16 },
  4: { tint: 0xff8ad8, scale: 1.2, alpha: 0.9, frameRate: 20 }
}

// ----------------------------------------------------------------------------------------- saber arcs

export type SlashArcOverlay = FrameStrip & {
  /** Arc centre from the hero centre for an east swing; equals the hit's hitbox centre (config.ts combo). */
  anchor: { x: number; y: number }
}

/** One arc per combo hit and the air spin, centred on that hit's horizontal hitbox. */
export const SLASH_ARC_OVERLAYS: Record<SlashMove, SlashArcOverlay> = {
  combo1: { ...strip('effects_hero', 'slash_1', 4, 24, 44, 26), anchor: { x: 22, y: -6 } },
  combo2: { ...strip('effects_hero', 'slash_2', 4, 24, 44, 50), anchor: { x: 20, y: -8 } },
  combo3: { ...strip('effects_hero', 'slash_3', 4, 20, 38, 42), anchor: { x: 22, y: -8 } },
  air_spin: { ...strip('effects_hero', 'slash_air', 4, 24, 44, 40), anchor: { x: 18, y: -4 } }
}

/**
 * Aimed swings rotate the arc about its centre (radians, +y down, clockwise positive); the anchor follows
 * the aimed box. West-side values apply to the flipped arc, so nw turns clockwise to point up-left.
 */
export const SLASH_ARC_ROTATION: Record<Direction8, number> = {
  e: 0,
  ne: -Math.PI / 4,
  n: -Math.PI / 2,
  nw: Math.PI / 4,
  w: 0,
  sw: -Math.PI / 4,
  s: Math.PI / 2,
  se: Math.PI / 4
}

/** Flip the east-drawn arc for west-side swings (w, nw, sw); rotation is then applied to the flipped arc. */
export function slashArcFlipX(direction: Direction8): boolean {
  return direction === 'w' || direction === 'nw' || direction === 'sw'
}

// ------------------------------------------------------------------------------------ hit and deflect

/** Router keys (PlayerRuntimeEvent vfx / the sword-hit path) and the frames they play. */
export const HERO_HIT_FX: Record<'fx_hit_spark' | 'fx_deflect' | 'fx_explode', FrameStrip> = {
  fx_hit_spark: strip('effects_hero', 'hit_spark', 4, 24, 22, 22),
  fx_deflect: strip('effects_hero', 'deflect', 4, 24, 28, 28),
  fx_explode: strip('effects_hero', 'explode', 4, 18, 30, 28)
}
