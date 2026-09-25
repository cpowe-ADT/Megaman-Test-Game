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
import { streamShouldFire } from '../../projectiles/weaponEffects'
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
  /** The hero's facing; FlameSerpent's held stream fires this way. */
  facing?: 1 | -1
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
  hud?: Pick<HUD, 'setWeaponName' | 'setWeaponColor' | 'updateWeapon'> & Partial<Pick<HUD, 'setWeaponIcon'>>
  devRegister<T extends Phaser.GameObjects.GameObject>(ref: T | undefined, kind: string): T | undefined
  showStageToast(message: string, durationMs?: number): void
}

/**
 * Weapon cycling, energy recharge (passive and saber), firing and the weapon labels, moved out of
 * `Game` in prompt 07 phase 7.0 (EVAL-P7-008). The state stays on the scene (`weapons`,
 * `currentWeaponIndex`, `weaponEnergyById`) because saves, the pause menu and smoke read it there.
 */
export class WeaponRuntime {
  /** FlameSerpent's held stream: frames held since the first flame, and whether this hold began with a real shot. */
  private streamHeldFrames = 0
  private streamAnchored = false

  constructor(private readonly host: WeaponRuntimeHost) {}

  /** Once per frame: weapon cycling, then the held behaviours (prompt 07 phase 7.3). */
  update(_now?: number): void {
    this.handleCycling()
    this.updateStream()
  }

  /**
   * FlameSerpent (`hold_stream`): the first flame is the player's own shot; while shoot stays held, more follow on
   * the frame cadence in `WEAPON_TUNING.flameStream` at the sustain cost. Releasing, switching or running dry ends it.
   */
  private updateStream(): void {
    const weapon = this.getCurrentWeaponConfig()
    const held = weapon.behavior === 'hold_stream' && Boolean(this.host.actions.snapshot().shoot?.held)
    if (!held || !this.streamAnchored) {
      if (!held) this.streamAnchored = false
      return
    }
    this.streamHeldFrames += 1
    if (!streamShouldFire({ held, anchored: true, heldFrames: this.streamHeldFrames })) return
    const fired = this.fire({ type: 'pellet', chargeLevel: 0, facing: this.host.facing ?? 1 }, { sustain: true })
    if (!fired) this.streamAnchored = false
  }

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

  fire(config: PlayerShotRequest, options: { sustain?: boolean } = {}): Record<string, unknown> | false {
    const host = this.host
    const player = host.player
    if (!player?.active) {
      return false
    }
    const currentWeapon = this.getCurrentWeaponConfig()
    const snapshot = currentWeapon.behavior === 'aim' ? host.actions.snapshot() : undefined
    const aim: -1 | 0 | 1 = snapshot?.aimUp?.held ? -1 : snapshot?.aimDown?.held ? 1 : 0
    const fired = firePlayerShot({
      request: config,
      equippedWeaponId: currentWeapon.id,
      availableEnergy: host.weaponEnergyById[currentWeapon.id] ?? currentWeapon.maxEnergy,
      x: player.x + (config.facing === -1 ? -8 : 8),
      y: player.y - 6,
      // The three-on-screen rule counts Buster shots only (weapon shots and their puddles do not).
      activeBusterCount: countActiveBusterShots(host.playerBullets),
      modifiers: resolveUpgradeModifiers(host.progressionSave),
      aim,
      sustain: options.sustain,
      spawn: (request) => host.projectileSystem?.spawn(request) ?? null
    })
    if (!fired) return false
    const { projectile: bullet, shot } = fired
    host.weaponEnergyById[currentWeapon.id] = fired.remainingEnergy
    fired.projectiles.forEach((projectile) => host.devRegister(projectile, 'bullet'))
    if (shot.behavior === 'hold_stream' && !config.weaponId && !options.sustain) {
      this.streamHeldFrames = 0
      this.streamAnchored = true
    }
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
      energyRemaining: host.weaponEnergyById[currentWeapon.id],
      // Weapon identity (prompt 07 phase 7.3; smoke 12 reads these).
      behavior: shot.behavior,
      onHitTag: shot.onHitTag,
      projectileCount: fired.projectiles.length,
      sustain: Boolean(options.sustain),
      ...(shot.behavior === 'aim' ? { aim } : {}),
      ...(bullet.data?.get?.('chainJumps') != null ? { chainJumps: Number(bullet.data.get('chainJumps')) } : {}),
      textureKey: bullet.texture?.key ?? null,
      frame: String(bullet.frame?.name ?? ''),
      flipX: Boolean(bullet.flipX),
      angle: Math.round(Number(bullet.angle ?? 0)),
      velocityY: Math.round(body?.velocity.y ?? 0),
      bodyWidth: Math.round(body?.width ?? 0),
      bodyHeight: Math.round(body?.height ?? 0),
      displayWidth: Math.round(bullet.displayWidth ?? 0)
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
    this.host.hud?.setWeaponIcon?.(weapon)
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

function countActiveBusterShots(group: Phaser.Physics.Arcade.Group): number {
  let count = 0
  group.children?.iterate((child) => {
    const shot = child as Phaser.Physics.Arcade.Sprite | null
    if (shot?.active && shot.data?.get?.('weaponId') === 'Buster') count += 1
    return true
  })
  return count
}
