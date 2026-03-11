import { HUD } from '../../ui/HUD'

export interface BossHpProvider {
  getBossHealth: () => { current: number; max: number }
}

export class BossUIBinder {
  private displayCurrent = 0
  private displayMax = 1

  constructor(
    private readonly hud: HUD,
    private readonly provider: BossHpProvider,
    private readonly smoothFactor = 0.2
  ) {}

  onFightStart(): void {
    const hp = this.provider.getBossHealth()
    this.displayCurrent = hp.current
    this.displayMax = hp.max
    this.hud.setBossBarVisible(true)
    this.hud.updateBossHp(hp.current, hp.max)
  }

  onBossDeath(): void {
    this.displayCurrent = 0
    this.hud.updateBossHp(0, this.displayMax)
    this.hud.setBossBarVisible(false)
  }

  update(): void {
    const hp = this.provider.getBossHealth()
    this.displayMax = hp.max
    const delta = hp.current - this.displayCurrent
    this.displayCurrent += delta * this.smoothFactor
    if (Math.abs(delta) < 0.15) {
      this.displayCurrent = hp.current
    }
    this.hud.updateBossHp(this.displayCurrent, this.displayMax)
  }
}
