import Phaser from 'phaser'
import { AttackPattern, BossBlueprint, BossStateKey } from './types'

export interface BossControllerConfig {
  spawn: Phaser.Math.Vector2
  lockIntro?: boolean
}

interface BossStateContext {
  key: BossStateKey
  timerMs: number
  attackFired: boolean
}

/**
 * BossController wires a BossBlueprint into runtime behaviour.
 * It does not implement every pattern but provides the scaffolding:
 *  - sprite/animation management
 *  - intro lock until cinematic concludes
 *  - phase tracking and HP thresholds
 *  - attack queue selection with cooldowns
 */
export class BossController extends Phaser.GameObjects.Container {
  readonly blueprint: BossBlueprint
  private sprite: Phaser.GameObjects.Sprite
  private fsm: BossStateContext
  private hp: number
  private introLocked: boolean
  private currentPhaseIndex = 0
  private attackCooldowns = new Map<string, number>()
  private activeAttack?: AttackPattern
  private usingPlaceholder = false
  private nextAttackAvailableMs = 0
  declare body: Phaser.Physics.Arcade.Body

  constructor(scene: Phaser.Scene, blueprint: BossBlueprint, config: BossControllerConfig) {
    super(scene, config.spawn.x, config.spawn.y)
    this.blueprint = blueprint
    this.hp = blueprint.baseStats.maxHp
    this.introLocked = !!config.lockIntro

    const primaryAnim = blueprint.spritePlan.animations[0]
    const hasAtlas = scene.textures.exists(primaryAnim.atlas)
    const textureKey = hasAtlas ? primaryAnim.atlas : 'pixel'
    this.usingPlaceholder = !hasAtlas

    this.sprite = scene.add.sprite(0, 0, textureKey)
    this.sprite.setOrigin(blueprint.spritePlan.origin.x, blueprint.spritePlan.origin.y)
    if (this.usingPlaceholder) {
      this.sprite.setDisplaySize(blueprint.spritePlan.frame.x, blueprint.spritePlan.frame.y)
      this.sprite.setTint(blueprint.theme.primary)
    }
    this.add(this.sprite)
    scene.add.existing(this)

    scene.physics.add.existing(this)
    this.setSize(this.width || 32, this.height || 32)
    const body = this.body
    body.setAllowGravity(true)
    body.setSize(blueprint.spritePlan.frame.x, blueprint.spritePlan.frame.y)
    body.setOffset(
      -blueprint.spritePlan.frame.x * this.sprite.originX,
      -blueprint.spritePlan.frame.y * (1 - this.sprite.originY)
    )
    body.setCollideWorldBounds(true)

    this.fsm = { key: 'intro', timerMs: 0, attackFired: false }
  }

  get currentPhase() {
    return this.blueprint.phases[this.currentPhaseIndex]
  }

  update(time: number, delta: number): void {
    const body = this.body
    body.setDrag(600, 0)

    this.tickCooldowns(delta)

    if (this.fsm.key === 'intro') {
      this.handleIntro(delta)
      return
    }

    this.evaluatePhase()
    this.selectNextState()
    this.applyState(delta)
  }

  hurt(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) {
      this.onDefeated()
    }
  }

  unlockIntro(): void {
    this.introLocked = false
  }

  private tickCooldowns(delta: number): void {
    this.attackCooldowns.forEach((remaining, key) => {
      const next = Math.max(0, remaining - delta)
      if (next <= 0) {
        this.attackCooldowns.delete(key)
      } else {
        this.attackCooldowns.set(key, next)
      }
    })
    if (this.nextAttackAvailableMs > 0) {
      this.nextAttackAvailableMs = Math.max(0, this.nextAttackAvailableMs - delta)
    }
    this.fsm.timerMs += delta
  }

  private handleIntro(delta: number): void {
    if (this.introLocked) {
      return
    }
    const introDuration = 1200
    if (this.fsm.timerMs >= introDuration) {
      this.enterState('idle')
    }
  }

  private evaluatePhase(): void {
    const hpRatio = this.hp / this.blueprint.baseStats.maxHp
    let nextIndex = this.currentPhaseIndex
    this.blueprint.phases.forEach((phase, index) => {
      if (hpRatio <= phase.threshold) {
        nextIndex = index
      }
    })

    if (nextIndex !== this.currentPhaseIndex) {
      this.currentPhaseIndex = nextIndex
      this.scene.events.emit('boss-phase-change', {
        id: this.blueprint.id,
        phase: this.blueprint.phases[this.currentPhaseIndex]
      })
    }
  }

  private selectNextState(): void {
    if (this.nextAttackAvailableMs > 0) {
      return
    }
    if (this.fsm.key !== 'idle' && this.fsm.key !== 'move' && this.fsm.key !== 'recover') {
      return
    }
    if (this.activeAttack) {
      return
    }

    const availableAttacks = this.blueprint.attacks.filter((attack) => {
      if (!this.isAttackUnlocked(attack.name)) {
        return false
      }
      if (this.attackCooldowns.get(attack.name) ?? 0 > 0) {
        return false
      }
      return true
    })

    if (availableAttacks.length === 0) {
      this.enterState('idle')
      return
    }

    const chosen = Phaser.Utils.Array.GetRandom(availableAttacks)
    this.enterState(chosen.state, chosen)
  }

  private applyState(delta: number): void {
    const body = this.body
    const attack = this.activeAttack
    switch (this.fsm.key) {
      case 'idle':
        body.setAcceleration(0, 0)
        this.playAnimation('idle')
        break
      case 'move':
        body.setAccelerationX(this.blueprint.baseStats.moveSpeed * 0.6)
        this.playAnimation('move')
        break
      case 'jump':
        if (this.fsm.timerMs < delta) {
          body.setVelocityY(-this.blueprint.baseStats.jumpHeight)
        }
        this.playAnimation('jump')
        break
      case 'dash':
        if (attack && this.fsm.timerMs < attack.executeMs) {
          const playerX = this.scene.registry.get('player_x') as number | undefined
          const direction = (playerX ?? this.x) < this.x ? -1 : 1
          body.setVelocityX(direction * this.blueprint.baseStats.dashSpeed)
        }
        this.playAnimation('dash')
        break
      case 'shoot':
      case 'summon':
      case 'special':
        if (
          attack &&
          !this.fsm.attackFired &&
          this.fsm.timerMs >= attack.telegraph.telegraphMs
        ) {
          this.scene.events.emit('boss-attack', { id: this.blueprint.id, attack })
          this.attackCooldowns.set(attack.name, attack.cooldownMs)
          this.fsm.attackFired = true
        }
        this.playAnimation(this.fsm.key)
        break
    }

    if (attack) {
      const duration = Math.max(attack.executeMs, attack.telegraph.telegraphMs)
      if (this.fsm.timerMs >= duration) {
        this.nextAttackAvailableMs = Math.max(this.nextAttackAvailableMs, attack.cooldownMs)
        this.enterState('recover')
      }
    }

    if (this.fsm.key === 'recover' && this.fsm.timerMs > 220) {
      this.enterState('idle')
    }
  }

  private enterState(state: BossStateKey, attack?: AttackPattern): void {
    this.fsm = { key: state, timerMs: 0, attackFired: false }
    this.activeAttack = attack
  }

  private isAttackUnlocked(name: string): boolean {
    const unlockIndex = this.blueprint.phases.findIndex((phase) => phase.newAttacks.includes(name))
    if (unlockIndex === -1) {
      return true
    }
    return this.currentPhaseIndex >= unlockIndex
  }

  private onDefeated(): void {
    this.scene.events.emit('boss-defeated', { id: this.blueprint.id, reward: this.blueprint.weaponReward })
    this.destroy()
  }

  private playAnimation(state: string): void {
    if (this.usingPlaceholder) {
      return
    }
    const anim = this.blueprint.spritePlan.animations.find((a) => a.key.includes(state))
    if (!anim) {
      return
    }
    const animKey = `${this.blueprint.id}_${anim.key}`
    if (!this.scene.anims.exists(animKey)) {
      this.scene.anims.create({
        key: animKey,
        frames: this.scene.anims.generateFrameNames(anim.atlas, {
          prefix: `${anim.key}_`,
          start: 0,
          end: anim.frames - 1
        }),
        frameRate: anim.fps,
        repeat: -1
      })
    }
    this.sprite.play(animKey, true)
  }
}
