export type ProjectileClashState = {
  playerDamage: number
  enemyDamage: number
  chargeLevel: number
  pierceRemaining: number
}

export type ProjectileClashResult = {
  playerSurvives: boolean
  nextPierceRemaining: number
}

export function resolveProjectileClashResult(state: ProjectileClashState): ProjectileClashResult {
  const canPunchThrough =
    state.chargeLevel >= 2 ||
    state.pierceRemaining > 0 ||
    state.playerDamage > state.enemyDamage

  if (!canPunchThrough) {
    return {
      playerSurvives: false,
      nextPierceRemaining: Math.max(0, state.pierceRemaining)
    }
  }

  return {
    playerSurvives: true,
    nextPierceRemaining: Math.max(0, state.pierceRemaining - (state.pierceRemaining > 0 ? 1 : 0))
  }
}
