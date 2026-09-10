import { IDENTITY } from '../content/identity'
import { openNewCampaign } from './NewCampaignScene'
import { installProgressionDebugHooks } from './game/ProgressionDebugHooks'
import { countClearedRobotMasters } from '../content/campaign'
import Phaser from 'phaser'
import AudioService from '../audio'
import { ORDERED_BOSSES } from '../bosses/roster'
import {
  FINAL_STAGE_ID,
  getCampaignStage,
  getSelectableBossStages,
  isCampaignStageCleared,
  TUTORIAL_STAGE_ID
} from '../content/campaign'
import { DEBUG_UI } from '../config/debug'
import { showToast } from '../core/navigation'
import InputActions from '../input/InputActions'
import { Save, SaveData } from '../systems/Save'
import { DIALOGUE_REGISTRY, resolveDialogueText } from '../content/dialogue/index'
import { shouldPlayStory } from '../narrative/storyFlags'
import { DialogueOverlayController } from '../ui/DialogueOverlayController'
import { currentStoryPolicy, resolvePlaybackLines } from './game/StoryDirector'
import { DebugOverlay } from '../ui/DebugOverlay'
import {
  evaluateFinalGate,
  formatCheckpointLabel,
  getAccessibleCheckpointIds,
  getBossWeaknessLabel,
  getFinalGateProgressLabel,
  getFinalGateStatusLabel,
  getSelectedCheckpointId,
  getStageBossRewardLabel,
  getStageAccessRequirementLabel,
  getStageLocationDefinitions,
  isStageAccessible
} from '../progression'
import type { SystemMenuAction } from './menu/systemMenuSelector'
import { StageSelectLogic } from './stage-select/StageSelectLogic'
import { resolveSlotClick, truncateLabel } from './stage-select/selectionContract'

type SlotEntry = {
  rect: Phaser.GameObjects.Rectangle
  name: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
  badge: Phaser.GameObjects.Text
  portrait: Phaser.GameObjects.Rectangle
  portraitSprite: Phaser.GameObjects.Image
  weakness: Phaser.GameObjects.Text
  stageIndex: number | null
}

type Layout = {
  headerRect: Phaser.Geom.Rectangle
  gridRect: Phaser.Geom.Rectangle
  previewRect: Phaser.Geom.Rectangle
  footerRect: Phaser.Geom.Rectangle
  slotWidth: number
  slotHeight: number
  slotGapX: number
  slotGapY: number
}

const COLUMNS = 3
const ROWS = 3
const PAGE_SIZE = COLUMNS * ROWS

const FONT = {
  title: '13px monospace',
  subtitle: '8px monospace',
  slotTitle: '8px monospace',
  slotMeta: '7px monospace',
  panelTitle: '9px monospace',
  panelName: '13px monospace',
  panelBody: '8px monospace',
  footer: '7px monospace'
}

const COLOR = {
  bgTop: 0x081429,
  bgBottom: 0x040914,
  panel: 0x0b1c3c,
  panelInner: 0x07142a,
  border: 0x4a8cff,
  borderMuted: 0x2b5ca8,
  clearedFill: 0x1b2130,
  clearedStroke: 0x5a637a,
  text: '#f5f8ff',
  textMuted: '#9ec2ff',
  textAccent: '#8bc6ff',
  textCleared: '#a8b3c8'
}

export class StageSelect extends Phaser.Scene {
  private readonly logic = new StageSelectLogic()
  private readonly columns = COLUMNS
  private readonly rows = ROWS
  private readonly pageSize = PAGE_SIZE
  private readonly stages = getSelectableBossStages()

  private layout?: Layout
  private slots: Phaser.Math.Vector2[] = []
  private slotEntries: SlotEntry[] = []

  private index = 0
  private currentPage = 0

  public selectedBossId: string | null = null
  public canConfirm = false
  public confirmArmed = true
  public selectedCheckpointId: string | null = null
  public selectedWeaknessLabel: string | null = null
  public selectedRewardLabel: string | null = null
  public finalGateText: string | null = null

  private saveData: SaveData = Save.load()

  private previewTitle?: Phaser.GameObjects.Text
  private bossNameText?: Phaser.GameObjects.Text
  private infoText?: Phaser.GameObjects.Text
  /** Milestone playback on the return from a clear; automation reads its state. */
  dialogueOverlay?: DialogueOverlayController
  private detailsText?: Phaser.GameObjects.Text
  private previewGlow?: Phaser.GameObjects.Ellipse
  private previewSprite?: Phaser.GameObjects.Sprite
  private previewMaskShape?: Phaser.GameObjects.Graphics
  private pageIndicator?: Phaser.GameObjects.Text
  private headerProgress?: Phaser.GameObjects.Text
  private footerControls?: Phaser.GameObjects.Text
  private footerStatus?: Phaser.GameObjects.Text
  private toastHandle?: Phaser.GameObjects.Container

  private requestedTransition: { scene: string; data: Record<string, unknown> } | null = null
  private transitionRequestedAt = 0
  private armConfirmAfterRelease = false
  private confirmArmAvailableAt = 0
  private manualSelectionRequired = false

  private debugOverlay?: DebugOverlay
  private debugToggleHandler?: () => void

  constructor() {
    super('StageSelect')
  }

  create(): void {
    AudioService.playMusic(this, 'stage_select')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))
    this.saveData = Save.load()
    this.requestedTransition = null
    this.transitionRequestedAt = 0
    this.armConfirmAfterRelease = false
    this.confirmArmAvailableAt = 0
    this.confirmArmed = true
    this.manualSelectionRequired = false
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor('#050d1a')

    this.layout = this.computeLayout(width, height)
    this.createBackdrop(width, height)
    this.createHeader()
    this.createGrid()
    this.createPreviewPanel()
    this.createFooter()

    this.refreshPage()
    this.setSelection(this.index)
    this.applyPostReturnState()
    this.events.on(Phaser.Scenes.Events.RESUME, this.refreshFromSave, this)

    installProgressionDebugHooks(this, () => this.refreshFromSave())
    this.registerKeyboardShortcuts()
    InputActions.init(this)

    InputActions.forScene(this).onPressed('debugOverlay', () => this.debugOverlay?.toggle())

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }
  }

  update(): void {
    if (this.armConfirmAfterRelease && !this.confirmArmed) {
      if (this.time.now >= this.confirmArmAvailableAt && InputActions.forScene(this).confirmReleased()) {
        this.confirmArmed = true
        this.armConfirmAfterRelease = false
        this.confirmArmAvailableAt = 0
      }
    }

    if (DEBUG_UI) {
      this.debugOverlay?.update({
        sceneName: this.scene.key,
        managerName: this.scene.key,
        confirmHint: 'Enter / NumpadEnter',
        jumpHint: 'Space (gameplay)',
        pauseHint: 'Esc (gameplay)',
        transitionRequestedAt: this.transitionRequestedAt
      })
    }

  }

  private computeLayout(width: number, height: number): Layout {
    const headerRect = new Phaser.Geom.Rectangle(8, 4, width - 16, 28)
    const gridRect = new Phaser.Geom.Rectangle(8, 36, width - 16, 146)
    const previewRect = new Phaser.Geom.Rectangle(8, 186, width - 16, 40)
    const footerRect = new Phaser.Geom.Rectangle(8, height - 22, width - 16, 18)

    const slotGapX = 4
    const slotGapY = 4
    const slotWidth = Math.floor((gridRect.width - slotGapX * (this.columns - 1)) / this.columns)
    const slotHeight = Math.floor((gridRect.height - slotGapY * (this.rows - 1)) / this.rows)

    return { headerRect, gridRect, previewRect, footerRect, slotWidth, slotHeight, slotGapX, slotGapY }
  }

  private createBackdrop(width: number, height: number): void {
    const top = this.add.rectangle(width / 2, height / 2, width, height, COLOR.bgTop, 1)
    top.setDepth(-30)

    const stripe = this.add.rectangle(width / 2, height * 0.82, width, height * 0.45, COLOR.bgBottom, 0.9)
    stripe.setDepth(-29)

    const scan = this.add.graphics()
    scan.setDepth(-28)
    scan.fillStyle(0x9ec2ff, 0.03)
    for (let y = 0; y < height; y += 4) {
      scan.fillRect(0, y, width, 1)
    }
  }

  private createHeader(): void {
    const layout = this.layout!

    this.add
      .rectangle(layout.headerRect.centerX, layout.headerRect.centerY, layout.headerRect.width, layout.headerRect.height, COLOR.panel, 0.88)
      .setStrokeStyle(2, COLOR.border, 0.8)

    this.add
      .text(layout.headerRect.x + 8, layout.headerRect.y + 1, `${IDENTITY.WARDEN_TERM} SELECT`, {
        font: FONT.title,
        color: COLOR.text,
        letterSpacing: 1
      })
      .setOrigin(0, 0).setName('identity-stage-title')

    this.add.text(layout.headerRect.right - 8, layout.headerRect.y + 4,
      `8 ${IDENTITY.WARDEN_TERM_PLURAL} + ${IDENTITY.ANTAGONIST_NAME.split(' ')[0]}`,
      { font: FONT.subtitle, color: COLOR.textMuted }).setOrigin(1, 0).setName('identity-stage-caption')

    this.headerProgress = this.add
      .text(layout.headerRect.centerX, layout.headerRect.bottom - 3, '', {
        font: FONT.subtitle,
        color: COLOR.textMuted,
        align: 'center'
      })
      .setOrigin(0.5, 1)
  }

  private createGrid(): void {
    const layout = this.layout!

    this.add
      .rectangle(layout.gridRect.centerX, layout.gridRect.centerY, layout.gridRect.width, layout.gridRect.height, COLOR.panelInner, 0.7)
      .setStrokeStyle(1, COLOR.borderMuted, 0.7)

    this.slots = []
    this.slotEntries = []

    const startX = layout.gridRect.x + layout.slotWidth / 2
    const startY = layout.gridRect.y + layout.slotHeight / 2

    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.columns; col += 1) {
        const slotIndex = row * this.columns + col
        const x = Math.round(startX + col * (layout.slotWidth + layout.slotGapX))
        const y = Math.round(startY + row * (layout.slotHeight + layout.slotGapY))

        const rect = this.add
          .rectangle(x, y, layout.slotWidth, layout.slotHeight, 0x0d2247, 0.5)
          .setStrokeStyle(2, COLOR.borderMuted, 0.8)
          .setInteractive({ useHandCursor: true })

        rect.on('pointerdown', () => this.handleSlotPointerDown(slotIndex))

        const name = this.add
          .text(x, y - 10, '', {
            font: FONT.slotTitle,
            color: COLOR.text,
            align: 'center'
          })
          .setOrigin(0.5, 0)

        const meta = this.add
          .text(x, y + 2, '', {
            font: FONT.slotMeta,
            color: COLOR.textAccent,
            align: 'center',
            wordWrap: { width: layout.slotWidth - 10, useAdvancedWrap: true }
          })
          .setOrigin(0.5, 0)

        const badge = this.add
          .text(x + layout.slotWidth / 2 - 5, y - layout.slotHeight / 2 + 3, '', {
            font: FONT.slotMeta,
            color: '#0b1220',
            backgroundColor: '#d1d9e8',
            padding: { x: 3, y: 1 }
          })
          .setOrigin(1, 0)
          .setVisible(false)

        const portrait = this.add.rectangle(x - layout.slotWidth / 2 + 20, y - layout.slotHeight / 2 + 20, 32, 32).setStrokeStyle(1, COLOR.borderMuted).setFillStyle(0x07142a, .5)
        const portraitSprite = this.add.image(portrait.x, portrait.y, 'px').setVisible(false)
        const weakness = this.add.text(x - layout.slotWidth / 2 + 4, y - layout.slotHeight / 2 + 37, '', { font: FONT.slotMeta, color: COLOR.textMuted })
        this.slots.push(new Phaser.Math.Vector2(x, y))
        this.slotEntries.push({ rect, name, meta, badge, portrait, portraitSprite, weakness, stageIndex: null })
      }
    }
  }

  private createPreviewPanel(): void {
    const r = this.layout!.previewRect
    this.add.rectangle(r.centerX, r.centerY, r.width, r.height, COLOR.panel, .9).setStrokeStyle(1, COLOR.border)
    this.infoText = this.add.text(r.x + 5, r.y + 3, '', { font: FONT.panelBody, color: COLOR.text, wordWrap: { width: r.width - 10 }, lineSpacing: 0 })
    this.detailsText = this.add.text(r.x + 5, r.y + 22, '', { font: '7px monospace', color: COLOR.textMuted })
  }

  private createFooter(): void {
    const layout = this.layout!

    this.add
      .rectangle(layout.footerRect.centerX, layout.footerRect.centerY, layout.footerRect.width, layout.footerRect.height, COLOR.panel, 0.86)
      .setStrokeStyle(1, COLOR.borderMuted, 0.8)

    this.footerControls = this.add
      .text(layout.footerRect.centerX, layout.footerRect.y + 1, 'ARROWS MOVE · L/R CHECKPOINT · ENTER DEPLOY · ESC MENU', {
        font: FONT.footer,
        color: COLOR.textMuted,
        align: 'center'
      })
      .setOrigin(0.5, 0)

    this.footerStatus = this.add
      .text(layout.footerRect.centerX, layout.footerRect.y + 10, '', {
        font: FONT.footer,
        color: COLOR.textAccent,
        align: 'center'
      })
      .setOrigin(0.5, 0)
  }

  /** The 32x32 slot shows the boss atlas idle frame until prompt 03 supplies portraits; locked stages show a silhouette. */
  private bindPortrait(sprite: Phaser.GameObjects.Image, bossId: string, accessible: boolean, cleared: boolean): void {
    const atlasKey = `atlas_${bossId}`
    const frame = `${bossId}/idle/000`
    if (!this.textures.exists(atlasKey) || !this.textures.get(atlasKey).has(frame)) {
      sprite.setVisible(false)
      return
    }
    sprite.setTexture(atlasKey, frame)
    const fit = 30 / Math.max(sprite.width, sprite.height, 1)
    sprite.setScale(Math.min(1, fit)).setVisible(true)
    if (!accessible) sprite.setTint(0x1a2a4a)
    else if (cleared) sprite.setTint(0x9fb3cc)
    else sprite.clearTint()
  }

  private refreshPage(): void {
    this.headerProgress?.setText(`${IDENTITY.WARDEN_TERM_PLURAL} ${countClearedRobotMasters(this.saveData)}/8 · ${this.saveData.progressionWorld?.progressionMode === 'classic' ? 'CLASSIC' : 'RELAY RANDOMIZER'} · T TUTORIAL · F FINAL`)
    const totalPages = Math.max(1, Math.ceil(this.stages.length / this.pageSize))
    this.currentPage = Phaser.Math.Clamp(this.currentPage, 0, totalPages - 1)
    const start = this.currentPage * this.pageSize

    this.slotEntries.forEach((slot, slotIndex) => {
      const stage = this.stages[start + slotIndex]
      if (!stage) {
        slot.stageIndex = null
        slot.rect.setVisible(false).disableInteractive()
        slot.name.setVisible(false)
        slot.portraitSprite.setVisible(false)
        slot.meta.setVisible(false)
        slot.badge.setVisible(false)
        return
      }

      slot.stageIndex = start + slotIndex
      slot.rect.setVisible(true).setInteractive({ useHandCursor: true })
      slot.name.setVisible(true)
      slot.meta.setVisible(true)

      const bossEntry = ORDERED_BOSSES.find((entry) => entry.id === stage.bossId)
      const stageId = stage.id
      const accessible = isStageAccessible(this.saveData, stageId)
      const cleared = isCampaignStageCleared(this.saveData, stageId)
      const checkProgress = this.getStageCheckProgress(stage.id)
      slot.name.setText(stage.selectLabel)
      slot.name.setColor(cleared ? COLOR.textCleared : COLOR.text)
      slot.meta.setText(`${'●'.repeat(stage.difficultyRating)}${'○'.repeat(3-stage.difficultyRating)} ${cleared ? 'DONE' : accessible ? 'OPEN' : 'LOCKED'}`)
      slot.weakness.setText(stage.id === FINAL_STAGE_ID ? `${IDENTITY.WARDEN_TERM_PLURAL} ${countClearedRobotMasters(this.saveData)}/8` : `WEAK: ${getBossWeaknessLabel(this.saveData, stage.bossId)}`)
      slot.meta.setColor(cleared ? '#8793ad' : '#9ec2ff')
      slot.badge.setVisible(false)
      this.bindPortrait(slot.portraitSprite, stage.bossId, accessible, cleared)

      this.layoutSlotText(slot)
    })

    const finalState = getFinalGateStatusLabel(this.saveData)
    this.finalGateText = finalState
    this.footerStatus?.setText(finalState)
    this.updateSelectionVisuals()
  }

  private layoutSlotText(slot: SlotEntry): void {
    const left = slot.rect.x - slot.rect.width / 2, top = slot.rect.y - slot.rect.height / 2
    slot.name.setOrigin(0, 0).setPosition(left + 40, top + 4).setWordWrapWidth(slot.rect.width - 44)
    slot.meta.setOrigin(0, 0).setPosition(left + 40, top + 27)
  }

  private registerKeyboardShortcuts(): void {
    const actions = InputActions.forScene(this)
    actions.onPressed('moveLeft', () => this.move(-1))
    actions.onPressed('moveRight', () => this.move(1))
    actions.onPressed('aimUp', () => this.move(-this.columns))
    actions.onPressed('aimDown', () => this.move(this.columns))
    actions.onPressed('pagePrev', () => this.changePage(-1))
    actions.onPressed('pageNext', () => this.changePage(1))
    actions.onPressed('checkpointNext', () => this.cycleCheckpoint(1))
    actions.onPressed('checkpointPrev', () => this.cycleCheckpoint(-1))
    actions.onPressed('tutorial', () => this.launchCampaignStage(TUTORIAL_STAGE_ID))
    actions.onPressed('finalRoute', () => this.launchFinalRoute())
    actions.onPressed('confirm', () => this.handleKeyboardConfirm())
    actions.onPressed('cancel', () => {
      if (this.dialogueOverlay?.isActive()) {
        this.dialogueOverlay.skip()
        return
      }
      if (!this.scene.isActive('SystemMenu')) {
        AudioService.playSfx('ui_cancel')
        this.scene.launch('SystemMenu', { sourceScene: 'StageSelect' })
      }
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.refreshFromSave, this)
      this.toastHandle?.destroy(true)
      this.toastHandle = undefined
    })
  }

  onSystemMenuAction(action: SystemMenuAction): void {
    if (action === 'back' || action === 'resume') {
      return
    }

    if (action === 'load_game') {
      const run = Save.loadActiveRun()
      if (!run) {
        this.toastHandle?.destroy(true)
        this.toastHandle = showToast(this, 'No valid saved game found.', 1200)
        return
      }
      this.scene.start('Game', {
        bossId: run.bossId,
        stageId: run.stageId,
        loadFromSave: true
      })
      return
    }

    if (action === 'new_game') {
      openNewCampaign(this)
      return
    }

    if (action === 'clear_save') {
      Save.clearAll()
      this.saveData = Save.load()
      this.refreshPage()
      this.setSelection(0)
      this.toastHandle?.destroy(true)
      this.toastHandle = showToast(this, 'Save data cleared.', 1200)
    }
  }

  refreshFromSave(): void {
    this.saveData = Save.load()
    this.refreshPage()
    this.setSelection(this.index)
    this.updatePreview()
    this.updateDebugSelectionState()
  }

  private move(delta: number): void {
    if (this.dialogueOverlay?.isActive()) return
    const total = this.stages.length
    if (total === 0) {
      return
    }

    const next = (this.index + delta + total) % total
    if (next !== this.index) {
      AudioService.unlock()
      AudioService.playSfx('ui_move')
    }
    this.manualSelectionRequired = false
    this.setSelection(next)
  }

  private changePage(delta: number): void {
    const totalPages = Math.max(1, Math.ceil(this.stages.length / this.pageSize))
    this.currentPage = (this.currentPage + delta + totalPages) % totalPages
    AudioService.unlock()
    AudioService.playSfx('ui_move')
    this.manualSelectionRequired = false

    const start = this.currentPage * this.pageSize
    const end = Math.min(start + this.pageSize - 1, this.stages.length - 1)
    const next = Phaser.Math.Clamp(this.index, start, end)

    this.refreshPage()
    this.setSelection(next)
  }

  private handleSlotPointerDown(slotIndex: number): void {
    const slot = this.slotEntries[slotIndex]
    if (!slot || slot.stageIndex == null) {
      return
    }

    const resolution = resolveSlotClick(this.index, slot.stageIndex)
    AudioService.unlock()
    if (this.manualSelectionRequired) {
      AudioService.playSfx('ui_move')
      this.manualSelectionRequired = false
      this.setSelection(resolution.nextIndex)
      return
    }
    AudioService.playSfx(resolution.shouldConfirm ? 'ui_confirm' : 'ui_move')
    this.setSelection(resolution.nextIndex)

    if (resolution.shouldConfirm) {
      this.confirmSelection()
    }
  }

  private setSelection(nextIndex: number): void {
    this.index = Phaser.Math.Clamp(nextIndex, 0, Math.max(this.stages.length - 1, 0))
    this.logic.setIndex(this.index)
    this.logic.setCheckpointId(this.getSelectedCheckpointForStage(this.stages[this.index]?.id ?? ''))
    this.ensurePageForIndex()
    this.updateSelectionVisuals()
    this.updatePreview()
    this.updateDebugSelectionState()
  }

  private ensurePageForIndex(): void {
    const targetPage = Math.floor(this.index / this.pageSize)
    if (targetPage !== this.currentPage) {
      this.currentPage = targetPage
      this.refreshPage()
    }
  }

  private updateSelectionVisuals(): void {
    this.slotEntries.forEach((slot) => {
      if (slot.stageIndex == null) {
        return
      }

      const stage = this.stages[slot.stageIndex]
      const entry = ORDERED_BOSSES.find((boss) => boss.id === stage?.bossId)
      const primary = entry?.blueprint.theme.primary ?? COLOR.borderMuted
      const isSelected = slot.stageIndex === this.index
      const isCleared = stage ? isCampaignStageCleared(this.saveData, stage.id) : false
      slot.rect
        .setStrokeStyle(
          isSelected ? 2 : 1,
          isSelected ? 0xffffff : isCleared ? COLOR.clearedStroke : primary,
          isSelected ? 1 : 0.85
        )
        .setFillStyle(
          isSelected ? (isCleared ? 0x3b465f : 0x2a57a6) : isCleared ? COLOR.clearedFill : 0x0d2247,
          isSelected ? 0.6 : isCleared ? 0.65 : 0.5
        )
    })

  }

  private updatePreview(): void {
    const stage = this.stages[this.index]
    if (!stage || !this.infoText || !this.detailsText) return
    const cleared = isCampaignStageCleared(this.saveData, stage.id)
    const checks = this.getStageCheckProgress(stage.id)
    const checkpoint = formatCheckpointLabel(this.getSelectedCheckpointForStage(stage.id))
    const reward = getStageBossRewardLabel(this.saveData, stage.id)
    const weakness = stage.id === FINAL_STAGE_ID ? '—' : getBossWeaknessLabel(this.saveData, stage.bossId)
    const restored = cleared ? DIALOGUE_REGISTRY.getStageSequence(stage.id as any, 'district_restored') : undefined
    const restoredText = restored
      ? resolveDialogueText(restored.lines[0].text, { districtName: stage.district, hero: IDENTITY.HERO_CALLSIGN })
      : `MISSION RECORD COMPLETE · ${stage.district}`
    this.infoText.setText(cleared ? restoredText : stage.description)
    const access = stage.id !== FINAL_STAGE_ID && !isStageAccessible(this.saveData, stage.id) ? `NEEDS: ${getStageAccessRequirementLabel(stage.id)}` : `${checkpoint} · CHECKS ${checks.collected}/${checks.total}`
    this.detailsText.setText(`REWARD: ${reward} · WEAK: ${weakness}\n${access}`)
  }

  getPanelEvidence() {
    return { selectionOutline: this.slotEntries.find(slot => slot.stageIndex === this.index)?.rect.getBounds(), preview: this.layout?.previewRect, footer: this.layout?.footerRect, description: this.infoText?.getBounds(), details: this.detailsText?.getBounds(), footerControls: this.footerControls?.getBounds(), footerStatus: this.footerStatus?.getBounds() }
  }

  getLayoutEvidence() {
    return this.slotEntries.map(slot => ({ title: slot.name.text, stageId: slot.stageIndex == null ? null : this.stages[slot.stageIndex].id, difficultyRating: slot.stageIndex == null ? null : this.stages[slot.stageIndex].difficultyRating, nameBounds: slot.name.getBounds(), tileBounds: slot.rect.getBounds(), portraitBounds: slot.portrait.getBounds(), weaknessBounds: slot.weakness.getBounds() }))
  }

  private updateDebugSelectionState(): void {
    const stage = this.stages[this.index]
    this.selectedBossId = stage?.bossId ?? null
    this.selectedCheckpointId = stage ? this.getSelectedCheckpointForStage(stage.id) : null
    this.canConfirm = Boolean(stage && isStageAccessible(this.saveData, stage.id))
    this.selectedWeaknessLabel = stage ? getBossWeaknessLabel(this.saveData, stage.bossId) : null
    this.selectedRewardLabel = stage ? getStageBossRewardLabel(this.saveData, stage.id) : null
    this.finalGateText = getFinalGateStatusLabel(this.saveData)
  }

  private applyPostReturnState(): void {
    const toastMessage = this.registry.get('ui.stageSelect.toast') as string | undefined
    const focusBossId = this.registry.get('ui.stageSelect.focusBossId') as string | null | undefined
    const requireConfirmRelease = Boolean(this.registry.get('ui.stageSelect.requireConfirmRelease'))
    const returnReason = this.registry.get('ui.stageSelect.returnReason') as string | undefined

    this.armConfirmAfterRelease = requireConfirmRelease
    this.confirmArmed = !requireConfirmRelease
    this.confirmArmAvailableAt = requireConfirmRelease ? this.time.now + 120 : 0
    this.manualSelectionRequired = returnReason === 'victory'

    if (focusBossId) {
      const focusIndex = this.stages.findIndex((entry) => entry.id === focusBossId || entry.bossId === focusBossId)
      if (focusIndex >= 0) {
        const next = this.findNextUnclearedIndex(focusIndex)
        this.setSelection(next ?? focusIndex)
      }
    }

    if (toastMessage && toastMessage.trim().length > 0) {
      this.toastHandle?.destroy(true)
      this.toastHandle = showToast(this, toastMessage.trim(), 1800)
    }

    this.registry.remove('ui.stageSelect.toast')
    this.registry.remove('ui.stageSelect.focusBossId')
    this.registry.remove('ui.stageSelect.returnReason')
    this.registry.remove('ui.stageSelect.requireConfirmRelease')
    const milestoneCount = this.registry.get('ui.stageSelect.milestoneCount') as number | null | undefined
    this.registry.remove('ui.stageSelect.milestoneCount')
    this.playMilestone(milestoneCount ?? null)
  }

  private findNextUnclearedIndex(fromIndex: number): number | null {
    if (this.stages.length === 0) {
      return null
    }
    for (let offset = 1; offset < this.stages.length; offset += 1) {
      const index = (fromIndex + offset) % this.stages.length
      const stageId = this.stages[index]?.id
      if (stageId && !isCampaignStageCleared(this.saveData, stageId) && isStageAccessible(this.saveData, stageId)) {
        return index
      }
    }
    return null
  }

  private confirmSelection(): void {
    this.logic.setIndex(this.index)
    this.logic.setCheckpointId(this.selectedCheckpointId)
    const transition = this.logic.confirm()
    if (!transition) {
      return
    }
    if (!isStageAccessible(this.saveData, transition.data.stageId)) {
      this.toastHandle?.destroy(true)
      AudioService.playSfx('ui_cancel')
      this.toastHandle = showToast(this, 'Stage locked. Clear more checks first.', 1300)
      return
    }

    AudioService.unlock()
    AudioService.playSfx('ui_confirm')
    this.startSceneTransition(transition.scene, transition.data as Record<string, unknown>)
  }

  /** Count milestones play here, once, blocking and skippable, after the qualifying clear. */
  private playMilestone(clearedCount: number | null): void {
    if (clearedCount === null) return
    const milestone = DIALOGUE_REGISTRY.getMilestone(clearedCount)
    if (!milestone || !shouldPlayStory(this.saveData.storyFlags, milestone.id, currentStoryPolicy())) return
    Save.markStorySeen(milestone.id)
    this.saveData = Save.load()
    const lines = resolvePlaybackLines(milestone.id, milestone.lines, {
      hero: IDENTITY.HERO_CALLSIGN,
      clearedCount,
      remainingCount: Math.max(0, 8 - clearedCount)
    })
    this.dialogueOverlay = new DialogueOverlayController(this)
    this.dialogueOverlay.play(lines, () => {})
  }

  private handleKeyboardConfirm(): void {
    if (!this.confirmArmed || this.scene.isActive('SystemMenu') || this.dialogueOverlay?.isActive()) {
      return
    }
    if (this.manualSelectionRequired) {
      this.manualSelectionRequired = false
      this.toastHandle?.destroy(true)
      this.toastHandle = showToast(this, 'Choose a stage, then confirm.', 900)
      AudioService.playSfx('ui_move')
      return
    }
    this.confirmSelection()
  }

  private launchCampaignStage(stageId: string): void {
    const stage = getCampaignStage(stageId)
    if (!isStageAccessible(this.saveData, stage.id)) {
      this.toastHandle?.destroy(true)
      AudioService.playSfx('ui_cancel')
      this.toastHandle = showToast(this, 'Stage locked. Find the access code first.', 1400)
      return
    }
    const checkpointId = this.getSelectedCheckpointForStage(stage.id)
    AudioService.unlock()
    AudioService.playSfx('ui_confirm')
    this.startSceneTransition('Game', {
      stageId: stage.id,
      bossId: stage.bossId,
      runtimeBossConfigId: stage.runtimeBossConfigId,
      checkpointId
    })
  }

  private launchFinalRoute(): void {
    const gate = evaluateFinalGate(this.saveData)
    if (!gate.unlocked) {
      this.toastHandle?.destroy(true)
      AudioService.playSfx('ui_cancel')
      this.toastHandle = showToast(
        this,
        `Final route locked. ${gate.rules.map((rule) => `${rule.category} ${gate.counts[rule.category]}/${rule.required}`).join(' • ')}`,
        1800
      )
      return
    }
    this.launchCampaignStage(FINAL_STAGE_ID)
  }

  private startSceneTransition(scene: string, data: Record<string, unknown>): void {
    this.requestedTransition = { scene, data }
    this.transitionRequestedAt = performance.now()
    this.scene.start(scene, data)
  }

  private getAccessibleCheckpointIdsForStage(stageId: string): string[] {
    const stage = this.stages.find((entry) => entry.id === stageId) ?? getCampaignStage(stageId)
    return getAccessibleCheckpointIds(
      this.saveData,
      stage.id,
      stage.arena.checkpoints.map((checkpoint) => checkpoint.id)
    )
  }

  private getSelectedCheckpointForStage(stageId: string): string | null {
    if (!stageId) {
      return null
    }
    const accessible = this.getAccessibleCheckpointIdsForStage(stageId)
    if (accessible.length === 0) {
      return null
    }
    const saved = getSelectedCheckpointId(this.saveData, stageId)
    const selected = saved && accessible.includes(saved) ? saved : accessible[0]
    if (selected && saved !== selected) {
      this.saveData = Save.load()
      Save.setSelectedCheckpoint(stageId, selected)
      this.saveData = Save.load()
    }
    return selected
  }

  private getStageCheckProgress(stageId: string): { collected: number; total: number } {
    const locations = getStageLocationDefinitions(stageId)
    const collected = locations.filter((location) => this.saveData.collectedChecks.includes(location.id)).length
    return {
      collected,
      total: locations.length
    }
  }

  private cycleCheckpoint(delta: number): void {
    const stage = this.stages[this.index]
    if (!stage) {
      return
    }
    const accessible = this.getAccessibleCheckpointIdsForStage(stage.id)
    if (accessible.length <= 1) {
      return
    }
    const current = this.getSelectedCheckpointForStage(stage.id)
    const currentIndex = Math.max(0, accessible.indexOf(current ?? accessible[0]))
    const nextIndex = Phaser.Math.Wrap(currentIndex + delta, 0, accessible.length)
    const nextCheckpointId = accessible[nextIndex] ?? accessible[0]
    Save.setSelectedCheckpoint(stage.id, nextCheckpointId)
    this.saveData = Save.load()
    this.logic.setCheckpointId(nextCheckpointId)
    this.updatePreview()
    this.updateDebugSelectionState()
    AudioService.unlock()
    AudioService.playSfx('ui_move')
  }
}
