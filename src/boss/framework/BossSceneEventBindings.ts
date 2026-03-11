import Phaser from 'phaser'

type BossSceneEventBindingsOptions = {
  events: Phaser.Events.EventEmitter
  playBossMusic: () => void
  playStageMusic: () => void
  onPhaseChanged: (phaseName: string) => void
  onAttack: (event: { attack: any; attackData?: any }) => void
  onBossDamage: (hp: { current: number; max: number }) => void
  onBossDefeated: (rewardName: string) => void
}

export class BossSceneEventBindings {
  private bound = false

  private readonly phaseHandler = (event: { phase?: { name?: string } }) => {
    const phaseName = String(event?.phase?.name ?? '').toUpperCase()
    if (phaseName) {
      this.options.onPhaseChanged(phaseName)
    }
  }

  private readonly attackHandler = (event: { attack: any; attackData?: any }) => {
    this.options.onAttack(event)
  }

  private readonly musicStartHandler = () => {
    this.options.playBossMusic()
  }

  private readonly musicStopHandler = () => {
    this.options.playStageMusic()
  }

  private readonly damageHandler = (event: { hp?: { current: number; max: number } }) => {
    if (event?.hp) {
      this.options.onBossDamage(event.hp)
    }
  }

  private readonly defeatedHandler = (event: { reward?: { displayName?: string } }) => {
    this.options.onBossDefeated(String(event?.reward?.displayName ?? ''))
  }

  constructor(private readonly options: BossSceneEventBindingsOptions) {}

  bind(): void {
    if (this.bound) {
      return
    }

    this.options.events.on('boss-phase-change', this.phaseHandler)
    this.options.events.on('boss-attack', this.attackHandler)
    this.options.events.on('boss-music-start', this.musicStartHandler)
    this.options.events.on('boss-music-stop', this.musicStopHandler)
    this.options.events.on('boss-damage', this.damageHandler)
    this.options.events.on('boss-defeated', this.defeatedHandler)
    this.bound = true
  }

  destroy(): void {
    if (!this.bound) {
      return
    }

    this.options.events.off('boss-phase-change', this.phaseHandler)
    this.options.events.off('boss-attack', this.attackHandler)
    this.options.events.off('boss-music-start', this.musicStartHandler)
    this.options.events.off('boss-music-stop', this.musicStopHandler)
    this.options.events.off('boss-damage', this.damageHandler)
    this.options.events.off('boss-defeated', this.defeatedHandler)
    this.bound = false
  }
}
