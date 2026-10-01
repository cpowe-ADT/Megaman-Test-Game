import type { Difficulty } from './types'

/**
 * Part 13c (EVAL-P13-006, EVAL-P6-012): prompt 06 phase 6.8 implements prompt 02 phase 2.7 "verbatim" for
 * boss HP and damage taken. This module is the HP and damage half of that table only (checkpoints, game
 * over continue and the Stage Select weakness hint already live elsewhere: `gameOverLogic.ts`'s
 * `resolveContinueCheckpoint`, and Stage Select/Save respectively).
 *
 * "Boss damage" and "enemy damage" are both prompt 02's single "Damage taken" row (x0.5 / x1 / x1.5):
 * split here into two named multipliers because they are read at two different spawn points (boss HP
 * and contact damage inside `src/bosses/`; a regular enemy's `stats.damage` in `src/enemy/`), not because
 * the values differ.
 *
 * Normal keeps today's numbers (x1 across the board): no setting changes a boss's or enemy's numbers on
 * Normal today. Rook's own numbers changed in this same part (`src/bosses/roster.ts`); that rebalance is
 * independent of difficulty and applies before any of these multipliers.
 */

export interface DifficultyModifiers {
  /** Boss and mini-boss max HP (prompt 02 "Boss and mini-boss HP"). */
  bossHpMultiplier: number
  /** A boss's contact and attack damage to the player (prompt 02 "Damage taken", the boss-authored half). */
  bossDamageMultiplier: number
  /** A regular enemy's damage to the player (prompt 02 "Damage taken", the enemy-authored half). */
  enemyDamageMultiplier: number
}

export const DIFFICULTY_TABLE: Record<Difficulty, DifficultyModifiers> = {
  assist: { bossHpMultiplier: 0.85, bossDamageMultiplier: 0.5, enemyDamageMultiplier: 0.5 },
  normal: { bossHpMultiplier: 1, bossDamageMultiplier: 1, enemyDamageMultiplier: 1 },
  veteran: { bossHpMultiplier: 1.25, bossDamageMultiplier: 1.5, enemyDamageMultiplier: 1.5 }
}

/** The table row for `difficulty`, falling back to Normal for an unrecognized value (a malformed save). */
export function resolveDifficultyModifiers(difficulty: Difficulty): DifficultyModifiers {
  return DIFFICULTY_TABLE[difficulty] ?? DIFFICULTY_TABLE.normal
}

/** A boss's authored max HP, scaled for the difficulty and floored at 1 (read at boss spawn). */
export function scaleBossMaxHp(maxHp: number, difficulty: Difficulty): number {
  return Math.max(1, Math.round(maxHp * resolveDifficultyModifiers(difficulty).bossHpMultiplier))
}

/** A boss's authored contact or attack damage, scaled for the difficulty and floored at 0. */
export function scaleBossDamage(damage: number, difficulty: Difficulty): number {
  return Math.max(0, Math.round(damage * resolveDifficultyModifiers(difficulty).bossDamageMultiplier))
}

/** A regular enemy's authored damage stat, scaled for the difficulty and floored at 0 (read at enemy spawn). */
export function scaleEnemyDamage(damage: number, difficulty: Difficulty): number {
  return Math.max(0, Math.round(damage * resolveDifficultyModifiers(difficulty).enemyDamageMultiplier))
}
