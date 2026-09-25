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

/** The authored ring's multipliers (prompt 07 phase 7.3, EVAL-P7-004). */
export const WEAKNESS_MULTIPLIER = 2.5
export const RESIST_MULTIPLIER = 0.75

/**
 * The authored ring: a boss takes 2.5x from the element it is weak to (1.75 until Craig asked for special moves to hurt more, 2026-09-25) (`WeaknessTable[boss]`) and 0.75x from an
 * element its own beats (`WeaknessTable[weapon] === boss`); everything else is neutral. Normal (the Buster, the
 * saber, ArcSlash, Rook and Omega) sits outside the ring.
 */
export function damageMultiplier(weapon: Element, boss: Element): number {
  if (weapon === 'Normal' || boss === 'Normal') {
    return 1
  }
  if (WeaknessTable[boss] === weapon) {
    return WEAKNESS_MULTIPLIER
  }
  if (WeaknessTable[weapon] === boss) {
    return RESIST_MULTIPLIER
  }
  return 1
}

/** Authored exceptions to the ring: Rook takes the Buster only; Omega's weakness rotates with its phases. */
export interface BossDamageProfile {
  /** Only these weapons hurt the boss (the saber counts as the Buster); every other weapon does nothing. */
  onlyWeapons?: WeaponId[]
  /** The element the boss is weak to in each phase, in phase order; later phases (desperation) keep the last. */
  phaseWeaknesses?: Element[]
}

export type BossHitOutcome = 'weakness' | 'neutral' | 'resisted' | 'immune'

export interface BossElementHit {
  multiplier: number
  outcome: BossHitOutcome
  /** The element the boss is weak to right now (null for Normal bosses without a rotation). */
  weakTo: Element | null
}

/** The weakness table for one hit (Classic): the ring, then the boss's authored profile. */
export function resolveBossElementHit(options: {
  bossElement: Element
  weaponId: string
  weaponElement: Element
  profile?: BossDamageProfile
  phaseIndex?: number
}): BossElementHit {
  const { bossElement, weaponId, weaponElement, profile } = options
  const rotation = profile?.phaseWeaknesses ?? []
  const weakTo = rotation.length > 0 ? rotation[Math.max(0, Math.min(rotation.length - 1, Math.floor(options.phaseIndex ?? 0)))] : bossElement === 'Normal' ? null : WeaknessTable[bossElement]
  if (profile?.onlyWeapons && !profile.onlyWeapons.includes(weaponId as WeaponId)) {
    return { multiplier: 0, outcome: 'immune', weakTo }
  }
  const multiplier = rotation.length > 0 && weaponElement !== 'Normal' && weaponElement === weakTo ? WEAKNESS_MULTIPLIER : damageMultiplier(weaponElement, bossElement)
  const outcome: BossHitOutcome = multiplier >= WEAKNESS_MULTIPLIER ? 'weakness' : multiplier < 1 ? 'resisted' : 'neutral'
  return { multiplier, outcome, weakTo }
}

/** The boss's phase index from the phase name on the HUD (desperation counts after the authored phases). */
export function bossPhaseIndex(blueprint: Pick<BossBlueprint, 'phases' | 'desperation'>, currentPhaseName: string | undefined): number {
  const name = (currentPhaseName ?? '').trim().toUpperCase()
  if (!name) return 0
  const index = blueprint.phases.findIndex((phase) => phase.name.toUpperCase() === name)
  if (index >= 0) return index
  return blueprint.desperation?.name.toUpperCase() === name ? blueprint.phases.length : 0
}

/** The boss framework's damage type for an element: `BossDamageController` looks it up in a definition's `resistances`. */
export const ELEMENT_DAMAGE_TYPE: Record<Element, string> = {
  Normal: 'normal',
  Fire: 'fire',
  Water: 'water',
  Lightning: 'electric',
  Earth: 'impact',
  Metal: 'metal',
  Toxic: 'toxic',
  Wind: 'wind',
  Ice: 'ice'
}

/**
 * A box on the boss (prompt 07 phase 7.0, EVAL-P7-010), placed from the floor body's bottom centre (the feet) and
 * mirrored with the boss's facing: `offsetX` forward, `offsetY` up from the feet line.
 */
export interface BossBox {
  width: number
  height: number
  offsetX?: number
  offsetY?: number
}

/** An attack's contact box; `damage` defaults to the attack's own hit damage. */
export interface BossAttackHitbox extends BossBox {
  damage?: number
}

/**
 * A boss is three bodies: the floor body (`spritePlan.frame`: stands on the floor, collides with platforms, never
 * hurts), the hurtbox (takes the Buster, the weapons and the saber) and the contact hitbox (the roster's
 * `contactDamage` while no attack is active; an active attack's `hitbox` and damage replace it).
 */
export interface BossBodyPlan {
  hurtbox: BossBox
  hitbox: BossBox
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
  /** Movement envelope or velocity hints (authoring note; the roster keeps these as comments). */
  movementCue?: string
  /** Projectiles or hazards spawned */
  spawns?: string[]
  /** Whether the attack ignores the player's i-frames */
  piercesIFrames?: boolean
  /** The contact hitbox while this attack is active (a dash, hop, slam or dive: the body is the strike); see `bodies`. */
  hitbox?: BossAttackHitbox
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
  /** Phase kit (prompt 07 phase 7.2): attacks this phase retires, by name; they stay retired in later phases. */
  retireAttacks?: string[]
  /** Attacks this phase retimes, by name: a new wind-up and cooldown that later phases keep. */
  retimeAttacks?: Record<string, { telegraphMs?: number; cooldownMs?: number }>
}

/** The 20%-HP beat (prompt 07 phase 7.2 item 2): one new attack, a palette flash, and the room's arena change. */
export interface DesperationPlan {
  /** HUD phase label, at most 12 characters. */
  name: string
  /** Share of max HP at or below which desperation begins; 0.2 unless authored. */
  threshold?: number
  description: string
  cadenceMultiplier: number
  attack: AttackPattern
  /** Colours the boss flashes through when desperation begins. */
  flashPalette: number[]
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
    /** Authoring note; the roster keeps these as comments, since no runtime code reads them. */
    mobilityNotes?: string
  }
  weaponReward?: WeaponRewardPlan
  /** Exceptions to the weakness ring (Rook: Buster only; Omega: a weakness per phase). */
  damageProfile?: BossDamageProfile
  /** The framework's flat damage reduction for this boss (none authored yet; the mapper passes it through). */
  defense?: number
  /** The framework's per-damage-type multipliers (`ELEMENT_DAMAGE_TYPE` keys); none authored yet. */
  resistances?: Record<string, number>
  /** Hurtbox and idle contact hitbox (prompt 07 phase 7.0, EVAL-P7-010); the floor body is `spritePlan.frame`. */
  bodies?: BossBodyPlan
  attacks: AttackPattern[]
  phases: PhaseDefinition[]
  /** Not in `attacks`: the desperation attack unlocks only at its threshold, after every phase. */
  desperation?: DesperationPlan
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

/** Snapshot of where a boss's drawn feet sit relative to its physics body and the floor. */
export interface BossGroundReport {
  x: number
  y: number
  feetY: number
  bodyTop: number
  bodyBottom: number
  /** body bottom minus feet row; 0 means the art stands where the body stands. */
  feetToBodyGap: number
  contactOffsetY: number
  grounded: boolean
  allowGravity: boolean
  velocityY: number
  lastGroundY: number
  motionIntent: string
  lifecyclePhase: string
}
