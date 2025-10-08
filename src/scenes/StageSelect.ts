import Phaser from 'phaser'
import { ORDERED_BOSSES } from '../bosses/roster'

export class StageSelect extends Phaser.Scene {
  private index = 0
  private slots: Phaser.Math.Vector2[] = []
  private cursor!: Phaser.GameObjects.Rectangle
  private infoText!: Phaser.GameObjects.Text
  private bossNameText!: Phaser.GameObjects.Text
  private elementText!: Phaser.GameObjects.Text

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

    this.bossNameText = this.add
      .text(width - 16, 56, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff'
      })
      .setOrigin(1, 0)

    this.elementText = this.add
      .text(width - 16, 76, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad'
      })
      .setOrigin(1, 0)

    this.infoText = this.add
      .text(width - 16, 100, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#cbd3ff',
        align: 'right',
        wordWrap: { width: 120 }
      })
      .setOrigin(1, 0)

    this.refreshInfo()

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
    const startX = width / 2 - 96
    const startY = 64
    const cellW = 64
    const cellH = 40
    const bosses = ORDERED_BOSSES

    bosses.forEach((entry, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = startX + col * cellW + cellW / 2
      const y = startY + row * cellH + cellH / 2

      const rect = this.add
        .rectangle(x, y, cellW - 8, cellH - 8, entry.blueprint.theme.primary, 0.22)
        .setStrokeStyle(2, entry.blueprint.theme.primary)

      this.add
        .text(rect.x, rect.y - 6, entry.blueprint.codename, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffffff',
          align: 'center'
        })
        .setOrigin(0.5)

      this.add
        .text(rect.x, rect.y + 6, `${entry.blueprint.element.toUpperCase()}`, {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#9ad'
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
    this.refreshInfo()
  }

  private move(delta: number): void {
    const len = ORDERED_BOSSES.length
    this.index = (this.index + delta + len) % len
    this.updateCursor()
  }

  private confirm(): void {
    const entry = ORDERED_BOSSES[this.index]
    this.scene.start('Game', { bossId: entry.id })
  }

  private refreshInfo(): void {
    const entry = ORDERED_BOSSES[this.index]
    if (!entry) {
      return
    }
    this.bossNameText.setText(entry.blueprint.codename)
    this.elementText.setText(
      `Type: ${entry.blueprint.element}  Weak to: ${entry.weakTo}  Resists: ${entry.strongAgainst}`
    )
    const blueprint = entry.blueprint
    const reward = blueprint.weaponReward
    this.infoText.setText(
      `Arena: ${blueprint.arena}\nReward: ${reward.displayName}\n${reward.description}`
    )
  }
}
