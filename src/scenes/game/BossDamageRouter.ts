import type Phaser from 'phaser'
import AudioService from '../../audio'
import type { BossController } from '../../bosses/BossController'
import { getCampaignStage } from '../../content/campaign'
import { getWeaponDisplayName } from '../../content/weapons'
import {
  getBossWeaknessProfile,
  getBusterDamageBonus,
  getWeaknessStrictness,
  getWeaponDamageBonus,
  resolveBossDamageMultiplier
} from '../../progression'
import { resolveUpgradeModifiers } from '../../progression/upgrades'
import type { Save } from '../../systems/Save'
import { formatDistrictLabel, type HUD } from '../../ui/HUD'
import type { CameraDirector } from './CameraDirector'
import { bossHitFeedbackLabel, bossHitReaction, scaleBossHitDamage, type BossHitReaction, type CombatHitSource, type CombatHitTarget } from './combatRules'
import type { StoryDirector } from './StoryDirector'

export interface BossHitContext {
  weaponId?: string
  weaponElement?: string
  projectileId?: string
  chargeLevel?: 0 | 1 | 2 | 3 | 4
  kind?: string
}

/** The members of the Game scene that boss damage and its hit feedback read and write. */
export interface BossDamageRouterHost {
  readonly time: Phaser.Time.Clock
  readonly tweens?: Phaser.Tweens.TweenManager
  readonly events: Phaser.Events.EventEmitter
  progressionSave: ReturnType<typeof Save.load>
  activeBossId?: string
  activeStageId: string
  bossController?: BossController
  bossTarget?: Phaser.Physics.Arcade.Sprite
  bossBody?: Phaser.Physics.Arcade.Sprite
  bossArt?: Phaser.GameObjects.Sprite
  bossHp?: { current: number; max: number }
  hud?: Pick<HUD, 'updateBossHp'>
  phaseLabel?: Phaser.GameObjects.Text
  bossDeathHandled: boolean
  victoryTriggered: boolean
  bossEncounterActive: boolean
  currentPhaseName: string
  bossHitFeedbackTimer?: Phaser.Time.TimerEvent
  storyDirector?: Pick<StoryDirector, 'onWeaknessHit'>
  readonly cameraDirector: Pick<CameraDirector, 'onBossHit'>
  getCurrentWeaponConfig(): { id: string }
  recordCombatHit(source: CombatHitSource, target: CombatHitTarget, amount: number, kind: string, accepted: boolean, note?: string): void
  updatePhaseHud(action?: string): void
  onBossDefeated(): void
}

/**
 * Player damage into the boss (weakness rules, progression bonuses, i-frames through the controller)
 * and its hit feedback, moved out of `Game` in prompt 07 phase 7.0 (EVAL-P7-008). `Game.applyDamageToBoss`
 * stays as a one-line delegation for the debug hooks and the classic-campaign smoke.
 */
export class BossDamageRouter {
  /** The last player hit on the boss and how it reacted (prompt 07 phase 7.2 item 3; smoke 44 reads the weakness stagger). */
  lastReaction: (BossHitReaction & { atMs: number; multiplier: number; accepted: boolean; interruptedAttackId: string | null }) | null = null

  constructor(private readonly host: BossDamageRouterHost) {}

  applyDamageToBoss(dmg: number, hitContext: BossHitContext = {}): void {
    const host = this.host
    const weaponId = hitContext.weaponId ?? host.getCurrentWeaponConfig().id
    const hitKind = hitContext.kind ?? 'direct'
    const save = host.progressionSave
    const multiplier = resolveBossDamageMultiplier({
      strictness: getWeaknessStrictness(save),
      profile: getBossWeaknessProfile(save, host.activeBossId ?? 'pyro_maw'),
      weaponId,
      chargeLevel: weaponId === 'Buster' ? hitContext.chargeLevel ?? 0 : 0,
      hasArmsUpgrade: resolveUpgradeModifiers(save).hasArmsUpgrade
    })
    if (multiplier <= 0) {
      host.recordCombatHit('player', 'boss', dmg, hitKind, false, 'blocked-by-weakness-rules')
      this.showHitFeedback(weaponId, multiplier, 'BLOCKED')
      return
    }
    const damageBonus =
      save.progressionWorld?.progressionMode === 'classic' ? 0 : weaponId === 'Buster' ? getBusterDamageBonus(save) : getWeaponDamageBonus(save)
    const scaledDamage = scaleBossHitDamage(dmg, damageBonus, multiplier)
    const controller = host.bossController
    if (controller) {
      const reaction = bossHitReaction(multiplier)
      const hit = controller.applyDamage({
        amount: scaledDamage,
        type: 'normal',
        source: 'player',
        hitstopFrames: 2,
        iFrameMs: reaction.iFrameMs,
        stunMs: reaction.stunMs,
        stunLockoutMs: reaction.stunLockoutMs,
        interruptWindup: reaction.interruptWindup
      })
      this.lastReaction = { ...reaction, atMs: host.time.now, multiplier, accepted: hit.accepted, interruptedAttackId: hit.interruptedAttackId ?? null }
      const hp = controller.hp
      host.bossHp = { current: hp.current, max: hp.max }
      if (host.bossTarget) {
        host.bossTarget.setDataEnabled?.()
        host.bossTarget.data?.set?.('hp', hp.current)
        host.bossTarget.data?.set?.('maxHp', hp.max)
      }
      if (hit.immune) {
        host.recordCombatHit('player', 'boss', scaledDamage, hitKind, false, hit.reason ?? 'immune')
        this.showHitFeedback(weaponId, multiplier, 'IMMUNE')
        host.tweens?.add({ targets: host.bossTarget ?? host.bossArt, alpha: 0.6, yoyo: true, duration: 45, repeat: 1 })
        return
      }
      host.recordCombatHit('player', 'boss', hit.amountApplied, hitKind, true)
      host.hud?.updateBossHp(hp.current, hp.max)
      if (host.bossDeathHandled || host.victoryTriggered) {
        return
      }
      host.tweens?.add({ targets: host.bossTarget ?? host.bossArt, alpha: 0.25, yoyo: true, duration: reaction.flashMs })
      if (reaction.whiteFlashMs > 0) controller.flashWhite(reaction.whiteFlashMs)
      AudioService.playSfx(reaction.sfx)
      host.cameraDirector.onBossHit(multiplier, hit.amountApplied)
      this.showHitFeedback(weaponId, multiplier)
      if (hit.defeated || hp.current <= 0) {
        host.onBossDefeated()
      }
      return
    }

    const target = host.bossTarget ?? host.bossBody
    if (!target || !target.active) {
      host.recordCombatHit('player', 'boss', dmg, hitKind, false, 'missing target')
      return
    }
    target.setDataEnabled?.()
    const current = (target.data?.get?.('hp') ?? target.data?.get?.('maxHp') ?? 0) as number
    const max = (target.data?.get?.('maxHp') ?? Math.max(1, current)) as number
    const next = Math.max(0, current - scaledDamage)
    host.recordCombatHit('player', 'boss', scaledDamage, hitKind, true, next <= 0 ? 'defeat' : 'hit')
    target.data?.set?.('hp', next)
    target.data?.set?.('maxHp', max)
    host.bossHp = { current: next, max }
    host.hud?.updateBossHp(next, max)
    AudioService.playSfx('boss_hit')
    host.cameraDirector.onBossHit(multiplier, scaledDamage)
    this.showHitFeedback(weaponId, multiplier)
    if (next <= 0) {
      if (typeof target.disableBody === 'function') {
        target.disableBody(true, true)
      } else {
        target.setActive(false).setVisible(false)
        const body = target.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          body.enable = false
        }
      }
      host.events.emit('boss-defeated', { reward: { displayName: 'FROST SLASH' } })
      host.onBossDefeated()
    }
  }

  showHitFeedback(weaponId: string, multiplier: number, forcedLabel?: string): void {
    const host = this.host
    if (!host.phaseLabel || host.victoryTriggered) {
      return
    }
    if (multiplier >= 1.4) host.storyDirector?.onWeaknessHit()
    const label = bossHitFeedbackLabel(multiplier, forcedLabel)
    if (!label) {
      return
    }
    host.bossHitFeedbackTimer?.remove(false)
    host.updatePhaseHud(`${label.slice(0, 7)} ${getWeaponDisplayName(weaponId)}`)
    host.bossHitFeedbackTimer = host.time.delayedCall(520, () => {
      if (host.victoryTriggered) {
        return
      }
      if (host.bossEncounterActive && host.currentPhaseName) {
        host.updatePhaseHud()
      } else {
        host.phaseLabel?.setText(formatDistrictLabel(getCampaignStage(host.activeStageId).district))
      }
    })
  }
}
