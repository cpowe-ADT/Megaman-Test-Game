import type { CombatDebugHitEvent, CombatDebugTotals } from './CombatDebugBus'
import type { ProjectileSpawnReceipt } from '../../player/types'

export type SpriteSnapshot = {
  x: number
  y: number
  vx: number
  vy: number
}

export type DirectionFlagsSnapshot = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export type VectorSnapshot = {
  x: number
  y: number
}

export type GameCombatSnapshot = {
  recentHits: CombatDebugHitEvent[]
  totals: CombatDebugTotals
  player: {
    hp: number
    maxHp: number
    bodyProfileKey: string | null
    blocked: DirectionFlagsSnapshot
    touching: DirectionFlagsSnapshot
    dropThroughActive: boolean
    coyoteMs: number
    jumpBufferMs: number
    dashRemainingMs: number
    dashCooldownMs: number
    dashStarted: boolean
    dashEnded: boolean
    slideRemainingMs: number
    wallSide: -1 | 0 | 1
    lastLandingSpeed: number
    lastJumpSource: string
    chargeMs: number
    shotsFiredTotal: number
    lastProjectileSpawnMs: number
    lastProjectileSpawnFrame: number
    lastProjectile: ProjectileSpawnReceipt | null
    iFramesMs: number
    lastDamageSource: string
    lastDamageTier: string
    knockback: VectorSnapshot
    wallSliding: boolean
    touchButtons: Record<string, boolean> | null
    virtualControlsVisible: boolean
  }
  boss: {
    hp: { current: number; max: number } | null
    phase: string
  }
}

export function summarizeSpriteKinematics(
  sprite:
    | {
        x?: number
        y?: number
        body?:
          | {
              velocity?: {
                x?: number
                y?: number
              }
            }
          | null
      }
    | undefined
): SpriteSnapshot | null {
  if (!sprite) {
    return null
  }

  return {
    x: Math.round(Number(sprite.x ?? 0)),
    y: Math.round(Number(sprite.y ?? 0)),
    vx: Math.round(Number(sprite.body?.velocity?.x ?? 0)),
    vy: Math.round(Number(sprite.body?.velocity?.y ?? 0))
  }
}

function normalizeDirectionFlags(input: Partial<DirectionFlagsSnapshot> | null | undefined): DirectionFlagsSnapshot {
  return {
    up: Boolean(input?.up),
    down: Boolean(input?.down),
    left: Boolean(input?.left),
    right: Boolean(input?.right)
  }
}

function normalizeVector(input: Partial<VectorSnapshot> | null | undefined): VectorSnapshot {
  return {
    x: Math.round(Number(input?.x ?? 0)),
    y: Math.round(Number(input?.y ?? 0))
  }
}

function normalizeTouchButtons(input: Record<string, unknown> | null | undefined): Record<string, boolean> | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Boolean(value)])
  )
}

export function makeGameCombatSnapshot(input: {
  recentHits: CombatDebugHitEvent[]
  totals: CombatDebugTotals
  player: {
    hp: number
    maxHp: number
    bodyProfileKey?: string | null
    blocked?: Partial<DirectionFlagsSnapshot> | null
    touching?: Partial<DirectionFlagsSnapshot> | null
    dropThroughActive?: boolean
    coyoteMs?: number
    jumpBufferMs?: number
    dashRemainingMs?: number
    dashCooldownMs: number
    dashStarted?: boolean
    dashEnded?: boolean
    slideRemainingMs: number
    wallSide?: -1 | 0 | 1
    lastLandingSpeed?: number
    lastJumpSource?: string
    chargeMs: number
    shotsFiredTotal: number
    lastProjectileSpawnMs: number
    lastProjectileSpawnFrame?: number
    lastProjectile?: ProjectileSpawnReceipt | null
    iFramesMs: number
    lastDamageSource?: string
    lastDamageTier?: string
    knockback?: Partial<VectorSnapshot> | null
    wallSliding: boolean
    touchButtons?: Record<string, unknown> | null
    virtualControlsVisible: boolean
  }
  boss: {
    hp: { current: number; max: number } | null
    phase: string
  }
}): GameCombatSnapshot {
  return {
    recentHits: [...input.recentHits],
    totals: {
      ...input.totals,
      byTarget: {
        ...input.totals.byTarget
      }
    },
    player: {
      hp: Math.max(0, Math.round(input.player.hp)),
      maxHp: Math.max(1, Math.round(input.player.maxHp)),
      bodyProfileKey: input.player.bodyProfileKey ? String(input.player.bodyProfileKey) : null,
      blocked: normalizeDirectionFlags(input.player.blocked),
      touching: normalizeDirectionFlags(input.player.touching),
      dropThroughActive: Boolean(input.player.dropThroughActive),
      coyoteMs: Math.max(0, Math.round(input.player.coyoteMs ?? 0)),
      jumpBufferMs: Math.max(0, Math.round(input.player.jumpBufferMs ?? 0)),
      dashRemainingMs: Math.max(0, Math.round(input.player.dashRemainingMs ?? 0)),
      dashCooldownMs: Math.max(0, Math.round(input.player.dashCooldownMs)),
      dashStarted: Boolean(input.player.dashStarted),
      dashEnded: Boolean(input.player.dashEnded),
      slideRemainingMs: Math.max(0, Math.round(input.player.slideRemainingMs)),
      wallSide: input.player.wallSide === -1 || input.player.wallSide === 1 ? input.player.wallSide : 0,
      lastLandingSpeed: Math.max(0, Math.round(input.player.lastLandingSpeed ?? 0)),
      lastJumpSource: String(input.player.lastJumpSource ?? 'none'),
      chargeMs: Math.max(0, Math.round(input.player.chargeMs)),
      shotsFiredTotal: Math.max(0, Math.round(input.player.shotsFiredTotal)),
      lastProjectileSpawnMs: Math.max(0, Math.round(input.player.lastProjectileSpawnMs)),
      lastProjectileSpawnFrame: Math.max(0, Math.round(input.player.lastProjectileSpawnFrame ?? 0)),
      lastProjectile: input.player.lastProjectile ? { ...input.player.lastProjectile } : null,
      iFramesMs: Math.max(0, Math.round(input.player.iFramesMs)),
      lastDamageSource: String(input.player.lastDamageSource ?? 'none'),
      lastDamageTier: String(input.player.lastDamageTier ?? 'none'),
      knockback: normalizeVector(input.player.knockback),
      wallSliding: Boolean(input.player.wallSliding),
      touchButtons: normalizeTouchButtons(input.player.touchButtons),
      virtualControlsVisible: Boolean(input.player.virtualControlsVisible)
    },
    boss: {
      hp: input.boss.hp
        ? {
            current: Math.max(0, Math.round(input.boss.hp.current)),
            max: Math.max(1, Math.round(input.boss.hp.max))
          }
        : null,
      phase: input.boss.phase
    }
  }
}
