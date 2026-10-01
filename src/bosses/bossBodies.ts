import type { BossAttackHitbox, BossBodyPlan, BossBox } from './types'

/**
 * The boss's three bodies (prompt 07 phase 7.0, EVAL-P7-010). The floor body is the controller's own arcade body
 * (`spritePlan.frame`): it stands on the floor and collides with platforms, and nothing overlaps it any more. The
 * hurtbox takes the Buster, the weapons and the saber. The contact hitbox hurts the hero: the roster's
 * `contactDamage` while no attack is active, and while an attack with an authored `hitbox` is active (dashes, hops,
 * slams, dives), that box and the attack's damage. Pure: `BossController.getBodyBoxes` feeds it, and the Game
 * scene's `BossBodies` adapter moves two zones to the rects it returns.
 */

/** A world-space rectangle, top-left based. */
export interface BossRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BossContactAttack {
  /** Runtime attack id (`normalizedId(name)`). */
  id: string
  hitbox?: BossAttackHitbox
  /** The attack's hit damage (the mapper's `resolveAttackDamage`). */
  damage: number
}

export interface BossBodiesInput {
  plan: BossBodyPlan
  contactDamage: number
  /** The floor body's bottom centre. */
  feet: { x: number; y: number }
  facing: 1 | -1
  activeAttackId: string | null
  /** The active attack's lifecycle phase (`windup`, `active`, `recovery`, ...). */
  lifecycle: string | null
  attacks: readonly BossContactAttack[]
}

export interface BossBodyBoxes {
  hurtbox: BossRect
  hitbox: BossRect
  /** What touching the hitbox deals this frame. */
  damage: number
  /** The active attack whose hitbox this is; null for the idle contact box. */
  attack: string | null
}

/** A box's world rect: centred `offsetX` forward of the feet, its bottom `offsetY` above them. */
export function bossBoxRect(box: BossBox, feet: { x: number; y: number }, facing: 1 | -1): BossRect {
  const centreX = feet.x + (box.offsetX ?? 0) * facing
  const bottom = feet.y - (box.offsetY ?? 0)
  return { x: centreX - box.width / 2, y: bottom - box.height, width: box.width, height: box.height }
}

/** Boxes for a blueprint that authors none: three quarters of the frame to take hits, half of it to hurt. */
export function defaultBossBodyPlan(frame: { x: number; y: number }): BossBodyPlan {
  return {
    hurtbox: { width: Math.round(frame.x * 0.75), height: Math.round(frame.y * 0.85) },
    hitbox: { width: Math.round(frame.x * 0.5), height: Math.round(frame.y * 0.62) }
  }
}

export function resolveBossBodies(input: BossBodiesInput): BossBodyBoxes {
  const hurtbox = bossBoxRect(input.plan.hurtbox, input.feet, input.facing)
  const striking =
    input.lifecycle === 'active' && input.activeAttackId
      ? input.attacks.find((attack) => attack.id === input.activeAttackId && attack.hitbox)
      : undefined
  if (striking?.hitbox) {
    return {
      hurtbox,
      hitbox: bossBoxRect(striking.hitbox, input.feet, input.facing),
      damage: Math.max(0, striking.hitbox.damage ?? striking.damage),
      attack: striking.id
    }
  }
  return {
    hurtbox,
    hitbox: bossBoxRect(input.plan.hitbox, input.feet, input.facing),
    damage: Math.max(0, input.contactDamage),
    attack: null
  }
}

export function rectsOverlap(a: BossRect, b: BossRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
