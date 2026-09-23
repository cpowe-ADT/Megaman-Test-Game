import { DamageEvent, HitResult } from './types'

export interface BossDamageControllerConfig {
  maxHP: number
  defense: number
  resistances: Record<string, number>
  invulnMs: number
}

export class BossDamageController {
  private readonly maxHP: number
  private readonly defense: number
  private readonly resistances: Record<string, number>
  private readonly baseInvulnMs: number

  private hp: number
  private invulnRemainingMs = 0

  constructor(config: BossDamageControllerConfig) {
    this.maxHP = config.maxHP
    this.hp = config.maxHP
    this.defense = config.defense
    this.resistances = config.resistances
    this.baseInvulnMs = config.invulnMs
  }

  get currentHP(): number {
    return this.hp
  }

  get maxHp(): number {
    return this.maxHP
  }

  get isInvulnerable(): boolean {
    return this.invulnRemainingMs > 0
  }

  tick(dtMs: number): void {
    this.invulnRemainingMs = Math.max(0, this.invulnRemainingMs - dtMs)
  }

  applyDamage(event: DamageEvent): HitResult {
    if (this.hp <= 0) {
      return {
        accepted: false,
        immune: true,
        defeated: true,
        amountApplied: 0,
        nextHP: 0,
        hitstopFrames: event.hitstopFrames ?? 0,
        reason: 'dead'
      }
    }

    if (this.isInvulnerable) {
      return {
        accepted: false,
        immune: true,
        defeated: false,
        amountApplied: 0,
        nextHP: this.hp,
        hitstopFrames: 0,
        reason: 'invuln'
      }
    }

    const resistMultiplier = this.resistances[event.type] ?? 1
    const scaled = Math.max(0, Math.round(event.amount * resistMultiplier) - this.defense)
    if (scaled <= 0) {
      this.invulnRemainingMs = Math.max(this.invulnRemainingMs, Math.floor(this.baseInvulnMs * 0.25))
      return {
        accepted: false,
        immune: true,
        defeated: false,
        amountApplied: 0,
        nextHP: this.hp,
        hitstopFrames: 0,
        reason: 'zero-damage'
      }
    }

    this.hp = Math.max(0, this.hp - scaled)
    this.invulnRemainingMs = event.iFrameMs ?? this.baseInvulnMs

    return {
      accepted: true,
      immune: false,
      defeated: this.hp <= 0,
      amountApplied: scaled,
      nextHP: this.hp,
      hitstopFrames: event.hitstopFrames ?? 0
    }
  }
}
