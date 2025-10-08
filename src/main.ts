import Phaser from 'phaser'
import { Boot } from './scenes/Boot'
import { Preload } from './scenes/Preload'
import { StageSelect } from './scenes/StageSelect'
import { Game } from './scenes/Game'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0b0d12',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 448,
    height: 252,
    zoom: Math.max(1, Math.round((window.devicePixelRatio ?? 1) * 1.25))
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false
    }
  },
  pixelArt: true,
  scene: [Boot, Preload, StageSelect, Game]
}

new Phaser.Game(config)
