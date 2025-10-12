export type PauseStateStep = {
  paused: boolean
  skipUpdate: boolean
}

export function evaluatePauseState(currentlyPaused: boolean, pausePressed: boolean): PauseStateStep {
  const paused = pausePressed ? !currentlyPaused : currentlyPaused
  return {
    paused,
    skipUpdate: paused
  }
}
