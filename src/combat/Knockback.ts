export type KnockbackVector = {
  x: number
  y: number
}

export type KnockbackRequest = {
  targetId: string
  vector: KnockbackVector
  kind: string
}
