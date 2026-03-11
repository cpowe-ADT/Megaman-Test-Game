export class IFrameController {
  private invulnerableUntilMs = 0

  isInvulnerable(nowMs: number): boolean {
    return nowMs < this.invulnerableUntilMs
  }

  start(nowMs: number, durationMs: number): void {
    const duration = Math.max(0, durationMs)
    this.invulnerableUntilMs = Math.max(this.invulnerableUntilMs, nowMs + duration)
  }

  clear(): void {
    this.invulnerableUntilMs = 0
  }

  getRemainingMs(nowMs: number): number {
    return Math.max(0, this.invulnerableUntilMs - nowMs)
  }
}
