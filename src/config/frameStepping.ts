/**
 * Deterministic frame stepping for automation (prompt 05a, extracted from `src/main.ts` in 5.1c so
 * it is a pure module testable without a scene). Drives a game-like object's `step` directly with a
 * monotonic 60Hz clock, so every step's delta is exactly 1000/60 regardless of wall-clock time.
 * `Phaser.Game#step` never touches `loop.lastTime`/`loop.frame` (only TimeStep's own rAF-bound
 * `step`/`stepLimitFPS` do), so this function advances them itself: without that, `loop.lastTime`
 * would stay stale across separate calls (every call restarting `now` from the same frozen value
 * instead of continuing where the previous one left off, un-anchoring scene timers such as
 * i-frames, jump suppression and dash duration from step count), and `loop.frame` would stay frozen
 * for the whole session (breaking anything that keys a per-step cache off it, e.g.
 * `SceneInputActions`'s action-sampling de-dup).
 *
 * `Phaser.Core.TimeStep#wake` calls `tick()`, which runs one immediate step at the real wall-clock
 * delta since sleep. Toggling sleep/wake around *every* stepped row (instead of once around a whole
 * multi-row replay) reintroduces exactly that uncontrolled step between rows. Pass
 * `manageLoop: false` when the caller already put the loop to sleep for the duration of several
 * calls and owns the single wake at the end (`GameDebugHooks.replayInputs`).
 */
export type FrameSteppableLoop = {
  running: boolean
  lastTime: number
  frame: number
  sleep: () => void
  wake: (seamless?: boolean) => void
}

export type FrameSteppableGame = {
  step: (time: number, delta: number) => void
  loop: FrameSteppableLoop
}

export type StepGameFramesOptions = {
  /** When false, skip this call's own sleep()/wake() bookkeeping because the caller already put
   * the loop to sleep for a multi-call replay and will wake it once itself. Defaults to true. */
  manageLoop?: boolean
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export function stepGameFrames(targetGame: FrameSteppableGame, frames: number, options: StepGameFramesOptions = {}): number {
  const manageLoop = options.manageLoop ?? true
  const requested = Math.max(0, Math.trunc(frames))
  if (requested === 0) {
    return 0
  }

  const loop = targetGame.loop
  const wasRunning = manageLoop && loop.running

  if (wasRunning) {
    loop.sleep()
  }

  const frameMs = 1000 / 60
  let time = loop.lastTime > 0 ? loop.lastTime : now()
  let stepped = 0
  for (let i = 0; i < requested; i += 1) {
    time += frameMs
    targetGame.step(time, frameMs)
    loop.lastTime = time
    // `frame` is typed read-only (Phaser.Core.TimeStep#frame), but TimeStep's own step/stepLimitFPS
    // mutate it directly; this mirrors that for the direct-step path above.
    ;(loop as unknown as { frame: number }).frame += 1
    stepped += 1
  }

  if (wasRunning) {
    loop.wake()
  }

  return stepped
}
