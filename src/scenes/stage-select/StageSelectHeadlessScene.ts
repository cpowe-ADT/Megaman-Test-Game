import { ManagedScene, SceneManager } from '../../core/SceneManager'
import { StageSelectLogic } from './StageSelectLogic'

export interface StageSelectInputBridge {
  isPressed(action: 'confirm' | 'pause' | 'toggleDebug'): boolean
  isDown(action: 'jump'): boolean
}

export class StageSelectHeadlessScene implements ManagedScene {
  readonly key = 'StageSelect'
  private readonly logic = new StageSelectLogic()

  constructor(private readonly input: StageSelectInputBridge) {}

  update(_dt: number, manager: SceneManager): void {
    if (this.input.isPressed('confirm')) {
      const transition = this.logic.confirm()
      if (transition) {
        manager.requestChange(new FightHeadlessScene(transition.data.bossId))
      }
    }
  }
}

class FightHeadlessScene implements ManagedScene {
  readonly key = 'Game'

  constructor(readonly bossId: string) {}

  update(_dt: number, _manager: SceneManager): void {
    // No-op for headless verification.
  }
}
