import Phaser from 'phaser'
import InputActions from '../input/InputActions'
import { showToast } from '../core/navigation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import {
  evaluateFinalGate,
  getProgressionItemLabel,
  parseProgressionTransport,
  serializeProgressionTransport
} from '../progression'
import { Save } from '../systems/Save'
import { GAME_SIZE } from '../config/renderPolicy'

type ProgressionSummarySceneData = {
  returnSceneKey?: string
  sourceSceneKey?: 'Game' | 'StageSelect'
}

type ProgressionSummarySnapshot = {
  sourceScene: string
  seed: string
  checkedLocations: number
  receivedItems: string[]
  unlockedStages: string[]
  checkpoints: number
  finalGateText: string
}

export class ProgressionSummaryScene extends Phaser.Scene {
  private returnSceneKey = 'SystemMenu'
  private sourceSceneKey: 'Game' | 'StageSelect' = 'StageSelect'
  public debugSummary: ProgressionSummarySnapshot | null = null

  constructor() {
    super('ProgressionSummary')
  }

  create(data?: ProgressionSummarySceneData): void {
    this.returnSceneKey = data?.returnSceneKey || 'SystemMenu'
    this.sourceSceneKey = data?.sourceSceneKey === 'Game' ? 'Game' : 'StageSelect'

    const save = Save.load()
    const transport = Save.exportProgression()
    const gate = evaluateFinalGate(save)
    const { width, height } = GAME_SIZE
    const panelWidth = Math.min(width - 18, 420)
    const panelHeight = Math.min(height - 14, 238)
    const panelX = Math.round(width / 2)
    const panelY = Math.round(height / 2)
    const left = panelX - panelWidth / 2 + 16
    const top = panelY - panelHeight / 2 + 12
    const innerWidth = panelWidth - 32
    const columnGap = 18
    const columnWidth = Math.floor((innerWidth - columnGap) / 2)
    const rightColumnX = left + columnWidth + columnGap
    const stageLine = transport.slotData.startingStageIds.map((id) => id.replace(/_/g, ' ').toUpperCase()).join(' • ')
    const unlockedStages = save.stageAccessUnlocked ?? []
    const receivedItems = transport.receivedItems.slice(-4).reverse().map((itemId) => getProgressionItemLabel(itemId))
    const checkpointCount = Object.values(transport.checkpoints ?? {}).reduce(
      (sum, checkpointIds) => sum + (Array.isArray(checkpointIds) ? checkpointIds.length : 0),
      0
    )
    const finalGateText = gate.unlocked
      ? 'Final Route Ready'
      : gate.rules.map((rule) => `${rule.category} ${gate.counts[rule.category]}/${rule.required}`).join(' • ')
    const canImport = this.sourceSceneKey === 'StageSelect'

    this.debugSummary = {
      sourceScene: this.returnSceneKey,
      seed: transport.slotData.seed,
      checkedLocations: transport.checkedLocations.length,
      receivedItems,
      unlockedStages,
      checkpoints: checkpointCount,
      finalGateText
    }

    this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.74)
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x08172d, 0.98).setStrokeStyle(2, 0x4a8cff, 0.95)

    this.add.text(panelX, top, 'PROGRESSION SUMMARY', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#f5f8ff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0)

    this.add.text(panelX, top + 18, 'Offline slot snapshot and final-route progress', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#9ec2ff'
    }).setOrigin(0.5, 0)

    const addSummaryBlock = (x: number, y: number, label: string, value: string, wrapWidth = columnWidth): number => {
      this.add.text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#7fc7ff',
        fontStyle: 'bold'
      })
      const valueText = this.add.text(x, y + 10, value, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#f5f8ff',
        wordWrap: { width: wrapWidth, useAdvancedWrap: true }
      })
      return valueText.y + valueText.height + 8
    }

    let leftY = top + 40
    leftY = addSummaryBlock(left, leftY, 'Seed', transport.slotData.seed)
    leftY = addSummaryBlock(left, leftY, 'Checks', `${transport.checkedLocations.length} claimed`)
    leftY = addSummaryBlock(left, leftY, 'Items', `${transport.receivedItems.length} received`)
    leftY = addSummaryBlock(left, leftY, 'Checkpoints', `${checkpointCount} unlocked`)

    let rightY = top + 40
    rightY = addSummaryBlock(rightColumnX, rightY, 'Starts', stageLine || 'TUTORIAL')
    rightY = addSummaryBlock(rightColumnX, rightY, 'Unlocked stages', `${unlockedStages.length}`)
    rightY = addSummaryBlock(rightColumnX, rightY, 'Final gate', finalGateText)

    const latestItemsTop = Math.max(leftY, rightY) + 4
    this.add.text(left, latestItemsTop, 'Latest Items', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#7fc7ff',
      fontStyle: 'bold'
    })

    const latestItemsText =
      receivedItems.length > 0
        ? receivedItems.join('\n')
        : 'No checks claimed yet.'

    this.add.text(left, latestItemsTop + 10, latestItemsText, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#d6e8ff',
      lineSpacing: 2,
      wordWrap: { width: innerWidth, useAdvancedWrap: true }
    })

    const transportNoteY = panelY + panelHeight / 2 - 50
    const actionTopY = panelY + panelHeight / 2 - 31
    const actionBottomY = panelY + panelHeight / 2 - 14
    this.add.text(panelX, transportNoteY, 'Transport: slotData + checkedLocations + receivedItems + checkpoints', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#8fa5c7'
    }).setOrigin(0.5, 0)

    const copyLabel = this.addActionButton(panelX - 118, actionTopY, 'C: Copy', () => {
      void this.copyTransport()
    })
    const downloadLabel = this.addActionButton(panelX - 8, actionTopY, 'D: Download', () => {
      this.downloadTransport()
    })
    const backLabel = this.addActionButton(panelX + 102, actionTopY, 'Esc: Back', () => this.close())
    const importLabel = this.addActionButton(panelX - 118, actionBottomY, canImport ? 'V: Paste' : 'V: Stage Select', () => {
      if (!canImport) {
        showToast(this, 'Paste progression from Stage Select only.', 1200)
        return
      }
      void this.importTransport()
    }, canImport)
    const uploadLabel = this.addActionButton(panelX - 8, actionBottomY, canImport ? 'U: Upload File' : 'U: Stage Select', () => {
      if (!canImport) {
        showToast(this, 'Upload progression from Stage Select only.', 1200)
        return
      }
      void this.uploadTransport()
    }, canImport)

    copyLabel.setOrigin(0.5)
    downloadLabel.setOrigin(0.5)
    importLabel.setOrigin(0.5)
    uploadLabel.setOrigin(0.5)
    backLabel.setOrigin(0.5)

    bindMenuConfirmCancel(this, {
      onConfirm: () => this.close(),
      onCancel: () => this.close()
    })

    const copyHandler = () => {
      void this.copyTransport()
    }
    const downloadHandler = () => {
      this.downloadTransport()
    }
    const pasteHandler = () => {
      if (!canImport) {
        showToast(this, 'Paste progression from Stage Select only.', 1200)
        return
      }
      void this.importTransport()
    }
    const uploadHandler = () => {
      if (!canImport) {
        showToast(this, 'Upload progression from Stage Select only.', 1200)
        return
      }
      void this.uploadTransport()
    }

    const actions = InputActions.forScene(this)
    actions.onPressed('copyProgression', copyHandler)
    actions.onPressed('downloadProgression', downloadHandler)
    actions.onPressed('pasteProgression', pasteHandler)
    actions.onPressed('uploadProgression', uploadHandler)
  }

  private addActionButton(
    x: number,
    y: number,
    label: string,
    onActivate: () => void,
    enabled = true
  ): Phaser.GameObjects.Text {
    const button = this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: enabled ? '#f5f8ff' : '#9aa8bd',
      backgroundColor: enabled ? '#123259' : '#1a2940',
      padding: { x: 8, y: 4 }
    })
    if (enabled) {
      button.setInteractive({ useHandCursor: true })
      button.on('pointerdown', onActivate)
    }
    return button
  }

  private getTransportFileName(): string {
    const seed = String(Save.load().progressionWorld?.seed ?? 'snapshot').replace(/[^a-z0-9_-]+/gi, '-')
    return `progression-${seed || 'snapshot'}.json`
  }

  private getTransportText(): string {
    return serializeProgressionTransport(Save.exportProgression())
  }

  private async copyTransport(): Promise<void> {
    const text = this.getTransportText()
    try {
      await navigator.clipboard.writeText(text)
      showToast(this, 'Progression snapshot copied.', 1200)
      return
    } catch {
      window.prompt('Copy progression snapshot JSON:', text)
      showToast(this, 'Clipboard unavailable. Prompt opened.', 1400)
    }
  }

  private downloadTransport(): void {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      window.prompt('Save progression snapshot JSON:', this.getTransportText())
      showToast(this, 'Download unavailable. Prompt opened.', 1400)
      return
    }

    const blob = new Blob([this.getTransportText()], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = this.getTransportFileName()
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    showToast(this, 'Progression snapshot downloaded.', 1200)
  }

  private async uploadTransport(): Promise<void> {
    if (typeof document === 'undefined') {
      await this.importTransport()
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    document.body.appendChild(input)

    const cleanup = () => input.remove()
    input.addEventListener(
      'change',
      async () => {
        try {
          const file = input.files?.[0]
          if (!file) {
            showToast(this, 'Upload cancelled.', 1000)
            return
          }
          const raw = await file.text()
          await this.importTransportText(raw.trim())
        } finally {
          cleanup()
        }
      },
      { once: true }
    )
    input.click()
  }

  private async importTransport(): Promise<void> {
    let raw = ''
    try {
      raw = (await navigator.clipboard.readText()).trim()
    } catch {
      raw = ''
    }

    if (!raw) {
      raw = String(window.prompt('Paste progression snapshot JSON:') ?? '').trim()
    }

    if (!raw) {
      showToast(this, 'Import cancelled.', 1000)
      return
    }

    await this.importTransportText(raw)
  }

  private async importTransportText(raw: string): Promise<void> {
    try {
      const payload = parseProgressionTransport(raw)
      Save.importProgression(payload)
      const sourceScene = this.scene.manager.keys[this.sourceSceneKey] as Phaser.Scene | undefined
      ;(sourceScene as { refreshFromSave?: () => void } | undefined)?.refreshFromSave?.()
      showToast(this, 'Progression snapshot imported.', 1200)
      this.scene.stop()
      if (this.returnSceneKey && this.scene.manager.keys[this.returnSceneKey]) {
        this.scene.stop(this.returnSceneKey)
      }
      if (this.sourceSceneKey && this.scene.manager.keys[this.sourceSceneKey]) {
        this.scene.resume(this.sourceSceneKey)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.'
      showToast(this, message, 1500)
    }
  }

  private close(): void {
    const target = this.returnSceneKey
    this.scene.stop()
    if (target && this.scene.manager.keys[target]) {
      this.scene.resume(target)
    }
  }
}

export default ProgressionSummaryScene
