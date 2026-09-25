import type Phaser from 'phaser'

/**
 * Pause on a hidden tab (prompt 04 §4.3): when the page is hidden during `Game`, the pause menu opens
 * and the charge (with its loop cue) ends, so the player comes back to a menu rather than a fight.
 * `InputActions.bindPause` wires it beside the pause action.
 */
export type VisibilityPauseHooks = {
  /** The scene's own pause path (the one Esc and Start use). */
  pause: () => void
  /** True while the pause key would do something else (already paused, dialogue, a modal): a hidden tab then leaves it alone. */
  blocked?: () => boolean
}
export type VisibilityPauseState = Readonly<{ hidden: boolean; sceneRunning: boolean; menuOpen: boolean; blocked: boolean }>

export function shouldPauseOnHidden(state: VisibilityPauseState): boolean {
  return state.hidden && state.sceneRunning && !state.menuOpen && !state.blocked
}

export type VisibilityDocument = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>

/** `cancelInput` drops held keys and the pending charge (its cancel stops the charge loop cue) on every hide. */
export function bindVisibilityPause(
  scene: Phaser.Scene,
  hooks: VisibilityPauseHooks,
  cancelInput: () => void,
  doc: VisibilityDocument | undefined = typeof document === 'undefined' ? undefined : document
): () => void {
  if (!doc) return () => {}
  const onChange = () => {
    if (doc.visibilityState !== 'hidden' || !scene.sys.isActive()) return
    cancelInput()
    const state = { hidden: true, sceneRunning: scene.sys.isActive(), menuOpen: scene.scene.isActive('SystemMenu'), blocked: hooks.blocked?.() ?? false }
    if (shouldPauseOnHidden(state)) hooks.pause()
  }
  doc.addEventListener('visibilitychange', onChange)
  const off = () => doc.removeEventListener('visibilitychange', onChange)
  scene.events.once('shutdown', off)
  return off
}
