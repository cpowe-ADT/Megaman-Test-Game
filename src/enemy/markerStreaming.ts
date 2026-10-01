/**
 * Camera-relative spawn and respawn for enemy level markers (prompt 06 phase 6.1, `EVAL-P6-006`, pulled
 * forward as a 13h leftover): a marker spawns once the camera's view comes within one screen of it,
 * retires when its entity is gone (defeated, or the camera left it a screen behind without a fight), and
 * respawns once the camera has then put a further screen between itself and the marker and comes back
 * within one screen again. `persistent: false` opts a marker out of respawn for good; a marker cleared as
 * part of a mini-boss or `room_lock` wave never respawns either, regardless of that flag.
 *
 * Pure: no Phaser, so `tests/enemy-spawner-respawn.test.ts` runs it without a scene. The adapter edge is
 * `EnemySpawner.ts`, which owns the camera read, the live entity and the one-shot/wave exemptions.
 */

export type MarkerStreamPhase = 'pending' | 'active' | 'cleared'

export interface MarkerStreamState {
  phase: MarkerStreamPhase
  /**
   * While `pending`: true once the marker may spawn as soon as the camera is back within one screen.
   * False right after a retire, until the camera has put a further screen between itself and the marker
   * (the "leaves its window by a screen" half of the rule); prevents an instant respawn at the same spot.
   */
  readyToSpawn: boolean
}

/** The state a marker starts in: never spawned yet, free to spawn the moment it is within one screen. */
export function createMarkerStreamState(): MarkerStreamState {
  return { phase: 'pending', readyToSpawn: true }
}

/** Distance from the nearer camera edge to `markerX`; 0 while the marker already sits inside the view. */
export function cameraEdgeDistance(cameraLeft: number, cameraRight: number, markerX: number): number {
  if (markerX < cameraLeft) return cameraLeft - markerX
  if (markerX > cameraRight) return markerX - cameraRight
  return 0
}

/**
 * One marker's next phase this tick. `entityAlive` is false once its sprite is gone (defeated, or it was
 * never spawned); `canRespawn` is false for a `persistent: false` marker or one gated behind a mini-boss
 * or `room_lock` wave. `oneScreenPx` is the camera's view width (`GAME_WIDTH` at the adapter edge).
 */
export function nextMarkerStreamState(
  state: MarkerStreamState,
  distanceFromCamera: number,
  entityAlive: boolean,
  canRespawn: boolean,
  oneScreenPx: number
): MarkerStreamState {
  if (state.phase === 'cleared') {
    return state
  }

  if (state.phase === 'active') {
    if (entityAlive && distanceFromCamera <= oneScreenPx) {
      return state
    }
    return canRespawn ? { phase: 'pending', readyToSpawn: false } : { phase: 'cleared', readyToSpawn: false }
  }

  // phase === 'pending'
  if (!state.readyToSpawn) {
    return distanceFromCamera > oneScreenPx * 2 ? { phase: 'pending', readyToSpawn: true } : state
  }
  return distanceFromCamera <= oneScreenPx ? { phase: 'active', readyToSpawn: false } : state
}
