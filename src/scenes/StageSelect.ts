import Phaser from 'phaser'
import { ORDERED_BOSSES } from '../bosses/roster'

export class StageSelect extends Phaser.Scene {
  private index = 0
  private slots: Phaser.Math.Vector2[] = []
  private cursor!: Phaser.GameObjects.Rectangle
  private infoText!: Phaser.GameObjects.Text
  private bossNameText!: Phaser.GameObjects.Text
  private elementText!: Phaser.GameObjects.Text
  private previewTitle!: Phaser.GameObjects.Text
  private previewDescription!: Phaser.GameObjects.Text

  constructor() {
    super('StageSelect')
  }

  create(): void {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#06090f')

    this.createBackdrop(width, height)
    this.createHeader(width)
    this.drawGrid()
    this.createPreviewPanel(width, height)
    this.cursor = this.add
      .rectangle(0, 0, 62, 42)
      .setStrokeStyle(3, 0xffffff, 0.8)
      .setFillStyle(0xffffff, 0)
      .setDepth(3)

    this.updateCursor()
    this.updatePreview()

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

  private createBackdrop(width: number, height: number): void {
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x0d1424)
      .setAlpha(0.95)

    this.add
      .rectangle(width / 2, height / 2, width, height, 0x1a2847)
      .setAlpha(0.35)

    this.add
      .rectangle(width / 2, height - 60, width, 120, 0x03060c)
      .setAlpha(0.35)
  }

  private createHeader(width: number): void {
    this.add
      .rectangle(width / 2, 52, width - 48, 72, 0x101c33, 0.85)
      .setStrokeStyle(2, 0x3a75c4, 0.6)

    this.add
      .text(width / 2, 38, 'MISSION SELECT', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffffff',
        letterSpacing: 2
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 68, 'Choose a Maverick to infiltrate their stronghold', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8fb8ff'
      })
      .setOrigin(0.5)
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
          fontSize: '12px',
          color: '#ffffff',
          align: 'center',
          fontStyle: 'bold'
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
    this.updatePreview()
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

  private createPreviewPanel(width: number, height: number): void {
    const panelWidth = width - 80
    const panelY = height - 120

    this.add
      .rectangle(width / 2, panelY, panelWidth, 104, 0x0c1324, 0.9)
      .setStrokeStyle(2, 0x3a75c4, 0.6)

    this.previewTitle = this.add
      .text(width / 2, panelY - 20, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)

    this.previewDescription = this.add
      .text(width / 2, panelY + 12, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#c7d8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 40 }
      })
      .setOrigin(0.5)
  }

  private updatePreview(): void {
    const entry = ORDERED_BOSSES[this.index]
    if (!entry) {
      return
    }
    const { blueprint } = entry
    this.previewTitle.setText(`${blueprint.codename.toUpperCase()} // ${blueprint.introCallout}`)
    this.previewDescription.setText(
      `Arena: ${blueprint.arena}\n` +
        `Profile: ${blueprint.movementProfile.mobilityNotes}`
    )
  }

  private createFooter(width: number, height: number): void {
    const footerY = height - 32
    this.add
      .rectangle(width / 2, footerY, width - 120, 40, 0x091020, 0.8)
      .setStrokeStyle(1, 0x3a75c4, 0.4)

    this.add
      .text(width / 2, footerY, '← → / ↑ ↓ NAVIGATE   •   ENTER / SPACE START MISSION', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9acbff'
      })
      .setOrigin(0.5)
  }
}
