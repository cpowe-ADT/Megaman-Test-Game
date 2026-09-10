import type { Difficulty } from '../../progression/types'

export const GAME_OVER_AUTO_CONTINUE_MS = 5000
export const LIVES_PER_STAGE_ENTRY = 3

export type GameOverChoice = 'continue' | 'quit'

/**
 * Death economy: Normal and Assist continue from the last checkpoint with lives reset; Veteran
 * continues from the stage start. Quit returns to Warden Select and abandons the run.
 */
export function resolveContinueCheckpoint(difficulty: Difficulty, lastCheckpointId: string | null | undefined): string | undefined {
  if (difficulty === 'veteran') return undefined
  return lastCheckpointId ?? undefined
}

export function gameOverChoices(): Array<{ id: GameOverChoice; label: string }> {
  return [
    { id: 'continue', label: 'Continue' },
    { id: 'quit', label: 'Quit To Warden Select' }
  ]
}
