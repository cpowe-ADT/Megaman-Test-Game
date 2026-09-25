import type Phaser from 'phaser'
import AudioService from '../../audio'
import type { BossController } from '../../bosses/BossController'
import { BOSS_ROSTER } from '../../bosses/roster'
import { bossPhaseIndex, ELEMENT_DAMAGE_TYPE, resolveBossElementHit, type BossBlueprint, type BossElementHit, type BossId } from '../../bosses/types'
import { getCampaignStage } from '../../content/campaign'
import { getWeaponConfig } from '../../content/weapons'
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
import { blinkBossHit, type BlinkTarget, type BlinkTweens } from '../../boss/hitFlash'
import { bossDamageScale, bossHitFeedbackLabel, bossHitReaction, scaleBossHitDamage, type BossHitReaction, type CombatHitSource, type CombatHitTarget } from './combatRules'
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
  /** The weakness table's verdict on the last player hit (prompt 07 phase 7.3; smoke 12 and 44 read it). */
  lastElementHit: (BossElementHit & { weaponId: string; classic: boolean; label: string; damageType: string }) | null = null

  constructor(private readonly host: BossDamageRouterHost) {}

  applyDamageToBoss(dmg: number, hitContext: BossHitContext = {}): void {
    const host = this.host
    const weaponId = hitContext.weaponId ?? host.getCurrentWeaponConfig().id
    const hitKind = hitContext.kind ?? 'direct'
    const save = host.progressionSave
    // Classic reads the authored ring and the boss's profile (prompt 07 phase 7.3): weakness 2.5, neutral 1,
    // resist 0.75, and no BLOCKED. The Randomizer keeps its seeded weakness profiles and strictness.
    const classic = save.progressionWorld?.progressionMode === 'classic'
    const weapon = getWeaponConfig(weaponId)
    const blueprint = BOSS_ROSTER[(host.activeBossId ?? '') as BossId] as BossBlueprint | undefined
    const elementHit = blueprint
      ? resolveBossElementHit({ bossElement: blueprint.element, weaponId: weapon.id, weaponElement: weapon.element, profile: blueprint.damageProfile, phaseIndex: bossPhaseIndex(blueprint, host.currentPhaseName) })
      : null
    const multiplier =
      classic && elementHit
        ? elementHit.multiplier
        : resolveBossDamageMultiplier({
            strictness: getWeaknessStrictness(save),
            profile: getBossWeaknessProfile(save, host.activeBossId ?? 'pyro_maw'),
            weaponId,
            chargeLevel: weaponId === 'Buster' ? hitContext.chargeLevel ?? 0 : 0,
            hasArmsUpgrade: resolveUpgradeModifiers(save).hasArmsUpgrade
          })
    const damageType = ELEMENT_DAMAGE_TYPE[weapon.element] ?? 'normal'
    const profileRejected = classic && elementHit?.outcome === 'immune'
    this.lastElementHit = {
      ...(elementHit ?? { outcome: multiplier <= 0 ? 'immune' : 'neutral', weakTo: null }),
      multiplier,
      weaponId: weapon.id,
      classic,
      damageType,
      label: bossHitFeedbackLabel(multiplier, multiplier <= 0 ? (profileRejected ? 'BUSTER ONLY' : 'BLOCKED') : undefined)
    }
    if (multiplier <= 0) {
      host.recordCombatHit('player', 'boss', dmg, hitKind, false, profileRejected ? 'buster-only-profile' : 'blocked-by-weakness-rules')
      this.showHitFeedback(weaponId, multiplier, profileRejected ? 'BUSTER ONLY' : 'BLOCKED')
      return
    }
    const damageBonus =
      save.progressionWorld?.progressionMode === 'classic' ? 0 : weaponId === 'Buster' ? getBusterDamageBonus(save) : getWeaponDamageBonus(save)
    const scaledDamage = scaleBossHitDamage(dmg * bossDamageScale(weaponId, hitContext.chargeLevel ?? 0), damageBonus, multiplier)
    const controller = host.bossController
    if (controller) {
      const reaction = bossHitReaction(multiplier)
      const hit = controller.applyDamage({
        amount: scaledDamage,
        // The element reaches the framework, so a bossConfig's authored `resistances` and `defense` apply to it.
        type: damageType,
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
        blinkBossHit(host.tweens as unknown as BlinkTweens | undefined, (host.bossTarget ?? host.bossArt) as unknown as BlinkTarget | undefined, 0.6, 45, 1)
        return
      }
      host.recordCombatHit('player', 'boss', hit.amountApplied, hitKind, true)
      host.hud?.updateBossHp(hp.current, hp.max)
      if (host.bossDeathHandled || host.victoryTriggered) {
        return
      }
      blinkBossHit(host.tweens as unknown as BlinkTweens | undefined, (host.bossTarget ?? host.bossArt) as unknown as BlinkTarget | undefined, 0.25, reaction.flashMs)
      if (reaction.whiteFlashMs > 0) controller.flashWhite(reaction.whiteFlashMs)
      AudioService.playSfx(reaction.sfx)
      host.cameraDirector.onBossHit(multiplier, hit.amountApplied)
      this.showHitFeedback(weaponId, multiplier)
      if (hit.defeated || hp.current <= 0) {
        host.onBossDefeated()
      }
      return
    }

    // Every boss is a BossController; Game never builds a bare body, so there is nothing else to hit.
    host.recordCombatHit('player', 'boss', dmg, hitKind, false, 'missing target')
  }

  /** The last hit label the phase panel showed. */
  lastFeedback: { label: string; weaponId: string } | null = null

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
    // The whole label (twelve characters at most): `WEAKNESS HIT`, `RESISTED HIT`, `BUSTER ONLY`, `IMMUNE`.
    host.updatePhaseHud(label)
    this.lastFeedback = { label, weaponId }
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
