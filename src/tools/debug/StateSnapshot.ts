import type { CombatDebugHitEvent, CombatDebugTotals } from './CombatDebugBus'

export type SpriteSnapshot = {
  x: number
  y: number
  vx: number
  vy: number
}

export type GameCombatSnapshot = {
  recentHits: CombatDebugHitEvent[]
  totals: CombatDebugTotals
  player: {
    hp: number
    maxHp: number
    dashCooldownMs: number
    slideRemainingMs: number
    chargeMs: number
    iFramesMs: number
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

export function makeGameCombatSnapshot(input: {
  recentHits: CombatDebugHitEvent[]
  totals: CombatDebugTotals
  player: {
    hp: number
    maxHp: number
    dashCooldownMs: number
    slideRemainingMs: number
    chargeMs: number
    iFramesMs: number
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
      dashCooldownMs: Math.max(0, Math.round(input.player.dashCooldownMs)),
      slideRemainingMs: Math.max(0, Math.round(input.player.slideRemainingMs)),
      chargeMs: Math.max(0, Math.round(input.player.chargeMs)),
      iFramesMs: Math.max(0, Math.round(input.player.iFramesMs))
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
