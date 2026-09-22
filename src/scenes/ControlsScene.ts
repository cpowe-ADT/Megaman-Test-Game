import Phaser from 'phaser'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { CONTROL_NOTES, CONTROL_SECTIONS } from '../ui/controls/controlMap'
import {
  addMenuBackdrop,
  addMenuPanel,
  MENU_COLORS,
  MENU_FONT_BODY,
  MENU_FONT_CODE,
  MENU_FONT_DISPLAY,
  styleMenuHeading
} from '../ui/menu/menuTheme'
import { GAME_SIZE } from '../config/renderPolicy'

type ControlsSceneData = {
  returnSceneKey?: string
}

export class ControlsScene extends Phaser.Scene {
  private returnSceneKey = 'Title'

  constructor() {
    super('Controls')
  }

  create(data?: ControlsSceneData): void {
    this.returnSceneKey = data?.returnSceneKey || 'Title'

    const { width, height } = GAME_SIZE
    const panelWidth = Math.min(width - 20, 408)
    const panelHeight = Math.min(height - 16, 228)
    const panelX = Math.round(width / 2)
    const panelY = Math.round(height / 2)
    const left = panelX - panelWidth / 2 + 16
    const top = panelY - panelHeight / 2 + 14
    const columnGap = 18
    const columnWidth = Math.floor((panelWidth - 32 - columnGap) / 2)
    const rightColumnX = left + columnWidth + columnGap

    this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.72)
    addMenuBackdrop(this, 0.38)
    addMenuPanel(this, panelX, panelY, panelWidth, panelHeight)

    styleMenuHeading(this.add.text(panelX, top - 2, 'CONTROL MAP', {
      fontFamily: MENU_FONT_DISPLAY,
      fontSize: '16px',
      color: '#f5f8ff'
    }).setOrigin(0.5, 0))

    this.add.text(panelX, top + 17, 'FIELD INPUT REFERENCE', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#5de1ff',
      letterSpacing: 2
    }).setOrigin(0.5, 0)

    this.add.rectangle(panelX, top + 31, panelWidth - 30, 1, MENU_COLORS.blue, 0.65)

    let leftColumnY = top + 36
    let rightColumnY = top + 36

    leftColumnY = this.renderSection(left, leftColumnY, columnWidth, CONTROL_SECTIONS[0]!)
    rightColumnY = this.renderSection(rightColumnX, rightColumnY, columnWidth, CONTROL_SECTIONS[1]!)
    rightColumnY = this.renderSection(rightColumnX, rightColumnY + 2, columnWidth, CONTROL_SECTIONS[2]!)

    this.add.text(left, panelY + panelHeight / 2 - 34, CONTROL_NOTES.join('  '), {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#8fa5c7',
      wordWrap: { width: panelWidth - 32 }
    })

    const backLabel = this.add.text(panelX, panelY + panelHeight / 2 - 11, 'ENTER / SPACE / ESC    BACK', {
      fontFamily: MENU_FONT_BODY,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#f5f8ff',
      backgroundColor: '#164b7c',
      padding: { x: 12, y: 4 }
    }).setOrigin(0.5)

    backLabel.setInteractive({ useHandCursor: true })
    backLabel.on('pointerdown', () => this.close())

    bindMenuConfirmCancel(this, {
      onConfirm: () => this.close(),
      onCancel: () => this.close()
    })
  }

  private renderSection(
    x: number,
    startY: number,
    columnWidth: number,
    section: (typeof CONTROL_SECTIONS)[number]
  ): number {
    let cursorY = startY
    this.add.rectangle(x + columnWidth / 2, cursorY + 4, columnWidth, 15, MENU_COLORS.panelBright, 0.72)
      .setStrokeStyle(1, MENU_COLORS.blue, 0.4)
    this.add.text(x, cursorY, section.title.toUpperCase(), {
      fontFamily: MENU_FONT_BODY,
      fontSize: '9px',
      color: '#79e7ff',
      fontStyle: 'bold'
    })
    cursorY += 16

    section.rows.forEach((row, index) => {
      if (index % 2 === 0) {
        this.add.rectangle(x + columnWidth / 2, cursorY + 4, columnWidth, 10, 0x123259, 0.18)
      }
      this.add.text(x, cursorY, row.action, {
        fontFamily: MENU_FONT_BODY,
        fontSize: '8px',
        color: '#e8f3ff'
      })
      this.add.text(x + 74, cursorY, row.input, {
        fontFamily: MENU_FONT_CODE,
        fontSize: '7px',
        color: '#9fd8ff',
        wordWrap: { width: columnWidth - 74 }
      })
      cursorY += row.input.length > 18 ? 14 : 10
    })

    return cursorY + 4
  }

  private close(): void {
    const target = this.returnSceneKey
    this.scene.stop()
    if (target && this.scene.manager.keys[target]) {
      this.scene.resume(target)
    }
  }
}

export default ControlsScene
