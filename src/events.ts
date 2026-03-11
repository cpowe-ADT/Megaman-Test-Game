import Phaser from 'phaser'
import { AttackPattern } from './bosses/types'

export const EVENTS = {
  BOSS_ENTERED_ATTACK: 'BOSS_ENTERED_ATTACK',
  BOSS_COOLDOWN_RESET: 'BOSS_COOLDOWN_RESET',
  BOSS_PROJECTILE_SPAWNED: 'BOSS_PROJECTILE_SPAWNED',
  BOSS_ATTACK_COMPLETE: 'BOSS_ATTACK_COMPLETE'
} as const

export type BossEventName = (typeof EVENTS)[keyof typeof EVENTS]

export const GlobalEventBus = new Phaser.Events.EventEmitter()

export interface BossAttackLifecycleEvent {
  id: string
  attack: AttackPattern
  timestamp: number
  mode: 'controller' | 'timer'
}

export interface BossProjectileSpawnedEvent {
  id: string
  attackName?: string
  timestamp: number
  mode: 'controller' | 'timer'
  texture?: string
  groupSize?: { used: number; total: number }
}

export interface BossCooldownResetEvent {
  id: string
  attackName: string
  nextAvailableMs: number
  timestamp: number
  mode?: 'controller' | 'timer'
}

export interface BossAttackCompleteEvent {
  id: string
  attackName: string
  timestamp: number
  result: 'fired' | 'skipped'
}

export function emitBossEvent<T>(name: BossEventName, payload: T): void {
  GlobalEventBus.emit(name, payload)
}
