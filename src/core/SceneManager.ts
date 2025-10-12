export interface ManagedScene {
  key?: string
  update?(dt: number, manager: SceneManager): void
  onEnter?(): void
  onExit?(): void
}

export class SceneManager {
  private currentScene?: ManagedScene
  private pendingScene: ManagedScene | null = null
  transitionRequestedAt = 0

  constructor() {
    attachSceneManagerDebugHandle(this)
  }

  start(scene: ManagedScene): void {
    this.pendingScene = scene
    this.transitionRequestedAt = performance.now()
    const swapped = this.applyPendingScene()
    if (swapped) {
      logEntered(this.currentScene)
    }
  }

  requestChange(next: ManagedScene): void {
    this.pendingScene = next
    this.transitionRequestedAt = performance.now()
    logTransition(next)
  }

  update(dt: number): void {
    const swapped = this.applyPendingScene()
    if (swapped) {
      logEntered(this.currentScene)
    }
    this.currentScene?.update?.(dt, this)
  }

  current(): ManagedScene | undefined {
    return this.currentScene
  }

  currentName(): string {
    return describeScene(this.currentScene)
  }

  private applyPendingScene(): boolean {
    if (!this.pendingScene) {
      return false
    }

    const next = this.pendingScene
    this.pendingScene = null

    if (this.currentScene === next) {
      this.transitionRequestedAt = 0
      return false
    }

    this.currentScene?.onExit?.()
    this.currentScene = next
    this.currentScene?.onEnter?.()
    this.transitionRequestedAt = 0
    return true
  }
}

function describeScene(scene: ManagedScene | undefined | null): string {
  if (!scene) {
    return 'None'
  }

  if (scene.key) {
    return scene.key
  }

  const ctorName = scene.constructor?.name
  return ctorName && ctorName.length > 0 ? ctorName : 'Unknown'
}

function logTransition(scene: ManagedScene): void {
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('transition→', describeScene(scene))
  }
}

function logEntered(scene: ManagedScene | undefined): void {
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('entered', describeScene(scene))
  }
}

function attachSceneManagerDebugHandle(manager: SceneManager): void {
  const globalTarget = globalThis as typeof globalThis & { __sm?: SceneManager }
  globalTarget.__sm = manager

  if (typeof window !== 'undefined') {
    ;(window as Window & { __sm?: SceneManager }).__sm = manager
  }
}

declare global {
  interface Window {
    __sm?: SceneManager
  }

  var __sm: SceneManager | undefined
}
