import Phaser from 'phaser'
import { BossBlueprint } from '../src/bosses/types'

export interface BossControllerConfig {
  spawn: Phaser.Math.Vector2
  lockIntro?: boolean
}

export class BossController {
  blueprint: BossBlueprint

  constructor(scene: Phaser.Scene, blueprint: BossBlueprint, _config: BossControllerConfig) {
    this.blueprint = blueprint
    // Runtime implementation supplied by actual module; this stub satisfies type checking only.
  }

  update(_time: number, _delta: number): void {}
  unlockIntro(): void {}
  destroy(_fromScene?: boolean): void {}
}
