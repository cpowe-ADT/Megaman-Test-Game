import type Phaser from 'phaser'
import type { BossController } from '../../bosses/BossController'
import type { BossBodyBoxes, BossRect } from '../../bosses/bossBodies'

export interface BossBodiesHost {
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  bossController?: BossController
  bossEncounterActive: boolean
  victoryTriggered: boolean
  bossDeathHandled: boolean
}

/**
 * The boss's hurtbox and contact hitbox in the Game scene (prompt 07 phase 7.0, EVAL-P7-010). The controller's own
 * body stays the floor body; these two zones follow it every frame at the rects `BossController.getBodyBoxes`
 * resolves from the roster. HitWires overlaps player shots with `hurtbox` and the hero with `hitbox`; the saber
 * aims at `hurtbox`. The hitbox only hurts while the fight is on (not before the room activates, not in defeat).
 */
export class BossBodies {
  hurtbox?: Phaser.GameObjects.Zone
  hitbox?: Phaser.GameObjects.Zone
  /** The boxes and contact damage placed on the last sync. */
  boxes: BossBodyBoxes | null = null
  private owner?: BossController

  constructor(private readonly host: BossBodiesHost) {}

  /** The zones for the live controller, made on first use (and again for a new controller); null without one. */
  ensure(): { hurtbox: Phaser.GameObjects.Zone; hitbox: Phaser.GameObjects.Zone } | null {
    const controller = this.host.bossController
    if (!controller?.active) return null
    if (this.owner !== controller || !this.hurtbox?.active || !this.hitbox?.active) {
      this.destroy()
      this.owner = controller
      this.hurtbox = this.makeZone('hurtbox')
      this.hitbox = this.makeZone('hitbox')
    }
    this.sync()
    return this.hurtbox && this.hitbox ? { hurtbox: this.hurtbox, hitbox: this.hitbox } : null
  }

  /** Every frame: the zones follow the floor body; defeat switches both off. */
  sync(): void {
    const controller = this.owner
    if (!controller || !this.hurtbox?.active || !this.hitbox?.active) return
    const alive = controller.active && !this.host.bossDeathHandled && !this.host.victoryTriggered
    if (!alive) {
      setEnabled(this.hurtbox, false)
      setEnabled(this.hitbox, false)
      return
    }
    this.boxes = controller.getBodyBoxes()
    place(this.hurtbox, this.boxes.hurtbox, true)
    place(this.hitbox, this.boxes.hitbox, this.host.bossEncounterActive)
  }

  /** The saber's boss target: the hurtbox while it can take hits. */
  hurtTarget(): Phaser.GameObjects.Zone | null {
    const body = this.hurtbox?.body as Phaser.Physics.Arcade.Body | undefined
    return this.hurtbox?.active && body?.enable ? this.hurtbox : null
  }

  /** A new run of the scene: the zones went with the old physics world. */
  forget(): void {
    this.hurtbox = undefined
    this.hitbox = undefined
    this.owner = undefined
    this.boxes = null
  }

  private destroy(): void {
    this.hurtbox?.destroy()
    this.hitbox?.destroy()
    this.forget()
  }

  private makeZone(role: 'hurtbox' | 'hitbox'): Phaser.GameObjects.Zone {
    const zone = this.host.add.zone(0, 0, 8, 8)
    this.host.physics.add.existing(zone)
    const body = zone.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setImmovable(true)
    body.moves = false
    zone.setData('bossBodyRole', role)
    return zone
  }
}

function setEnabled(zone: Phaser.GameObjects.Zone, enabled: boolean): void {
  const body = zone.body as Phaser.Physics.Arcade.Body | undefined
  if (body) body.enable = enabled
}

function place(zone: Phaser.GameObjects.Zone, rect: BossRect, enabled: boolean): void {
  const body = zone.body as Phaser.Physics.Arcade.Body
  if (body.width !== rect.width || body.height !== rect.height) {
    zone.setSize(rect.width, rect.height)
    body.setSize(rect.width, rect.height)
  }
  body.enable = enabled
  body.reset(rect.x + rect.width / 2, rect.y + rect.height / 2)
}
