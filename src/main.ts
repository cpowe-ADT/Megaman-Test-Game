import Phaser from 'phaser'
import { Boot } from './scenes/Boot'
import { Preload } from './scenes/Preload'
import { StageSelect } from './scenes/StageSelect'
import { Game } from './scenes/Game'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 320,
  height: 180,
  zoom: 3,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false
    }
  },
  pixelArt: true,
  backgroundColor: '#0b0d12',
  scene: [Boot, Preload, StageSelect, Game]
}

new Phaser.Game(config)
