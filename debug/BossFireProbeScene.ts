import Phaser from 'phaser'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: BossController carries Phaser-heavy types not needed for probe build
import { BossBlueprint } from '../src/bosses/types'
import { ProbeLogger } from '../src/systems/debug/ProbeLogger'
import { DIAGNOSTICS_ENABLED } from '../src/config/diagnostics'
import {
  ensurePlaceholderTexture,
  wrapBossProjectileFactory,
  noteGroupFull,
  hasCapacity,
  BossProjectileDiagnosticsState,
  BOSS_BULLET_TEXTURE_KEY
} from '../src/boss/diagnostics/BossFireDiagnostics'
import {
  EVENTS,
  emitBossEvent,
  GlobalEventBus,
  BossAttackLifecycleEvent,
  BossProjectileSpawnedEvent,
  BossCooldownResetEvent,
  BossAttackCompleteEvent
} from '../src/events'

export type ProbeOutcome = {
  mode: 'controller' | 'legacy'
  passed: boolean
  shots: number
  firstShotMs?: number
  suspects: string[]
  notes?: string[]
}

const PROBE_BOSS_BLUEPRINT: BossBlueprint = {
  id: 'probe_boss',
  codename: 'Probe Sentinel',
  element: 'Normal',
  arena: 'Diagnostic Void',
  introCallout: 'TEST HARNESS',
  theme: { primary: 0x44aaee, accent: 0xffffff, glow: 0x2277aa, trail: 0x44aaee },
  baseStats: {
    maxHp: 8,
    contactDamage: 1,
    moveSpeed: 10,
    dashSpeed: 10,
    jumpHeight: 10
  },
  movementProfile: {
    weight: 'light',
    preferredRange: 'mid',
    mobilityNotes: 'Static probe'
  },
  weaponReward: {
    id: 'ArcSlash',
    element: 'Normal',
    displayName: 'Probe Slice',
    energyCost: 1,
    maxEnergy: 4,
    description: 'Diagnostic placeholder',
    tutorial: 'N/A'
  },
  attacks: [
    {
      name: 'Diagnostic Shot',
      state: 'shoot',
      description: 'Fires a simple pellet toward the player.',
      telegraph: { telegraphMs: 160, warningFx: 'fan-lines', anchor: 'target' },
      executeMs: 180,
      cooldownMs: 420,
      spawns: ['probe_bullet']
    }
  ],
  phases: [
    {
      name: 'Baseline',
      threshold: 1,
      enraged: false,
      description: 'Always available attack for probe.',
      newAttacks: [],
      cadenceMultiplier: 1
    }
  ],
  spritePlan: {
    frame: { x: 32, y: 32 },
    origin: { x: 0.5, y: 0.5 },
    animations: [
      {
        atlas: 'probe-boss',
        key: 'probe_idle',
        frames: 1,
        fps: 1,
        description: 'Placeholder idle.'
      }
    ]
  }
}

const MODE_SEQUENCE: Array<'controller' | 'legacy'> = ['controller', 'legacy']

interface ProbeRuntime {
  outcome: ProbeOutcome
  startTime: number
  attackEvents: number
  projectileEvents: number
  suspects: Set<string>
  notes: string[]
  expiryTimer: Phaser.Time.TimerEvent
  loopTimer?: Phaser.Time.TimerEvent
  controller?: BossControllerInstance
  legacySprite?: Phaser.Physics.Arcade.Sprite
  diagnostics: BossProjectileDiagnosticsState
}

interface BossControllerInstance {
  update(time: number, delta: number): void
  unlockIntro(): void
  destroy(fromScene?: boolean): void
  readonly blueprint: BossBlueprint
}

type BossControllerCtor = new (
  scene: Phaser.Scene,
  blueprint: BossBlueprint,
  config: { spawn: Phaser.Math.Vector2; lockIntro?: boolean }
) => BossControllerInstance

let bossControllerCtor: BossControllerCtor | null = null

async function ensureBossController(): Promise<BossControllerCtor> {
  if (bossControllerCtor) {
    return bossControllerCtor
  }
  // @ts-ignore -- Vite resolves runtime module; tsconfig.probe remaps to proxy for type checks
  const module = await import('@boss/BossController')
  bossControllerCtor = module.BossController as BossControllerCtor
  return bossControllerCtor
}

export class BossFireProbeScene extends Phaser.Scene {
  private logger = new ProbeLogger('BOSS_PROBE')
  private modeIndex = 0
  private runtime?: ProbeRuntime
  private projectileGroup?: Phaser.Physics.Arcade.Group
  private spawnProjectile!: (attackName: string, mode: 'controller' | 'legacy') => Phaser.GameObjects.GameObject | null
  private results: Record<'controller' | 'legacy', ProbeOutcome | undefined> = {
    controller: undefined,
    legacy: undefined
  }

  constructor() {
    super({ key: 'BossFireProbeScene' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0d101a)
    this.scale.setGameSize(320, 240)
    this.physics.world.setBounds(0, 0, 320, 240)
    this.registry.set('player_x', 120)
    this.nextMode()
  }

  update(time: number, delta: number): void {
    if (this.runtime?.controller) {
      this.runtime.controller.update(time, delta)
    }
  }

  private setupProjectileFactory(diagnostics: BossProjectileDiagnosticsState): void {
    const spawnCore = (
      attackName: string,
      mode: 'controller' | 'legacy'
    ): Phaser.GameObjects.GameObject | null => {
      if (!this.projectileGroup) {
        return null
      }
      if (!hasCapacity(this.projectileGroup)) {
        diagnostics.groupFullHits += 1
        noteGroupFull(diagnostics, this.projectileGroup, mode)
        this.runtime?.suspects.add('group_full')
        return null
      }
      const originX = mode === 'controller' ? 200 : 120
      const originY = 140
      const sprite = this.projectileGroup.get(
        originX,
        originY,
        BOSS_BULLET_TEXTURE_KEY
      ) as Phaser.Physics.Arcade.Sprite | null
      if (!sprite) {
        diagnostics.groupFullHits += 1
        noteGroupFull(diagnostics, this.projectileGroup, mode)
        this.runtime?.suspects.add('group_full')
        return null
      }
      sprite.setActive(true).setVisible(true)
      sprite.setPosition(originX, originY)
      sprite.setDepth(10)
      const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.setAllowGravity(false)
        body.setVelocity(mode === 'controller' ? -160 : 160, 0)
        body.setCollideWorldBounds(false)
      }
      if (!DIAGNOSTICS_ENABLED) {
        const payload: BossProjectileSpawnedEvent = {
          id: 'probe_bullet',
          attackName,
          timestamp: this.time.now,
          mode,
          texture: sprite.texture?.key,
          groupSize: {
            used: this.projectileGroup.getTotalUsed(),
            total: this.projectileGroup.getLength()
          }
        }
        emitBossEvent(EVENTS.BOSS_PROJECTILE_SPAWNED, payload)
      }
      return sprite
    }

    this.spawnProjectile = wrapBossProjectileFactory(
      diagnostics,
      spawnCore,
      (result, attackName, mode) => ({
        id: 'probe_bullet',
        attackName,
        mode,
        group: this.projectileGroup,
        sprite: result
      }),
      this
    )
  }

  private prepareMode(mode: 'controller' | 'legacy'): void {
    const diagnostics = ensurePlaceholderTexture(this)
    const outcome: ProbeOutcome = {
      mode,
      passed: false,
      shots: 0,
      suspects: []
    }
    const suspects = new Set<string>()
    const expiryTimer = this.time.delayedCall(3000, () => {
      this.finishMode(mode)
    })

    const runtime: ProbeRuntime = {
      outcome,
      startTime: this.time.now,
      attackEvents: 0,
      projectileEvents: 0,
      suspects,
      notes: [],
      diagnostics,
      expiryTimer
    }
    this.runtime = runtime
    this.projectileGroup = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 12,
      allowGravity: false,
      runChildUpdate: false,
      collideWorldBounds: true,
      defaultKey: BOSS_BULLET_TEXTURE_KEY
    })

    if ((this.projectileGroup.maxSize ?? 0) <= 0 && this.projectileGroup.getLength() <= 0) {
      runtime.notes.push('group_capacity_invalid')
      runtime.suspects.add('group_full')
    }
    this.setupProjectileFactory(diagnostics)

    GlobalEventBus.on(EVENTS.BOSS_ENTERED_ATTACK, this.handleAttackLifecycle, this)
    GlobalEventBus.on(EVENTS.BOSS_PROJECTILE_SPAWNED, this.handleProjectileSpawned, this)
    GlobalEventBus.on(EVENTS.BOSS_COOLDOWN_RESET, this.handleCooldownReset, this)
    GlobalEventBus.on(EVENTS.BOSS_ATTACK_COMPLETE, this.handleAttackComplete, this)

    if (diagnostics.usedPlaceholder) {
      suspects.add('missing_texture')
    }

    if (mode === 'controller') {
      ensureBossController()
        .then((Controller) => {
          if (!this.runtime || this.runtime !== runtime) {
            return
          }
          const controller = new Controller(this, PROBE_BOSS_BLUEPRINT, {
            spawn: new Phaser.Math.Vector2(220, 140),
            lockIntro: false
          })
          runtime.controller = controller
          this.time.delayedCall(100, () => controller.unlockIntro())
          this.events.on('boss-attack', this.handleControllerAttack, this)
        })
        .catch((error) => {
          runtime.notes.push(`controller_load_failed:${error instanceof Error ? error.message : 'unknown'}`)
          runtime.suspects.add('no_factory')
          this.finishMode(mode)
        })
    } else {
      const sprite = this.physics.add.sprite(120, 140, diagnostics.placeholderTextureKey)
      sprite.setVisible(true).setActive(true)
      sprite.body.setAllowGravity(false)
      runtime.legacySprite = sprite
      this.startLegacyLoop()
    }
  }

  private handleControllerAttack(event: { attack: any }): void {
    if (!event?.attack || !this.runtime) {
      return
    }
    const attack = event.attack
    const payload: BossAttackLifecycleEvent = {
      id: PROBE_BOSS_BLUEPRINT.id,
      attack,
      timestamp: this.time.now,
      mode: 'controller'
    }
    emitBossEvent(EVENTS.BOSS_ENTERED_ATTACK, payload)
    this.time.delayedCall(attack.telegraph.telegraphMs, () => {
      this.executeAttack(attack.name, 'controller')
      const completePayload: BossAttackCompleteEvent = {
        id: PROBE_BOSS_BLUEPRINT.id,
        attackName: attack.name,
        timestamp: this.time.now,
        result: 'fired'
      }
      emitBossEvent(EVENTS.BOSS_ATTACK_COMPLETE, completePayload)
    })
    this.time.delayedCall(attack.cooldownMs, () => {
      const cooldownPayload: BossCooldownResetEvent = {
        id: PROBE_BOSS_BLUEPRINT.id,
        attackName: attack.name,
        nextAvailableMs: attack.cooldownMs,
        timestamp: this.time.now,
        mode: 'controller'
      }
      emitBossEvent(EVENTS.BOSS_COOLDOWN_RESET, cooldownPayload)
    })
  }

  private startLegacyLoop(): void {
    if (!this.runtime) {
      return
    }
    const attack = PROBE_BOSS_BLUEPRINT.attacks[0]
    const timer = this.time.addEvent({
      delay: attack.cooldownMs,
      loop: true,
      startAt: attack.telegraph.telegraphMs,
      callback: () => {
        const payload: BossAttackLifecycleEvent = {
          id: PROBE_BOSS_BLUEPRINT.id,
          attack,
          timestamp: this.time.now,
          mode: 'legacy'
        }
        emitBossEvent(EVENTS.BOSS_ENTERED_ATTACK, payload)
        this.time.delayedCall(attack.telegraph.telegraphMs, () => {
          this.executeAttack(attack.name, 'legacy')
          const completePayload: BossAttackCompleteEvent = {
            id: PROBE_BOSS_BLUEPRINT.id,
            attackName: attack.name,
            timestamp: this.time.now,
            result: 'fired'
          }
          emitBossEvent(EVENTS.BOSS_ATTACK_COMPLETE, completePayload)
        })
        this.time.delayedCall(attack.cooldownMs, () => {
          const cooldownPayload: BossCooldownResetEvent = {
            id: PROBE_BOSS_BLUEPRINT.id,
            attackName: attack.name,
            nextAvailableMs: attack.cooldownMs,
            timestamp: this.time.now,
            mode: 'legacy'
          }
          emitBossEvent(EVENTS.BOSS_COOLDOWN_RESET, cooldownPayload)
        })
      }
    })
    this.runtime.notes.push('legacy loop armed')
    this.runtime.loopTimer = timer
  }

  private executeAttack(attackName: string, mode: 'controller' | 'legacy'): void {
    this.spawnProjectile(attackName, mode)
  }

  private handleAttackLifecycle(event: BossAttackLifecycleEvent): void {
    if (!this.runtime || event.mode !== this.runtime.outcome.mode) {
      return
    }
    this.runtime.attackEvents += 1
  }

  private handleProjectileSpawned(event: BossProjectileSpawnedEvent): void {
    if (!this.runtime || event.mode !== this.runtime.outcome.mode) {
      return
    }
    this.runtime.projectileEvents += 1
    this.runtime.outcome.shots = this.runtime.projectileEvents
    if (this.runtime.outcome.firstShotMs == null) {
      this.runtime.outcome.firstShotMs = this.time.now - this.runtime.startTime
    }
    this.runtime.outcome.passed = true
    this.runtime.expiryTimer.remove(false)
    this.runtime.loopTimer?.remove(false)
    const mode = this.runtime.outcome.mode
    this.finishMode(mode)
  }

  private handleCooldownReset(event: BossCooldownResetEvent): void {
    if (!this.runtime || event.id !== PROBE_BOSS_BLUEPRINT.id) {
      return
    }
    if (event.mode && event.mode !== this.runtime.outcome.mode) {
      return
    }
    this.runtime.notes.push(`cooldown_reset:${event.attackName}`)
  }

  private handleAttackComplete(event: BossAttackCompleteEvent): void {
    if (!this.runtime || event.id !== PROBE_BOSS_BLUEPRINT.id) {
      return
    }
    if (event.result !== 'fired') {
      this.runtime.suspects.add('attack_skipped')
    }
  }

  private finishMode(mode: 'controller' | 'legacy'): void {
    if (!this.runtime || this.runtime.outcome.mode !== mode) {
      return
    }

    const runtime = this.runtime

    GlobalEventBus.off(EVENTS.BOSS_ENTERED_ATTACK, this.handleAttackLifecycle, this)
    GlobalEventBus.off(EVENTS.BOSS_PROJECTILE_SPAWNED, this.handleProjectileSpawned, this)
    GlobalEventBus.off(EVENTS.BOSS_COOLDOWN_RESET, this.handleCooldownReset, this)
    GlobalEventBus.off(EVENTS.BOSS_ATTACK_COMPLETE, this.handleAttackComplete, this)
    this.events.off('boss-attack', this.handleControllerAttack, this)

    runtime.expiryTimer.remove(false)
    runtime.loopTimer?.remove(false)

    if (runtime.controller) {
      runtime.controller.destroy(true)
    }
    if (runtime.legacySprite) {
      runtime.legacySprite.destroy()
    }
    this.projectileGroup?.clear(true, true)

    const now = this.time.now
    const suspects = runtime.suspects
    if (runtime.attackEvents === 0) {
      suspects.add('no_events')
    }
    if (runtime.projectileEvents === 0) {
      suspects.add('no_projectiles')
    }
    if (runtime.attackEvents > 0 && runtime.projectileEvents === 0) {
      suspects.add('no_factory')
    }
    if (runtime.attackEvents > 0 && runtime.projectileEvents === 0 && now - runtime.startTime > 1500) {
      suspects.add('cooldown_stuck')
    }
    if (runtime.diagnostics.groupFullHits > 0) {
      suspects.add('group_full')
    }
    if (this.physics.world.isPaused) {
      suspects.add('paused_flag')
    }
    runtime.outcome.shots = runtime.projectileEvents
    runtime.outcome.suspects = Array.from(suspects)
    if (runtime.notes.length > 0) {
      runtime.outcome.notes = runtime.notes
    }

    this.results[mode] = runtime.outcome

    this.logger.info(
      `mode=${mode} passed=${runtime.outcome.passed} shots=${runtime.outcome.shots}` +
        (runtime.outcome.firstShotMs != null ? ` firstShotMs=${runtime.outcome.firstShotMs}` : ''),
      {
        suspects: runtime.outcome.suspects
      }
    )

    this.runtime = undefined
    this.modeIndex += 1
    if (this.modeIndex < MODE_SEQUENCE.length) {
      this.time.delayedCall(200, () => this.nextMode())
    } else {
      this.summarize()
    }
  }

  private summarize(): void {
    const controller = this.results.controller ?? {
      mode: 'controller',
      passed: false,
      shots: 0,
      suspects: ['no_result']
    }
    const legacy = this.results.legacy ?? {
      mode: 'legacy',
      passed: false,
      shots: 0,
      suspects: ['no_result']
    }
    console.table([controller, legacy])
    const overall = controller.passed && legacy.passed ? 'PASS' : 'FAIL'
    console.log(
      `[BOSS_PROBE] mode=controller passed=${controller.passed} shots=${controller.shots}` +
        (controller.firstShotMs != null ? ` firstShotMs=${controller.firstShotMs}` : '')
    )
    console.log(
      `[BOSS_PROBE] mode=legacy     passed=${legacy.passed} shots=${legacy.shots}` +
        (legacy.firstShotMs != null ? ` firstShotMs=${legacy.firstShotMs}` : '')
    )
    const summary = {
      controller,
      legacy,
      overall
    }
    console.log(`BOSS_PROBE_RESULT=${JSON.stringify(summary)}`)
  }

  private nextMode(): void {
    const mode = MODE_SEQUENCE[this.modeIndex]
    if (!mode) {
      return
    }
    this.logger.info(`starting mode=${mode}`)
    this.prepareMode(mode)
  }
}

function boot(): void {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 320,
    height: 240,
    parent: 'app',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [BossFireProbeScene]
  }

  // eslint-disable-next-line no-new
  new Phaser.Game(config)
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => boot())
}
