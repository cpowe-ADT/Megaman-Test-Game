import Phaser from 'phaser'

type BossDefinition = {
  key: string
  name: string
  color: number
}

const BOSSES: BossDefinition[] = [
  { key: 'ember_man', name: 'Ember Man', color: 0xff6b6b },
  { key: 'aqua_woman', name: 'Aqua Woman', color: 0x4dc9ff },
  { key: 'volt_knight', name: 'Volt Knight', color: 0xffd166 },
  { key: 'frost_king', name: 'Frost King', color: 0xcde9ff },
  { key: 'gale_ranger', name: 'Gale Ranger', color: 0xa0ffd0 },
  { key: 'metal_magus', name: 'Metal Magus', color: 0xc0c0c0 },
  { key: 'terra_brute', name: 'Terra Brute', color: 0x9b7653 },
  { key: 'smoke_ninja', name: 'Smoke Ninja', color: 0xaaaaaa }
]

export class StageSelect extends Phaser.Scene {
  private index = 0
  private slots: Phaser.Math.Vector2[] = []
  private cursor!: Phaser.GameObjects.Rectangle

  constructor() {
    super('StageSelect')
  }

  create(): void {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#10131a')

    this.add
      .text(width / 2, 24, 'Stage Select', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff'
      })
      .setOrigin(0.5)

    this.drawGrid()
    this.cursor = this.add
      .rectangle(0, 0, 58, 38)
      .setStrokeStyle(2, 0xffffff)
      .setFillStyle(0xffffff, 0)

    this.updateCursor()

    this.add
      .text(width / 2, height - 16, 'Arrows to move • Enter to start', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad'
      })
      .setOrigin(0.5)

    const keyboard = this.input.keyboard
    keyboard?.on('keydown-LEFT', () => this.move(-1))
    keyboard?.on('keydown-RIGHT', () => this.move(1))
    keyboard?.on('keydown-UP', () => this.move(-4))
    keyboard?.on('keydown-DOWN', () => this.move(4))
    keyboard?.on('keydown-ENTER', () => this.confirm())
    keyboard?.on('keydown-SPACE', () => this.confirm())
  }

  private drawGrid(): void {
    const { width } = this.scale
    const startX = width / 2 - 120
    const startY = 60
    const cellW = 60
    const cellH = 40

    BOSSES.forEach((boss, i) => {
      const col = i % 4
      const row = Math.floor(i / 4)
      const x = startX + col * cellW + cellW / 2
      const y = startY + row * cellH + cellH / 2

      const rect = this.add
        .rectangle(x, y, cellW - 8, cellH - 8, boss.color, 0.25)
        .setStrokeStyle(2, boss.color)

      this.add
        .text(rect.x, rect.y, boss.name, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffffff',
          align: 'center'
        })
        .setOrigin(0.5)

      this.slots.push(new Phaser.Math.Vector2(rect.x, rect.y))
    })
  }

  private updateCursor(): void {
    const slot = this.slots[this.index]
    if (!slot) {
      return
    }
    this.cursor.setPosition(slot.x, slot.y)
  }

  private move(delta: number): void {
    const len = BOSSES.length
    this.index = (this.index + delta + len) % len
    this.updateCursor()
  }

  private confirm(): void {
    const boss = BOSSES[this.index]
    this.scene.start('Game', { boss: boss.key })
  }
}
