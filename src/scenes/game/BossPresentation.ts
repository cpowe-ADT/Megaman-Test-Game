import type Phaser from 'phaser'
import AudioService from '../../audio'
import {
  BOSS_DEATH_TIMING,
  BOSS_INTRO_TIMING,
  bossDeathTimeline,
  burstOffset,
  resolveDesperationArena,
  warningVisibleAt,
  type DesperationArenaChange
} from '../../boss/fightBeats'
import type { BossController } from '../../bosses/BossController'
import { getBossCombatProfile } from '../../bosses/bossCombatProfiles'
import type { BossId } from '../../bosses/types'
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import { GAMEPLAY_TEXTURE_KEYS } from '../../ui/gameplay/GameplayTextures'
import type { HUD } from '../../ui/HUD'
import { MENU_FONT_DISPLAY } from '../../ui/menu/menuTheme'
import type { CameraDirector } from './CameraDirector'

/** Over the HUD (1000), under the dialogue overlay. */
const BAND_DEPTH = 1200
const BAND_HEIGHT = 34
const BURST_DEPTH = 8

export type BossPresentationBeat =
  | 'idle'
  | 'warning'
  | 'card'
  | 'dialogue'
  | 'bar_fill'
  | 'fight'
  | 'death_hitstop'
  | 'death_explosion'
  | 'death_freeze'
  | 'defeat_dialogue'

export interface BossPresentationHost {
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly time: Phaser.Time.Clock
  readonly tweens: Phaser.Tweens.TweenManager
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager
  readonly events: Phaser.Events.EventEmitter
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  hazards?: Phaser.Physics.Arcade.StaticGroup
  bossController?: BossController
  bossTarget?: Phaser.Physics.Arcade.Sprite
  bossBody?: Phaser.Physics.Arcade.Sprite
  activeBossRoom?: { x: number; width: number }
  hud?: Pick<HUD, 'setBossBarFill'>
  bossEncounterActive: boolean
  victoryTriggered: boolean
  hitstopRemainingFrames: number
  readonly cameraDirector: Pick<CameraDirector, 'onHitstop'>
  freezeCombatWorld(): void
}

/**
 * Draws the fight's shared beats (prompt 07 phase 7.2 items 2, 4 and 5; prompt 12 part 12f wave 2): the WARNING
 * band and the name-and-element card, the bar fill with its ticks, the desperation arena pulses and the death
 * chain. Every number comes from `src/boss/fightBeats.ts`; `getDebugState` is what smoke 44 reads.
 */
export class BossPresentation {
  beat: BossPresentationBeat = 'idle'
  readonly beats: Array<{ beat: BossPresentationBeat; atMs: number }> = []
  readonly card = { title: '', subtitle: '' }
  readonly bar = { tick: 0, ticks: BOSS_INTRO_TIMING.barFillTicks as number, fraction: 0, sfxTicks: 0 }
  readonly death = { startedAtMs: null as number | null, bursts: 0, flashes: 0, bossGoneAtMs: null as number | null }
  readonly desperation = { startedAtMs: null as number | null, arena: null as DesperationArenaChange | null, pulses: 0 }
  private band?: Phaser.GameObjects.Graphics
  private texts: Phaser.GameObjects.Text[] = []
  private timers: Phaser.Time.TimerEvent[] = []
  private holdingFreeze = false
  /** The death sequence's callbacks until the defeat dialogue starts (so a debug skip can fast-forward it). */
  private deathPending: { onVanish: () => void; onDialogue: () => void; vanished: boolean } | null = null

  constructor(private readonly host: BossPresentationHost) {}

  /** WARNING blinks on a band, then the same band carries the name-and-element card; `onDone` starts the intro dialogue. */
  playIntro(card: { name: string; element: string; color: number }, onDone: () => void): void {
    const host = this.host
    this.resetFight()
    host.bossController?.beginIntroPresentation()
    this.mark('warning')
    AudioService.playSfx('boss_warning')
    const y = Math.round(GAME_HEIGHT * 0.4)
    this.band = host.add.graphics().setScrollFactor(0).setDepth(BAND_DEPTH)
    this.drawBand(0x3c0008, 0xff2e44, y)
    const title = this.text(GAME_WIDTH / 2, y + BAND_HEIGHT / 2, 'WARNING', 18, '#ff4d5e')
    this.card.title = 'WARNING'
    this.card.subtitle = ''
    const startedAt = host.time.now
    const blink = host.time.addEvent({
      delay: BOSS_INTRO_TIMING.warningBlinkMs,
      loop: true,
      callback: () => title.setVisible(warningVisibleAt(host.time.now - startedAt))
    })
    this.timers.push(blink)
    this.after(BOSS_INTRO_TIMING.warningMs, () => {
      blink.remove(false)
      this.mark('card')
      this.drawBand(0x08131f, card.color, y)
      title.setVisible(true).setText(card.name).setColor('#ffffff').setFontSize(16).setY(y + 12)
      this.text(GAME_WIDTH / 2, y + 27, card.element, 9, `#${card.color.toString(16).padStart(6, '0')}`)
      this.card.title = card.name
      this.card.subtitle = card.element
    })
    this.after(BOSS_INTRO_TIMING.warningMs + BOSS_INTRO_TIMING.cardMs, () => {
      this.clearOverlay()
      if (!host.bossEncounterActive || host.victoryTriggered) return
      this.mark('dialogue')
      onDone()
    })
  }

  /** After the intro dialogue the bar fills 0 to max, one tick and one tick sound at a time; then `onDone` starts the fight. */
  fillBar(onShow: () => void, onDone: () => void): void {
    const host = this.host
    const ticks = BOSS_INTRO_TIMING.barFillTicks
    this.mark('bar_fill')
    Object.assign(this.bar, { tick: 0, fraction: 0, sfxTicks: 0 })
    host.hud?.setBossBarFill(0)
    onShow()
    this.timers.push(
      host.time.addEvent({
        delay: BOSS_INTRO_TIMING.barFillMs / ticks,
        repeat: ticks - 1,
        callback: () => {
          this.bar.tick += 1
          this.bar.fraction = this.bar.tick / ticks
          host.hud?.setBossBarFill(this.bar.fraction)
          AudioService.playSfx('ui_move')
          this.bar.sfxTicks += 1
          if (this.bar.tick < ticks) return
          host.hud?.setBossBarFill(null)
          if (!host.bossEncounterActive || host.victoryTriggered) return
          this.mark('fight')
          onDone()
        }
      })
    )
  }

  /** Desperation (prompt 07 phase 7.2 item 2): an alarm, and the room's arena hazards pulse until the fight ends. */
  beginDesperation(): void {
    const host = this.host
    const controller = host.bossController
    if (!controller || this.desperation.startedAtMs !== null) return
    const arena = resolveDesperationArena(getBossCombatProfile(controller.blueprint.id as BossId).room)
    this.desperation.startedAtMs = host.time.now
    this.desperation.arena = arena
    AudioService.playSfx('boss_activate')
    if (arena.hazardFractions.length === 0) return
    const pulse = () => {
      if (host.bossEncounterActive && !host.victoryTriggered && host.bossController) this.pulseArena(arena, host.bossController)
    }
    pulse()
    this.timers.push(host.time.addEvent({ delay: arena.pulseEveryMs, loop: true, callback: pulse }))
  }

  /**
   * The killing blow (prompt 07 phase 7.2 item 5): 20 frames of hit-stop and a white flash while the defeat frames
   * start, a 1.2 s chained explosion, a second flash as the boss goes (`onVanish`), a 900 ms freeze, then
   * `onDialogue` plays the defeat dialogue.
   */
  playDeath(onVanish: () => void, onDialogue: () => void): void {
    const host = this.host
    this.clear()
    const actor = host.bossController ?? host.bossTarget ?? host.bossBody
    const origin = { x: Number(actor?.x ?? GAME_WIDTH / 2), y: Number(actor?.y ?? GAME_HEIGHT / 2) }
    host.bossController?.beginDefeat()
    const pending = { onVanish, onDialogue, vanished: false }
    this.deathPending = pending
    const timeline = bossDeathTimeline()
    this.death.startedAtMs = host.time.now
    this.death.bursts = 0
    this.death.flashes = 0
    this.death.bossGoneAtMs = null
    this.mark('death_hitstop')
    host.cameraDirector.onHitstop(BOSS_DEATH_TIMING.hitstopFrames)
    this.flash()
    this.holdFreeze(true)
    timeline.burstAtMs.forEach((atMs, index) =>
      this.after(atMs, () => {
        if (index === 0) this.mark('death_explosion')
        this.burst(origin, index)
      })
    )
    this.after(timeline.explosionEndMs, () => {
      this.flash()
      this.death.bossGoneAtMs = host.time.now
      this.mark('death_freeze')
      pending.vanished = true
      onVanish()
    })
    this.after(timeline.dialogueAtMs, () => {
      this.deathPending = null
      this.holdFreeze(false)
      this.mark('defeat_dialogue')
      onDialogue()
    })
  }

  /**
   * Fast-forward for automation skips (`stageDebug.skipDialogue`, `bossDebug.forceVictory`): what is left of the
   * death sequence runs now, so the defeat dialogue opens and a same-tick skip reaches the victory modal. The world
   * stays frozen. No-op outside a death sequence.
   */
  finishDeathNow(): void {
    const pending = this.deathPending
    if (!pending) return
    this.deathPending = null
    this.timers.forEach((timer) => timer.remove(false))
    this.timers = []
    this.death.bursts = BOSS_DEATH_TIMING.bursts
    if (!pending.vanished) {
      this.death.bossGoneAtMs = this.host.time.now
      this.mark('death_freeze')
      pending.onVanish()
    }
    this.mark('defeat_dialogue')
    pending.onDialogue()
  }

  /**
   * Automation (`bossDebug.unlockIntro`): cancel a pending intro beat (WARNING, card, bar fill) so the intro dialogue
   * cannot open once the fight is running, and show the bar full. No-op outside the intro.
   */
  skipIntro(): void {
    if (this.beat !== 'warning' && this.beat !== 'card' && this.beat !== 'dialogue' && this.beat !== 'bar_fill') return
    this.clear()
    this.host.hud?.setBossBarFill(null)
    this.mark('fight')
  }

  /** A new fight (the scene is reused on restart): cancel every beat and forget the last fight's records. */
  resetFight(): void {
    this.clear()
    this.deathPending = null
    this.beat = 'idle'
    this.beats.length = 0
    Object.assign(this.card, { title: '', subtitle: '' })
    Object.assign(this.bar, { tick: 0, fraction: 0, sfxTicks: 0 })
    Object.assign(this.death, { startedAtMs: null, bursts: 0, flashes: 0, bossGoneAtMs: null })
    Object.assign(this.desperation, { startedAtMs: null, arena: null, pulses: 0 })
  }

  /** Cancels every pending beat and removes the band (a new intro, the death). */
  clear(): void {
    this.timers.forEach((timer) => timer.remove(false))
    this.timers = []
    this.clearOverlay()
    this.holdFreeze(false)
  }

  getDebugState(): Record<string, unknown> {
    return {
      beat: this.beat,
      beats: this.beats.slice(-12),
      card: { ...this.card },
      bandVisible: Boolean(this.band?.active && this.band.visible),
      bar: { ...this.bar },
      death: { ...this.death },
      desperation: { ...this.desperation }
    }
  }

  private pulseArena(arena: DesperationArenaChange, controller: BossController): void {
    const host = this.host
    const room = host.activeBossRoom
    if (!host.hazards || !room) return
    this.desperation.pulses += 1
    const texture = arena.kind === 'vents_all_on' ? GAMEPLAY_TEXTURE_KEYS.flameVent : GAMEPLAY_TEXTURE_KEYS.spikeBank
    const floorY = controller.getGroundY() + 16
    const minX = room.x + 24
    const span = Math.max(0, room.width - 48)
    arena.hazardFractions.forEach((fraction) => {
      const hazard = host.hazards!.create(minX + span * fraction, floorY + (arena.kind === 'pillars_rising' ? 10 : 0), texture) as Phaser.Physics.Arcade.Sprite
      hazard.setDataEnabled?.()
      hazard.data?.set?.('damageSourceType', 'boss_projectile')
      hazard.data?.set?.('damageSourceId', `desperation_${arena.kind}`)
      hazard.data?.set?.('damageAmount', 2)
      // Not `bossRoomHazard`: arena pulses must not use up the attacks' hazard cap.
      hazard.data?.set?.('bossArenaHazard', true)
      hazard.refreshBody()
      const body = hazard.body as Phaser.Physics.Arcade.StaticBody | undefined
      if (body) body.enable = false
      hazard.setAlpha(0.28).setTint(controller.blueprint.theme.glow)
      this.after(arena.warnMs, () => {
        if (!hazard.active) return
        hazard.clearTint().setAlpha(0.92)
        hazard.y = floorY
        hazard.refreshBody()
        if (body) body.enable = true
      })
      this.after(arena.warnMs + arena.onMs, () => hazard.destroy())
    })
  }

  private burst(origin: { x: number; y: number }, index: number): void {
    const host = this.host
    const offset = burstOffset(index)
    const ring = host.add.circle(origin.x + offset.x, origin.y + offset.y, 5, index % 2 === 0 ? 0xffffff : 0xffd26a, 1)
    ring.setDepth(BURST_DEPTH).setScale(offset.scale)
    host.tweens.add({ targets: ring, scale: offset.scale * 3.2, alpha: 0, duration: 280, onComplete: () => ring.destroy() })
    AudioService.playSfx('enemy_hit')
    this.death.bursts += 1
  }

  private flash(): void {
    this.host.cameras.main.flash(BOSS_DEATH_TIMING.flashMs, 255, 255, 255)
    this.death.flashes += 1
  }

  /** The hit-stop resumes physics when it ends; while the death plays, the world stays frozen from the next frame on. */
  private holdFreeze(on: boolean): void {
    if (on === this.holdingFreeze) return
    this.holdingFreeze = on
    if (on) this.host.events.on('update', this.refreeze)
    else this.host.events.off('update', this.refreeze)
  }

  private readonly refreeze = (): void => {
    const host = this.host
    if (host.hitstopRemainingFrames <= 0 && !host.physics.world.isPaused) host.freezeCombatWorld()
  }

  private mark(beat: BossPresentationBeat): void {
    this.beat = beat
    this.beats.push({ beat, atMs: Math.round(this.host.time.now) })
    if (this.beats.length > 24) this.beats.shift()
  }

  private after(delayMs: number, callback: () => void): void {
    this.timers.push(this.host.time.delayedCall(delayMs, callback))
  }

  private drawBand(fill: number, edge: number, y: number): void {
    const band = this.band
    if (!band) return
    band.clear()
    band.fillStyle(fill, 0.86).fillRect(0, y, GAME_WIDTH, BAND_HEIGHT)
    band.fillStyle(edge, 1).fillRect(0, y, GAME_WIDTH, 2).fillRect(0, y + BAND_HEIGHT - 2, GAME_WIDTH, 2)
  }

  private text(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    const text = this.host.add
      .text(x, y, value, { fontFamily: MENU_FONT_DISPLAY, fontSize: `${size}px`, color, stroke: '#05070c', strokeThickness: 3 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(BAND_DEPTH + 1)
    this.texts.push(text)
    return text
  }

  private clearOverlay(): void {
    this.band?.destroy()
    this.band = undefined
    this.texts.forEach((text) => text.destroy())
    this.texts = []
  }
}
