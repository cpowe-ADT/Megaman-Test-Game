import { getBossDefinitionById } from '../boss/config'
import type { BossDefinition, BossPhaseDefinition } from '../boss/framework/types'
import { estimateNormalClearSeconds } from '../boss/phaseKit'
import type { BossId } from '../bosses/types'
import { OMEGA_DOORS, OMEGA_REMATCH_BOSS_IDS } from './omegaArchive'

/**
 * Warden Archive rematches (prompt 02 phase 2.6, prompt 12 part 12e, EVAL-P6-011): each warden's full runtime
 * profile from the roster, at phase-two cadence from the first frame, with `maxHp x0.7`. Pure, no Phaser.
 *
 * Phase-two cadence: the opening phase takes phase two's kit (its weights, enables, retimes, deck, speed and
 * think time) and every attack either phase unlocks; the later phases stay as authored, so the phase indices, the
 * HUD names and desperation keep their places. `Game` asks `resolveBossDefinition` for its runtime definition.
 */

export const OMEGA_REMATCH_HP_SCALE = 0.7
const REMATCH_PREFIX = 'omega_rematch:'
/** Walking from a door into the Core's room and back to the next door, s (the hub is two screens at 220px/s). */
export const OMEGA_REMATCH_TRAVEL_SECONDS = 8

export function rematchConfigId(bossId: BossId): string {
  return `${REMATCH_PREFIX}${bossId}`
}

export function rematchBossOf(configId: string | null | undefined): BossId | null {
  if (!configId?.startsWith(REMATCH_PREFIX)) return null
  const bossId = configId.slice(REMATCH_PREFIX.length) as BossId
  return OMEGA_REMATCH_BOSS_IDS.includes(bossId) ? bossId : null
}

export function buildRematchDefinition(base: BossDefinition, hpScale = OMEGA_REMATCH_HP_SCALE): BossDefinition {
  const [opening, second, ...later] = base.phases
  const maxHP = Math.max(1, Math.round(base.maxHP * hpScale))
  if (!opening || !second || second.desperation) return { ...base, maxHP }
  const unlockAttacks = [...new Set([...(opening.unlockAttacks ?? []), ...(second.unlockAttacks ?? [])])]
  const cadence: BossPhaseDefinition = { ...second, threshold: opening.threshold, unlockAttacks, transitionLockMs: 0 }
  return { ...base, maxHP, phases: [cadence, second, ...later] }
}

/** The runtime definition for an id: a rematch id builds the warden's rematch; any other id is the config as before. */
export function resolveBossDefinition(id: string): BossDefinition | undefined {
  const bossId = rematchBossOf(id)
  if (!bossId) return getBossDefinitionById(id)
  const base = getBossDefinitionById(bossId)
  return base ? buildRematchDefinition(base) : undefined
}

/** A rematch's clear time for the reference Normal player (`src/boss/phaseKit.ts`), s. */
export function estimateRematchSeconds(bossId: BossId): number {
  const definition = resolveBossDefinition(rematchConfigId(bossId))
  return definition ? estimateNormalClearSeconds(definition.maxHP) : 0
}

/** The whole archive on the model's numbers: eight rematches plus the walks between them, s. */
export function estimateArchiveSeconds(): number {
  return OMEGA_DOORS.reduce((total, door) => total + estimateRematchSeconds(door.bossId) + OMEGA_REMATCH_TRAVEL_SECONDS, 0)
}
