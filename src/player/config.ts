export type Vec2 = { x: number; y: number }

export type MovementTuningConfig = {
  runSpeed: number
  accel: number
  decel: number
  airAccel: number
  gravity: number
  terminalVelocity: number
  jumpVelocity: number
  jumpHoldGravityScale: number
  coyoteTimeMs: number
  jumpBufferMs: number
}

export type DashConfig = {
  dashSpeed: number
  dashDurationMs: number
  dashCooldownMs: number
  dashCancelRules: {
    canShootDuringDash: boolean
    canSlashDuringDash: boolean
  }
}

export type ChargeProjectileConfig = {
  size: number
  speed: number
  damage: number
  pierce: number
  impactFxKey: string
}

export type BlasterConfig = {
  fireRateMs: number
  pelletSpeed: number
  pelletDamage: number
  chargeThresholdsMs: [number, number, number, number]
  perLevelProjectile: Record<1 | 2 | 3 | 4, ChargeProjectileConfig>
  chargeCancelOnHit: boolean
  chargeCancelOnSlash: boolean
}

export type Direction8 = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export type HitboxShape =
  | {
      kind: 'rect'
      offsetX: number
      offsetY: number
      width: number
      height: number
    }
  | {
      kind: 'circle'
      offsetX: number
      offsetY: number
      radius: number
    }

export type SwordWindowConfig = {
  startupFrames: number
  activeFrames: number
  recoveryFrames: number
  hitbox: HitboxShape
  hitstopFrames: number
}

export type SwordConfig = {
  comboEnabled: boolean
  aimDeadzone: number
  windows: {
    ground: Record<Direction8, SwordWindowConfig>
    air: Record<Direction8, SwordWindowConfig>
  }
}

export type DamageConfig = {
  maxHp: number
  iFramesMs: number
  hitstunMs: {
    light: number
    heavy: number
  }
  knockback: {
    ground: Vec2
    air: Vec2
  }
  elementalStatesEnabled: boolean
}

export type PlayerGameplayConfig = {
  movement: MovementTuningConfig
  dash: DashConfig
  blaster: BlasterConfig
  sword: SwordConfig
  damage: DamageConfig
}

const baseSwordWindow = (hitbox: HitboxShape): SwordWindowConfig => ({
  startupFrames: 4,
  activeFrames: 4,
  recoveryFrames: 8,
  hitbox,
  hitstopFrames: 3
})

const baseSwordWindowAir = (hitbox: HitboxShape): SwordWindowConfig => ({
  startupFrames: 4,
  activeFrames: 3,
  recoveryFrames: 7,
  hitbox,
  hitstopFrames: 2
})

export const PLAYER_GAMEPLAY_CONFIG: PlayerGameplayConfig = {
  movement: {
    runSpeed: 220,
    accel: 1700,
    decel: 2100,
    airAccel: 1050,
    gravity: 800,
    terminalVelocity: 550,
    jumpVelocity: -420,
    jumpHoldGravityScale: 0.55,
    coyoteTimeMs: 100,
    jumpBufferMs: 100
  },
  dash: {
    dashSpeed: 320,
    dashDurationMs: 140,
    dashCooldownMs: 420,
    dashCancelRules: {
      canShootDuringDash: true,
      canSlashDuringDash: false
    }
  },
  blaster: {
    fireRateMs: 120,
    pelletSpeed: 260,
    pelletDamage: 1,
    chargeThresholdsMs: [220, 450, 780, 1150],
    perLevelProjectile: {
      1: { size: 1.05, speed: 300, damage: 1, pierce: 0, impactFxKey: 'fx_impact_charge_lv1' },
      2: { size: 1.2, speed: 330, damage: 2, pierce: 0, impactFxKey: 'fx_impact_charge_lv2' },
      3: { size: 1.45, speed: 360, damage: 3, pierce: 1, impactFxKey: 'fx_impact_charge_lv3' },
      4: { size: 1.8, speed: 390, damage: 4, pierce: 1, impactFxKey: 'fx_impact_charge_lv4' }
    },
    chargeCancelOnHit: true,
    chargeCancelOnSlash: true
  },
  sword: {
    comboEnabled: false,
    aimDeadzone: 0.2,
    windows: {
      ground: {
        n: baseSwordWindow({ kind: 'rect', offsetX: 0, offsetY: -26, width: 18, height: 22 }),
        ne: baseSwordWindow({ kind: 'rect', offsetX: 16, offsetY: -18, width: 22, height: 20 }),
        e: baseSwordWindow({ kind: 'rect', offsetX: 20, offsetY: -6, width: 28, height: 18 }),
        se: baseSwordWindow({ kind: 'rect', offsetX: 18, offsetY: 10, width: 24, height: 18 }),
        s: baseSwordWindow({ kind: 'rect', offsetX: 0, offsetY: 18, width: 18, height: 18 }),
        sw: baseSwordWindow({ kind: 'rect', offsetX: -18, offsetY: 10, width: 24, height: 18 }),
        w: baseSwordWindow({ kind: 'rect', offsetX: -20, offsetY: -6, width: 28, height: 18 }),
        nw: baseSwordWindow({ kind: 'rect', offsetX: -16, offsetY: -18, width: 22, height: 20 })
      },
      air: {
        n: baseSwordWindowAir({ kind: 'rect', offsetX: 0, offsetY: -24, width: 16, height: 20 }),
        ne: baseSwordWindowAir({ kind: 'rect', offsetX: 14, offsetY: -16, width: 20, height: 18 }),
        e: baseSwordWindowAir({ kind: 'rect', offsetX: 18, offsetY: -6, width: 24, height: 16 }),
        se: baseSwordWindowAir({ kind: 'rect', offsetX: 14, offsetY: 8, width: 20, height: 16 }),
        s: baseSwordWindowAir({ kind: 'rect', offsetX: 0, offsetY: 16, width: 16, height: 16 }),
        sw: baseSwordWindowAir({ kind: 'rect', offsetX: -14, offsetY: 8, width: 20, height: 16 }),
        w: baseSwordWindowAir({ kind: 'rect', offsetX: -18, offsetY: -6, width: 24, height: 16 }),
        nw: baseSwordWindowAir({ kind: 'rect', offsetX: -14, offsetY: -16, width: 20, height: 18 })
      }
    }
  },
  damage: {
    maxHp: 8,
    iFramesMs: 650,
    hitstunMs: {
      light: 170,
      heavy: 280
    },
    knockback: {
      ground: { x: 165, y: -170 },
      air: { x: 135, y: -130 }
    },
    elementalStatesEnabled: false
  }
}
