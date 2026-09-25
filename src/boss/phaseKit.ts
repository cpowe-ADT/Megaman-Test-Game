import type { BossBlueprint } from '../bosses/types'
import { DESPERATION_THRESHOLD } from './fightBeats'

/**
 * Phase kits (prompt 07 phase 7.2 item 1; prompt 12 part 12f wave 2, EVAL-P7-002): phase two retires one
 * attack, retimes one and adds one, and desperation adds one more. Resolved from the roster's phases here and
 * applied by the mapper as `attackWeightOverrides` plus an `enabled` flip per phase. Retirements and retimes
 * carry into later phases. Pure, no Phaser.
 */

export interface AttackTimingOverride {
  windupTime?: number
  cooldown?: number
}

export interface PhaseKit {
  phaseIndex: number
  name: string
  threshold: number
  desperation: boolean
  /** Attacks this phase adds (ids). */
  added: string[]
  /** Attacks this phase retires (ids). */
  retired: string[]
  /** Attacks this phase retimes (ids to the new timing). */
  retimed: Record<string, AttackTimingOverride>
  /** Cumulative: every retired id so far maps to false. */
  enabled: Record<string, boolean>
  /** Cumulative: every retimed id so far. */
  timing: Record<string, AttackTimingOverride>
}

export function attackIdFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

/** One kit per phase in fight order, the desperation phase last when the boss has one. */
export function resolvePhaseKits(blueprint: BossBlueprint): PhaseKit[] {
  const enabled: Record<string, boolean> = {}
  const timing: Record<string, AttackTimingOverride> = {}
  const kits = blueprint.phases.map((phase, phaseIndex) => {
    const retired = (phase.retireAttacks ?? []).map(attackIdFromName)
    const retimed: Record<string, AttackTimingOverride> = {}
    Object.entries(phase.retimeAttacks ?? {}).forEach(([name, retime]) => {
      retimed[attackIdFromName(name)] = { windupTime: retime.telegraphMs, cooldown: retime.cooldownMs }
    })
    retired.forEach((id) => (enabled[id] = false))
    Object.assign(timing, retimed)
    return {
      phaseIndex,
      name: phase.name,
      threshold: phase.threshold,
      desperation: false,
      added: phase.newAttacks.map(attackIdFromName),
      retired,
      retimed,
      enabled: { ...enabled },
      timing: { ...timing }
    }
  })
  const desperation = blueprint.desperation
  if (desperation) {
    kits.push({
      phaseIndex: kits.length,
      name: desperation.name,
      threshold: desperation.threshold ?? DESPERATION_THRESHOLD,
      desperation: true,
      added: [attackIdFromName(desperation.attack.name)],
      retired: [],
      retimed: {},
      enabled: { ...enabled },
      timing: { ...timing }
    })
  }
  return kits
}

/**
 * The reference Normal player the HP targets are set against: Buster only, landing one hit of about 1.3 damage
 * (a mix of plain and charged shots) every 0.8 s across a fight, so about 1.6 HP a second. With 120 ms boss
 * i-frames a Buster at its 120 ms fire rate lands every shot that connects; the rest is dodging, repositioning
 * and the phase locks. Tune from Craig's STOP 7.2 notes, not by feel in code.
 */
export const NORMAL_REFERENCE_DPS = 1.6
export const NORMAL_CLEAR_TARGET_SECONDS = { min: 60, max: 90 } as const

export function estimateNormalClearSeconds(maxHp: number, dps = NORMAL_REFERENCE_DPS): number {
  return Math.round((maxHp / dps) * 10) / 10
}
