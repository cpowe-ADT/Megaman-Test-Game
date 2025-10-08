import Phaser from 'phaser'

type BossDefinition = {
  key: string
  name: string
  color: number
  description: string
}

const BOSSES: BossDefinition[] = [
  {
    key: 'ember_man',
    name: 'Ember Man',
    color: 0xff6b6b,
    description: 'Lava foundries and superheated vents test your reflexes.'
  },
  {
    key: 'aqua_woman',
    name: 'Aqua Woman',
    color: 0x4dc9ff,
    description: 'Navigate tide turbines and electrified water traps.'
  },
  {
    key: 'volt_knight',
    name: 'Volt Knight',
    color: 0xffd166,
    description: 'Charge through neon circuitry and magnetic hazards.'
  },
  {
    key: 'frost_king',
    name: 'Frost King',
    color: 0xcde9ff,
    description: 'Icy battlements hide slippery pitfalls and blizzards.'
  },
  {
    key: 'gale_ranger',
    name: 'Gale Ranger',
    color: 0xa0ffd0,
    description: 'Ride thermal updrafts between floating sky platforms.'
  },
  {
    key: 'metal_magus',
    name: 'Metal Magus',
    color: 0xc0c0c0,
    description: 'Clockwork labs packed with gears and laser sentries.'
  },
  {
    key: 'terra_brute',
    name: 'Terra Brute',
    color: 0x9b7653,
    description: 'Buried bunkers rumble with quakes and crushing pistons.'
  },
  {
    key: 'smoke_ninja',
    name: 'Smoke Ninja',
    color: 0xaaaaaa,
    description: 'Shadow alleys and illusions conceal swift ambushes.'
  }
]

export class StageSelect extends Phaser.Scene {
  private index = 0
  private slots: Phaser.Math.Vector2[] = []
  private cursor!: Phaser.GameObjects.Rectangle
  private slotCards: Phaser.GameObjects.Rectangle[] = []
  private slotLabels: Phaser.GameObjects.Text[] = []
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

    this.createFooter(width, height)

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
    const startX = width / 2 - 130
    const startY = 120
    const cellW = 70
    const cellH = 44

    BOSSES.forEach((boss, i) => {
      const col = i % 4
      const row = Math.floor(i / 4)
      const x = startX + col * cellW + cellW / 2
      const y = startY + row * cellH + cellH / 2

      const card = this.add
        .rectangle(x, y, cellW - 8, cellH - 8, boss.color, 0.28)
        .setStrokeStyle(2, boss.color, 0.9)
        .setDepth(1)

      const label = this.add
        .text(card.x, card.y - 2, boss.name.toUpperCase(), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
          align: 'center',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)

      this.slots.push(new Phaser.Math.Vector2(card.x, card.y))
      this.slotCards.push(card)
      this.slotLabels.push(label)
    })
  }

  private updateCursor(): void {
    const slot = this.slots[this.index]
    if (!slot) {
      return
    }
    this.cursor.setPosition(slot.x, slot.y)
    this.slotCards.forEach((card, idx) => {
      const boss = BOSSES[idx]
      const isActive = idx === this.index
      card
        .setScale(isActive ? 1.08 : 1)
        .setFillStyle(boss.color, isActive ? 0.55 : 0.28)
        .setDepth(isActive ? 2 : 1)
    })
    this.slotLabels.forEach((label, idx) => {
      label.setAlpha(idx === this.index ? 1 : 0.75)
    })
  }

  private move(delta: number): void {
    const len = BOSSES.length
    this.index = (this.index + delta + len) % len
    this.updateCursor()
    this.updatePreview()
  }

  private confirm(): void {
    const boss = BOSSES[this.index]
    this.scene.start('Game', { boss: boss.key })
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
    const boss = BOSSES[this.index]
    if (!boss) {
      return
    }
    this.previewTitle.setText(`${boss.name.toUpperCase()} // MISSION BRIEF`)
    this.previewTitle.setColor('#ffffff')
    this.previewDescription.setText(boss.description)
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
