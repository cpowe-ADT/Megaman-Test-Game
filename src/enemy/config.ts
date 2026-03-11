export type EnemyGlobalTuning = {
  aggroScanHz: number
  maxActiveEnemies: number
  offscreenSleepDistance: number
}

export const ENEMY_GLOBAL_TUNING: EnemyGlobalTuning = {
  aggroScanHz: 5,
  maxActiveEnemies: 12,
  offscreenSleepDistance: 520
}
