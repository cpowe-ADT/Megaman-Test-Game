export interface ArenaHooks {
  lockDoors?: () => void
  unlockDoors?: () => void
  startBossMusic?: () => void
  stopBossMusic?: () => void
  dropReward?: () => void
}

export class ArenaController {
  constructor(private readonly hooks: ArenaHooks) {}

  onIntroStart(): void {
    this.hooks.lockDoors?.()
    this.hooks.startBossMusic?.()
  }

  onBossDeath(): void {
    this.hooks.unlockDoors?.()
    this.hooks.stopBossMusic?.()
    this.hooks.dropReward?.()
  }
}
