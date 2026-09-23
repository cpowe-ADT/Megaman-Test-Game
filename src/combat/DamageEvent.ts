export type DamageKind = 'bullet' | 'melee' | 'contact' | 'hazard' | 'script' | 'unknown'

export type DamageEvent = {
  sourceId: string
  targetId: string
  amount: number
  kind: DamageKind
  nowMs: number
  iFrameMs?: number
  note?: string
}

export type DamageResult = {
  accepted: boolean
  immune: boolean
  amountApplied: number
  remainingHp: number
  defeated: boolean
  reason?: 'dead' | 'invulnerable' | 'zero-damage'
}
