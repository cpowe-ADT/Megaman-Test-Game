import Phaser from 'phaser'
import AudioService from '../../audio'
import { getStageLocationDefinitions } from '../../progression/catalog'
import type { Difficulty, LocationCheckCategory } from '../../progression/types'
import { applyPickupArt } from '../../ui/pickups/PickupTextures'
import { DROP_ART, LOCATION_ART, rollEnemyDrop, type EnemyDropType } from '../../ui/pickups/pickupArt'
import { applyDropReward } from '../../ui/pickups/dropRewards'

// Arcade overlap callbacks receive the wider body/tile union below, not a plain GameObject (HitWires.ts's
// same asObject pattern); every pickup here is a Sprite in practice, so the cast is safe.
type Overlapping =
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Tilemaps.Tile
const asObject = (value: Overlapping): Phaser.GameObjects.GameObject => value as Phaser.GameObjects.GameObject

/**
 * The Game scene state and callbacks `PickupSystem` reads and writes (the scene itself supplies physics,
 * tweens and time). Moved out of `Game` in part 13e (`EVAL-P6-014`): spawning, bobbing/grounding and
 * collecting both kinds of pickup (a stage's placed progression items and an enemy's random drop) were
 * `Game.ts` methods around its old `spawnProgressionPickups` (line 477); the save-applying side of a
 * progression claim, and the player-stat mutators a drop's reward calls, stay host callbacks because they are
 * reused well outside pickups (dialogue rewards, sub-tank refills, the HUD).
 */
export interface PickupSystemHost {
  player: Phaser.Physics.Arcade.Sprite
  stagePlatforms?: Phaser.Physics.Arcade.StaticGroup
  progressionSave: { difficulty: Difficulty; collectedChecks: string[] }
  collectProgressionLocation(locationId: string): void
  restorePlayerHealth(amount: number): number
  restoreWeaponEnergy(amount: number): { weaponId: string | null; restored: number }
  /** Grants one extra life (capped at the existing maximum, if there is one) and returns how many were added. */
  grantExtraLife(): number
  showStageToast(message: string, durationMs?: number): void
}

export class PickupSystem {
  private drops?: Phaser.Physics.Arcade.Group
  private progressionPickups?: Phaser.Physics.Arcade.Group

  constructor(private readonly host: PickupSystemHost & Phaser.Scene) {}

  /** `game.drops` is part of the automation surface (scripts/smoke/*.mjs read it directly): kept as a property. */
  get dropsGroup(): Phaser.Physics.Arcade.Group | undefined {
    return this.drops
  }

  set dropsGroup(group: Phaser.Physics.Arcade.Group | undefined) {
    this.drops = group
  }

  /** Creates both groups and wires their overlaps/collider; call once per stage load, where the old inline setup ran. */
  install(): void {
    this.drops = this.host.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 24,
      allowGravity: true
    })
    this.progressionPickups = this.host.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 32,
      allowGravity: false,
      immovable: true
    })
    this.host.physics.add.overlap(this.host.player, this.drops, (a, b) => this.onPickupCollected(asObject(a), asObject(b)))
    if (this.host.stagePlatforms) {
      this.host.physics.add.collider(this.drops, this.host.stagePlatforms)
    }
    this.host.physics.add.overlap(this.host.player, this.progressionPickups, (a, b) =>
      this.onProgressionPickupCollected(asObject(a), asObject(b))
    )
  }

  spawnProgressionPickups(stageId: string): void {
    if (!this.progressionPickups) {
      return
    }
    const collected = new Set(this.host.progressionSave.collectedChecks)
    getStageLocationDefinitions(stageId)
      .filter((location) => location.category !== 'boss_clear' && location.x != null && location.y != null)
      .filter((location) => !collected.has(location.id))
      .forEach((location) => {
        const pickup = this.progressionPickups?.create(Number(location.x), Number(location.y)) as
          | Phaser.Physics.Arcade.Sprite
          | undefined
        if (!pickup) {
          return
        }
        pickup.setActive(true).setVisible(true).setDepth(5)
        // Part 13e: ground sits exactly where authored and never bobs; float is the only rest that animates.
        const category = location.category as Exclude<LocationCheckCategory, 'boss_clear'>
        applyPickupArt(pickup, LOCATION_ART[category], { bob: location.rest === 'float' })
        pickup.setDataEnabled()
        pickup.data?.set('locationId', location.id)
        pickup.data?.set('locationCategory', location.category)
        pickup.clearTint()
        const body = pickup.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          body.enable = true
          body.setAllowGravity(false)
          body.setImmovable(true)
        }
      })
  }

  private onProgressionPickupCollected(
    _playerObj: Phaser.GameObjects.GameObject,
    pickupObj: Phaser.GameObjects.GameObject
  ): void {
    const pickup = pickupObj as Phaser.Physics.Arcade.Sprite
    if (!pickup?.active) {
      return
    }
    const locationId = String(pickup.data?.get?.('locationId') ?? '')
    if (!locationId) {
      return
    }
    const body = pickup.body as Phaser.Physics.Arcade.Body | undefined
    body?.setVelocity(0, 0)
    if (body) {
      body.enable = false
    }
    pickup.setActive(false).setVisible(false)
    this.host.tweens.killTweensOf(pickup)
    this.host.collectProgressionLocation(locationId)
  }

  spawnEnemyDrop(x: number, y: number, forcedType?: EnemyDropType): Phaser.Physics.Arcade.Sprite | null {
    if (!this.drops) {
      return null
    }
    const dropType = forcedType ?? rollEnemyDrop(Phaser.Math.FloatBetween(0, 1), this.host.progressionSave.difficulty)
    if (!dropType) {
      return null
    }
    const drop = this.drops.get(x, y) as Phaser.Physics.Arcade.Sprite | null
    if (!drop) {
      return null
    }

    this.clearDropExpireTimer(drop)
    drop.setActive(true).setVisible(true).setDepth(5)
    drop.setPosition(x, y)
    applyPickupArt(drop, DROP_ART[dropType])
    drop.setDataEnabled()
    drop.data?.set('dropType', dropType)
    drop.clearTint()

    const body = drop.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.enable = true
      body.allowGravity = true
      body.setBounce(0.1, 0.16)
      body.setDrag(24, 0)
      body.setVelocity(Phaser.Math.Between(-30, 30), Phaser.Math.Between(-120, -72))
    }

    ;(drop as any).__expireTimer = this.host.time.delayedCall(4200, () => {
      if (!drop.active) {
        ;(drop as any).__expireTimer = undefined
        return
      }
      body?.setVelocity(0, 0)
      if (body) {
        body.enable = false
      }
      drop.setActive(false).setVisible(false)
      ;(drop as any).__expireTimer = undefined
    })

    return drop
  }

  private onPickupCollected(
    _playerObj: Phaser.GameObjects.GameObject,
    dropObj: Phaser.GameObjects.GameObject
  ): void {
    const drop = dropObj as Phaser.Physics.Arcade.Sprite
    if (!drop?.active) {
      return
    }

    this.clearDropExpireTimer(drop)
    const dropType = (drop.data?.get?.('dropType') as EnemyDropType | undefined) ?? 'bonus'
    const outcome = applyDropReward(dropType, {
      heal: (amount) => this.host.restorePlayerHealth(amount),
      restoreEnergy: (amount) => this.host.restoreWeaponEnergy(amount),
      addLife: () => this.host.grantExtraLife()
    })
    const body = drop.body as Phaser.Physics.Arcade.Body | undefined
    body?.setVelocity(0, 0)
    if (body) {
      body.enable = false
    }
    drop.setActive(false).setVisible(false)

    if (outcome.sfx) {
      AudioService.playSfx(outcome.sfx)
    }
    if (outcome.message) {
      this.host.showStageToast(outcome.message, 650)
    }
  }

  private clearDropExpireTimer(drop?: Phaser.Physics.Arcade.Sprite | null): void {
    const timer = (drop as any)?.__expireTimer as Phaser.Time.TimerEvent | undefined
    if (!timer) {
      return
    }
    timer.remove(false)
    ;(drop as any).__expireTimer = undefined
  }
}
