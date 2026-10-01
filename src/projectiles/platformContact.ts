/** An Arcade body as the platform contact rule reads it: its vertical extent and, for a shot, its vertical speed. */
export type VerticalSpan = {
  readonly center: { readonly y: number }
  readonly top: number
  readonly bottom: number
  readonly velocity?: { readonly y: number }
}

/**
 * Whether a shot stops at a platform its physics body touches (prompt 07 phase 7.0 note, EVAL-P7-010: contact is by
 * body, not drawn bounds). A shot whose centre is inside the platform's vertical span has met a wall or a platform
 * side and stops. Above the platform it stops only while falling (a lob or a down-tilted shot lands on the top, as
 * the bodies touch, so the impact reads as a floor); below it, only while rising. A level shot whose body only grazes
 * the floor it flies along goes on: a charged shot, or a weapon shot sized to its art, reaches below the muzzle.
 */
export function shotStopsAtPlatform(shot: VerticalSpan, platform: VerticalSpan): boolean {
  const vy = shot.velocity?.y ?? 0
  if (shot.center.y < platform.top) return vy > 0
  if (shot.center.y > platform.bottom) return vy < 0
  return true
}

type WithBody = { body?: unknown }
const STATIC_BODY = 1 // Phaser.Physics.Arcade.STATIC_BODY

/** The Arcade collider's process callback for shots against stage platforms: the static body is the platform. */
export function shotPlatformProcess(a: unknown, b: unknown): boolean {
  const bodyA = (a as WithBody | null)?.body as (VerticalSpan & { physicsType?: number }) | undefined
  const bodyB = (b as WithBody | null)?.body as (VerticalSpan & { physicsType?: number }) | undefined
  if (!bodyA || !bodyB) return true
  const [shot, platform] = bodyA.physicsType === STATIC_BODY ? [bodyB, bodyA] : [bodyA, bodyB]
  return shotStopsAtPlatform(shot, platform)
}
