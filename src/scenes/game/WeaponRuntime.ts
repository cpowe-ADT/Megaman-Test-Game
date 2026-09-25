import type Phaser from 'phaser'
import AudioService from '../../audio'
import { getWeaponConfig, getWeaponDisplayName } from '../../content/weapons'
import {
  getHolsteredWeaponRechargeTargets,
  PASSIVE_WEAPON_RECHARGE_AMOUNT,
  PASSIVE_WEAPON_RECHARGE_INTERVAL_MS,
  rechargeWeaponEnergyValue,
  SABER_WEAPON_RECHARGE_AMOUNT,
  SABER_WEAPON_RECHARGE_COOLDOWN_MS
} from '../../content/weaponEnergyEconomy'
import type { SceneInputActions } from '../../input/InputActions'
import { resolveUpgradeModifiers } from '../../progression/upgrades'
import { firePlayerShot } from '../../projectiles/firePlayerShot'
import type { ProjectileSystem } from '../../projectiles'
import type { Save } from '../../systems/Save'
import type { HUD } from '../../ui/HUD'
import { passiveRechargeTicks, wrapWeaponIndex } from './combatRules'

export interface PlayerShotRequest {
  type: 'pellet' | 'charge'
  weaponId?: 'ArcSlash'
  chargeLevel: 0 | 1 | 2 | 3 | 4
  facing: 1 | -1
}

/** The members of the Game scene that weapon cycling, energy, firing and the weapon labels use. */
export interface WeaponRuntimeHost {
  readonly time: Phaser.Time.Clock
  readonly actions: Pick<SceneInputActions, 'snapshot'>
  player?: Phaser.Physics.Arcade.Sprite
  playerBullets: Phaser.Physics.Arcade.Group
  projectileSystem?: Pick<ProjectileSystem, 'spawn'>
  progressionSave: ReturnType<typeof Save.load>
  weapons: string[]
  currentWeaponIndex: number
  weaponEnergyById: Record<string, number>
  weaponEnergy: { current: number; max: number }
  passiveWeaponRechargeAccumulatorMs: number
  lastSaberWeaponRechargeAtMs: number
  weaponLabel?: Phaser.GameObjects.Text
  hud?: Pick<HUD, 'setWeaponName' | 'setWeaponColor' | 'updateWeapon'>
  devRegister<T extends Phaser.GameObjects.GameObject>(ref: T | undefined, kind: string): T | undefined
  showStageToast(message: string, durationMs?: number): void
}

/**
 * Weapon cycling, energy recharge (passive and saber), firing and the weapon labels, moved out of
 * `Game` in prompt 07 phase 7.0 (EVAL-P7-008). The state stays on the scene (`weapons`,
 * `currentWeaponIndex`, `weaponEnergyById`) because saves, the pause menu and smoke read it there.
 */
export class WeaponRuntime {
  constructor(private readonly host: WeaponRuntimeHost) {}

  handleCycling(): void {
    const snapshot = this.host.actions.snapshot()
    if (snapshot.weaponNext.pressed) {
      this.changeWeapon(1)
    }
    if (snapshot.weaponPrev.pressed) {
      this.changeWeapon(-1)
    }
  }

  updateEnergyRecharge(deltaMs: number): void {
    const host = this.host
    const { ticks, remainderMs } = passiveRechargeTicks(host.passiveWeaponRechargeAccumulatorMs + Math.max(0, deltaMs))
    host.passiveWeaponRechargeAccumulatorMs = remainderMs
    if (ticks <= 0) {
      return
    }
    for (const weaponId of getHolsteredWeaponRechargeTargets(host.weapons, this.getCurrentWeaponId())) {
      const config = getWeaponConfig(weaponId)
      const current = host.weaponEnergyById[weaponId] ?? config.maxEnergy
      host.weaponEnergyById[weaponId] = rechargeWeaponEnergyValue(current, config.maxEnergy, PASSIVE_WEAPON_RECHARGE_AMOUNT * ticks).next
    }
  }

  rechargeSelectedFromSaber(): number {
    const host = this.host
    const weaponId = this.getCurrentWeaponId()
    if (weaponId === 'Buster' || host.time.now - host.lastSaberWeaponRechargeAtMs < SABER_WEAPON_RECHARGE_COOLDOWN_MS) {
      return 0
    }
    const config = getWeaponConfig(weaponId)
    const current = host.weaponEnergyById[weaponId] ?? config.maxEnergy
    const result = rechargeWeaponEnergyValue(current, config.maxEnergy, SABER_WEAPON_RECHARGE_AMOUNT)
    host.lastSaberWeaponRechargeAtMs = host.time.now
    if (result.restored <= 0) {
      return 0
    }
    host.weaponEnergyById[weaponId] = result.next
    this.syncHud()
    if (current === 0) {
      host.showStageToast(`${getWeaponDisplayName(weaponId).toUpperCase()} REBOOT +${result.restored}`, 550)
    }
    return result.restored
  }

  getEnergyDebugState(): Record<string, unknown> {
    return {
      selectedWeaponId: this.getCurrentWeaponId(),
      inventory: { ...this.host.weaponEnergyById },
      saberRechargeAmount: SABER_WEAPON_RECHARGE_AMOUNT,
      saberCooldownMs: SABER_WEAPON_RECHARGE_COOLDOWN_MS,
      passiveRechargeAmount: PASSIVE_WEAPON_RECHARGE_AMOUNT,
      passiveIntervalMs: PASSIVE_WEAPON_RECHARGE_INTERVAL_MS,
      passiveAccumulatorMs: Math.round(this.host.passiveWeaponRechargeAccumulatorMs)
    }
  }

  fire(config: PlayerShotRequest): Record<string, unknown> | false {
    const host = this.host
    const player = host.player
    if (!player?.active) {
      return false
    }
    const currentWeapon = this.getCurrentWeaponConfig()
    const fired = firePlayerShot({
      request: config,
      equippedWeaponId: currentWeapon.id,
      availableEnergy: host.weaponEnergyById[currentWeapon.id] ?? currentWeapon.maxEnergy,
      x: player.x + (config.facing === -1 ? -8 : 8),
      y: player.y - 6,
      activeBusterCount: host.playerBullets.countActive(true),
      modifiers: resolveUpgradeModifiers(host.progressionSave),
      spawn: (request) => host.projectileSystem?.spawn(request) ?? null
    })
    if (!fired) return false
    const { projectile: bullet, shot } = fired
    host.weaponEnergyById[currentWeapon.id] = fired.remainingEnergy
    host.devRegister(bullet, 'bullet')
    this.syncHud()
    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    return {
      source: 'player',
      projectileId: shot.projectileId,
      weaponId: shot.weapon.id,
      weaponElement: shot.weapon.element,
      chargeLevel: shot.chargeLevel,
      damage: Number(bullet.data?.get?.('damage') ?? shot.weapon.damage),
      speed: Math.round(Math.hypot(body?.velocity.x ?? 0, body?.velocity.y ?? 0)),
      scale: Number(bullet.scaleX ?? shot.weapon.scale),
      pierce: Number(bullet.data?.get?.('pierceRemaining') ?? shot.weapon.projectile.pierce),
      impactFxKey: shot.impactFxKey,
      energyCost: shot.energyCost,
      energyRemaining: host.weaponEnergyById[currentWeapon.id]
    }
  }

  changeWeapon(delta: number): void {
    this.host.currentWeaponIndex = wrapWeaponIndex(this.host.currentWeaponIndex, delta, this.host.weapons.length)
    AudioService.playSfx('ui_move')
    this.updateLabel()
  }

  updateLabel(): void {
    const weapon = this.getCurrentWeaponId()
    this.host.weaponLabel?.setText(`WEAPON • ${getWeaponDisplayName(weapon).toUpperCase()}`)
    this.host.hud?.setWeaponName(getWeaponDisplayName(weapon))
    this.host.hud?.setWeaponColor(getWeaponConfig(weapon).tint)
    this.syncHud()
  }

  getCurrentWeaponId(): string {
    return this.host.weapons[this.host.currentWeaponIndex] ?? 'Buster'
  }

  getCurrentWeaponConfig(): ReturnType<typeof getWeaponConfig> {
    return getWeaponConfig(this.getCurrentWeaponId())
  }

  syncHud(): void {
    const currentWeapon = this.getCurrentWeaponConfig()
    const current = this.host.weaponEnergyById[currentWeapon.id] ?? currentWeapon.maxEnergy
    this.host.weaponEnergy = { current, max: currentWeapon.maxEnergy }
    this.host.hud?.updateWeapon(current, currentWeapon.maxEnergy)
  }
}
