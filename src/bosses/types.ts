import Phaser from 'phaser'

export type Element =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Lightning'
  | 'Earth'
  | 'Metal'
  | 'Toxic'
  | 'Wind'
  | 'Ice'

export type WeaponId =
  | 'Buster'
  | 'ArcSlash'
  | 'FlameSerpent'
  | 'HydroLance'
  | 'ThunderSpike'
  | 'QuakeKnuckle'
  | 'MagcutDisc'
  | 'AcidGlob'
  | 'AeroDarts'
  | 'FrostShatter'

export const WeaknessTable: Record<Element, Element> = {
  Water: 'Lightning',
  Fire: 'Water',
  Ice: 'Fire',
  Wind: 'Ice',
  Toxic: 'Wind',
  Metal: 'Toxic',
  Earth: 'Metal',
  Lightning: 'Earth',
  Normal: 'Normal'
}

export function damageMultiplier(weapon: Element, boss: Element): number {
  if (WeaknessTable[boss] === weapon) {
    return 1.5
  }
  if (WeaknessTable[weapon] === boss) {
    return 0.75
  }
  return 1
}

export type BossStateKey =
  | 'intro'
  | 'idle'
  | 'move'
  | 'jump'
  | 'dash'
  | 'shoot'
  | 'summon'
  | 'special'
  | 'recover'

export interface AnimationRequirement {
  /** Texture atlas key */
  atlas: string
  /** Animation key */
  key: string
  /** Frame range required */
  frames: number
  /** Suggested frame rate */
  fps: number
  /** Description of what the animation should convey */
  description: string
}

export interface SpriteSheetPlan {
  /** Pixel dimensions of a single frame */
  frame: Phaser.Types.Math.Vector2Like
  /** Suggested origin when attaching to a container */
  origin: Phaser.Types.Math.Vector2Like
  /** List of animations required */
  animations: AnimationRequirement[]
}

export interface TelegraphSpec {
  telegraphMs: number
  warningFx: 'glow' | 'fan-lines' | 'reticle' | 'wave'
  /** Where the telegraph should appear relative to the boss */
  anchor: 'self' | 'target' | 'projectile'
}

export interface AttackPattern {
  name: string
  /** HUD label, at most 12 characters; defaults to `name`. */
  shortName?: string
  state: BossStateKey
  description: string
  telegraph: TelegraphSpec
  executeMs: number
  cooldownMs: number
  /** Movement envelope or velocity hints */
  movementCue?: string
  /** Projectiles or hazards spawned */
  spawns?: string[]
  /** Whether the attack ignores the player's i-frames */
  piercesIFrames?: boolean
}

export interface PhaseDefinition {
  name: string
  /** HUD label, at most 12 characters; defaults to `name`. */
  shortName?: string
  threshold: number
  enraged: boolean
  description: string
  newAttacks: string[]
  cadenceMultiplier: number
}

export interface BossTheme {
  primary: number
  accent: number
  glow: number
  trail: number
}

export interface WeaponRewardPlan {
  id: WeaponId
  element: Element
  displayName: string
  energyCost: number
  maxEnergy: number
  description: string
  /** Short explanation that can be shown on the win screen */
  tutorial: string
}

export interface BossBlueprint {
  id: BossId | 'probe_boss'
  codename: string
  element: Element
  arena: string
  introCallout: string
  theme: BossTheme
  baseStats: {
    maxHp: number
    contactDamage: number
    moveSpeed: number
    dashSpeed: number
    jumpHeight: number
  }
  movementProfile: {
    weight: 'light' | 'medium' | 'heavy'
    preferredRange: 'close' | 'mid' | 'long'
    mobilityNotes: string
  }
  weaponReward?: WeaponRewardPlan
  attacks: AttackPattern[]
  phases: PhaseDefinition[]
  spritePlan: SpriteSheetPlan
  /** Additional effect layers like wings, cape, or elemental auras */
  overlaySprites?: SpriteSheetPlan[]
}

export type BossId =
  | 'sentinel_rook'
  | 'pyro_maw'
  | 'tide_reaver'
  | 'volt_hopper'
  | 'basalt_titan'
  | 'ferro_blade'
  | 'mire_wraith'
  | 'gale_vixen'
  | 'glacier_ronin'
  | 'omega_core'

/** The HUD phase panel is 64px wide at a 7px font: twelve characters. */
export const BOSS_HUD_LABEL_MAX = 12
export function bossHudLabel(entry: { name: string; shortName?: string }): string {
  return (entry.shortName ?? entry.name).toUpperCase()
}
