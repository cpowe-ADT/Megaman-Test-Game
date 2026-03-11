type DataLike = {
  get?: (key: string) => unknown
  set?: (key: string, value: unknown) => void
}

type BodyLike = {
  reset?: (x: number, y: number) => void
  setVelocityX?: (value: number) => void
}

export type ProjectileTrackingSprite = {
  x: number
  y: number
  data?: DataLike
  body?: BodyLike
  setPosition: (x: number, y: number) => void
}

export type ProjectileTrackingTarget = {
  x: number
  y: number
  data?: DataLike
}

export function getHitTargetId(target: ProjectileTrackingTarget): string {
  return (
    (target.data?.get?.('enemyFrameworkId') as string | undefined) ??
    (target.data?.get?.('eid') as string | undefined) ??
    `${Math.round(target.x)}:${Math.round(target.y)}`
  )
}

export function shouldSkipProjectileHit(
  bullet: ProjectileTrackingSprite,
  target: ProjectileTrackingTarget,
  now: number
): boolean {
  const lastTargetId = String(bullet.data?.get?.('lastHitTargetId') ?? '')
  const lastHitAt = Number(bullet.data?.get?.('lastHitAt') ?? 0)
  if (!lastTargetId) {
    return false
  }

  return lastTargetId === getHitTargetId(target) && now - lastHitAt < 90
}

export function consumeProjectileHit(
  bullet: ProjectileTrackingSprite,
  target: ProjectileTrackingTarget,
  now: number,
  fallbackFacing: 1 | -1
): boolean {
  bullet.data?.set?.('lastHitTargetId', getHitTargetId(target))
  bullet.data?.set?.('lastHitAt', now)

  const pierceRemaining = Number(bullet.data?.get?.('pierceRemaining') ?? 0)
  if (pierceRemaining <= 0) {
    return false
  }

  bullet.data?.set?.('pierceRemaining', pierceRemaining - 1)
  const facing = Number(bullet.data?.get?.('bulletFacing') ?? fallbackFacing) >= 0 ? 1 : -1
  const speedX = Number(bullet.data?.get?.('baseSpeedX') ?? 260 * facing)
  bullet.setPosition(bullet.x + facing * 14, bullet.y)
  bullet.body?.reset?.(bullet.x, bullet.y)
  bullet.body?.setVelocityX?.(speedX)
  return true
}
