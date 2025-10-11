export interface ManagedScene {
  key: string
  update(dt: number, manager: SceneManager): void
  onEnter?(): void
  onExit?(): void
}

export class SceneManager {
  private active: ManagedScene | null = null
  private pending: ManagedScene | null = null

  start(scene: ManagedScene): void {
    this.pending = scene
    this.flushPending()
  }

  requestChange(next: ManagedScene): void {
    this.pending = next
  }

  update(dt: number): void {
    this.flushPending()
    this.active?.update(dt, this)
    this.flushPending()
  }

  current(): ManagedScene | null {
    return this.active
  }

  currentName(): string | null {
    return this.active?.key ?? null
  }

  private flushPending(): void {
    if (!this.pending) {
      return
    }

    const next = this.pending
    this.pending = null

    if (this.active === next) {
      return
    }

    this.active?.onExit?.()
    this.active = next
    this.active?.onEnter?.()
  }
}
