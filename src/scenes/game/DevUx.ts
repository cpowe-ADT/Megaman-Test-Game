import type Phaser from 'phaser'
import { AUTOMATION } from '../../config/automation'
import { DEBUG_UI } from '../../config/debug'
import { STRICT_PIXEL_RENDER_POLICY } from '../../config/renderPolicy'
import type { EnemySpawner } from '../../enemy'
import type { SceneInputActions } from '../../input/InputActions'
import type { NewPlayerRuntime } from '../../player/NewPlayerRuntime'
import type { PlatformCollisionSystem } from '../../physics'
import type { CombatDebugBus } from '../../tools/debug/CombatDebugBus'
import { makeGameCombatSnapshot } from '../../tools/debug/StateSnapshot'
import { DebugOverlay } from '../../ui/DebugOverlay'

/** The Phaser scene-systems shutdown event name (`Phaser.Scenes.Events.SHUTDOWN`), kept as a plain
 * string so this module has no runtime dependency on Phaser. */
const SHUTDOWN_EVENT = 'shutdown'

/** The Game scene as the developer overlay, entity registry and debug snapshots see it. */
export interface DevUxHost extends Phaser.Scene {
  actions: Pick<SceneInputActions, 'onPressed'>
  player: Phaser.Physics.Arcade.Sprite
  playerHp: number
  playerMaxHp: number
  bossHp?: { current: number; max: number }
  currentPhaseName: string
  activeBossId?: string
  bossUsingPlaceholder: boolean
  dashCooldownTimer?: number
  enemies?: Phaser.Physics.Arcade.Group
  stageBackgroundLayers: readonly unknown[]
  combatDebugBus: Pick<CombatDebugBus, 'getRecentHits' | 'getTotals'>
  enemySpawner?: Pick<EnemySpawner, 'getEntities'>
  newPlayerRuntime?: Pick<NewPlayerRuntime, 'getDebugState'>
  platformCollisionSystem?: Pick<PlatformCollisionSystem, 'isDropThroughActive'>
  touchControls?: { isVisible?(): boolean }
}

type DevRef = Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.Body; visible?: boolean }

type DevEntry = {
  kind: string
  ref: DevRef | undefined
  label?: Phaser.GameObjects.Text
}

/**
 * Developer UX for the Game scene: the ` overlay, D dump and \\ physics toggles, the entity
 * registry, collision logging, the DEBUG_UI overlay and the automation debug snapshots. Moved out
 * of `Game` unchanged in behaviour (EVAL-P5-010, slice 5.0c); `Game._dev` still reads `state`.
 */
export class DevUx {
  readonly state = {
    on: false,
    initOnce: false,
    tick: 0,
    panel: undefined as Phaser.GameObjects.Text | undefined,
    gfx: undefined as Phaser.GameObjects.Graphics | undefined,
    entries: new Map<number, DevEntry>(),
    nextId: 1
  }
  overlay?: DebugOverlay

  constructor(private readonly host: DevUxHost) {}

  init(): void {
    const host = this.host
    if (this.state.initOnce) return
    this.state.initOnce = true

    this.state.panel = host.add
      .text(8, 40, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#b0e0ff',
        lineSpacing: 2
      })
      .setScrollFactor(0)
      .setDepth(10001)
    this.state.gfx = host.add.graphics().setDepth(10000)

    const world = host.physics.world as any
    world.createDebugGraphic?.()
    // createDebugGraphic() turns drawDebug on, which drew every body into this hidden graphic each frame.
    world.drawDebug = false
    world.debugGraphic?.clear?.()
    world.debugGraphic?.setVisible?.(false)

    const dump = () => {
      const rows = Array.from(this.state.entries.values()).map(({ kind, ref }) => ({
        eid: ref?.data?.get?.('eid'),
        kind,
        owner: ref?.data?.get?.('owner'),
        hp: ref?.data?.get?.('hp'),
        maxHp: ref?.data?.get?.('maxHp'),
        active: !!ref?.active,
        visible: !!ref?.visible,
        bodyEnabled: !!ref?.body?.enable,
        immovable: !!ref?.body?.immovable,
        x: Math.round((ref as any)?.x ?? 0),
        y: Math.round((ref as any)?.y ?? 0),
        vx: Math.round(ref?.body?.velocity?.x ?? 0),
        vy: Math.round(ref?.body?.velocity?.y ?? 0),
        w: Math.round(ref?.body?.width ?? (ref as any)?.width ?? 0),
        h: Math.round(ref?.body?.height ?? (ref as any)?.height ?? 0),
        checkColl: ref?.body?.checkCollision ? { ...ref.body.checkCollision } : null
      }))
      console.table(rows)
      return rows
    }

    // Loaded lazily, gated on AUTOMATION.enabled (which the functions also check internally): this
    // module has no runtime dependency on `./GameDebugHooks`, which still imports real Phaser, so
    // DevUx keeps loading under node for fake-host tests when automation is off (the normal case).
    if (AUTOMATION.enabled) {
      void import('./GameDebugHooks').then(({ installGameDebugHooks }) => installGameDebugHooks(host, dump))
    }
    const toggleOverlay = () => {
      this.state.on = !this.state.on
      if (!this.state.on) {
        this.state.panel?.setText('')
        this.state.gfx?.clear()
      }
    }
    const handleDump = () => dump()
    const handlePhysics = () => {
      const arcadeWorld = host.physics.world as any
      arcadeWorld.drawDebug = !arcadeWorld.drawDebug
      arcadeWorld.debugGraphic?.clear?.()
      arcadeWorld.debugGraphic?.setVisible?.(arcadeWorld.drawDebug)
    }

    if (host.actions) {
      host.actions.onPressed('debugOverlay', toggleOverlay)
      host.actions.onPressed('debugDump', handleDump)
      host.actions.onPressed('debugPhysics', handlePhysics)

      host.events.once(SHUTDOWN_EVENT, () => {
        this.state.initOnce = false
        this.state.entries.clear()
        this.state.tick = 0
        if (AUTOMATION.enabled) {
          void import('./GameDebugHooks').then(({ uninstallGameDebugHooks }) => uninstallGameDebugHooks(dump))
        }
      })
    }
  }

  register<T extends DevRef>(
    ref: T | undefined,
    kind: string
  ): T | undefined {
    const host = this.host
    if (!ref) return ref

    const anyRef = ref as any
    anyRef.setDataEnabled?.()
    const data = anyRef.data as Phaser.Data.DataManager | undefined
    let id = data?.get?.('eid') as number | undefined
    if (id == null) {
      id = this.state.nextId++
      data?.set?.('eid', id)
    }
    data?.set?.('kind', kind)

    // The overlay label is created in devUpdate the first time the overlay shows this entry: up to
    // 132 Text objects per stage (player, boss, every pooled bullet) otherwise sat unused in normal play.
    let entry = this.state.entries.get(id)
    if (!entry) {
      entry = { kind, ref }
      this.state.entries.set(id, entry)
    } else {
      entry.kind = kind
      entry.ref = ref
    }

    return ref
  }

  update(): void {
    const host = this.host
    if (!this.state.on) {
      this.state.panel?.setText('')
      this.state.gfx?.clear()
      return
    }
    if (host.time.now < this.state.tick) return
    this.state.tick = host.time.now + 180

    this.state.gfx?.clear()

    const camera = host.cameras.main
    const pad = 128
    const view = camera.worldView
    const left = view.left - pad
    const right = view.right + pad
    const top = view.top - pad
    const bottom = view.bottom + pad

    const lines: string[] = ['` overlay  D dump  \\ physics', '─ entities near camera ─']

    for (const entry of this.state.entries.values()) {
      const { kind, ref } = entry
      if (!ref?.active) {
        entry.label?.setVisible(false)
        continue
      }
      const label = (entry.label ??= host.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '8px', color: '#7fffd4' }).setDepth(10000))

      const anyRef = ref as any
      const posx = Math.round(anyRef?.x ?? 0)
      const posy = Math.round(anyRef?.y ?? 0)
      const withinView = posx >= left && posx <= right && posy >= top && posy <= bottom
      label.setVisible(withinView)

      if (withinView) {
        const id = ref?.data?.get?.('eid')
        const hp = ref?.data?.get?.('hp')
        const mxhp = ref?.data?.get?.('maxHp')
        const own = ref?.data?.get?.('owner')
        const vx = Math.round(ref?.body?.velocity?.x ?? 0)
        const vy = Math.round(ref?.body?.velocity?.y ?? 0)

        label
          .setText(`#${id} ${kind}`)
          .setPosition((anyRef?.x ?? 0) - 18, (anyRef?.y ?? 0) - 16)

        const body = ref?.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          this.state.gfx?.lineStyle(1, 0x2afe6f, 1)
          this.state.gfx?.strokeRect(body.x, body.y, body.width, body.height)
        }

        const detailParts = [`#${id}`, kind]
        if (own) detailParts.push(`owner:${own}`)
        detailParts.push(`hp:${hp ?? '-'}/${mxhp ?? '-'}`, `xy:${posx},${posy}`, `v:${vx},${vy}`)
        lines.push(detailParts.join(' '))
      }
    }

    this.state.panel?.setText(lines.join('\n'))
  }

  logOverlap(tag: string, bullet: any, target: any, accepted: boolean, reason: string): void {
    if (!AUTOMATION.enabled) return
    const bId = bullet?.data?.get?.('eid')
    const tId = target?.data?.get?.('eid')
    const status = accepted ? 'ACCEPT' : 'BLOCK '
    const msg = `[COLLIDE] ${tag} ${status} b#${bId ?? '-'} -> t#${tId ?? '-'} :: ${reason}`
    console.log(msg, {
      bulletOwner: bullet?.data?.get?.('owner'),
      bulletBody: !!bullet?.body?.enable,
      targetKind: target?.data?.get?.('kind'),
      targetBody: !!target?.body?.enable
    })
  }

  getCombatDebugSnapshot(): Record<string, unknown> | null {
    const host = this.host
    const newPlayerState = this.getNewPlayerDebugState()
    const locomotionDebug = ((newPlayerState as any)?.locomotion ?? {}) as Record<string, unknown>
    const combatPlayerDebug = ((newPlayerState as any)?.combat ?? {}) as Record<string, unknown>
    const physicsDebug = ((newPlayerState as any)?.physics ?? {}) as Record<string, unknown>
    const inputDebug = ((newPlayerState as any)?.input ?? {}) as Record<string, unknown>
    const iFramesMs = Number((newPlayerState as any)?.combat?.iFramesMs ?? 0)
    const chargeMs = Number(combatPlayerDebug.chargeElapsedMs ?? 0)
    const shotsFiredTotal = Number(combatPlayerDebug.shotsFiredTotal ?? 0)
    const lastProjectileSpawnMs = Number(combatPlayerDebug.lastProjectileSpawnMs ?? 0)
    const lastProjectileSpawnFrame = Number(combatPlayerDebug.lastProjectileSpawnFrame ?? 0)
    const lastProjectile = (combatPlayerDebug.lastProjectile as any) ?? null
    const dashCooldownMs = Number(locomotionDebug.dashCooldownMs ?? 0)
    const slideRemainingMs = Number(locomotionDebug.dashMs ?? 0)
    const wallSliding = Boolean(locomotionDebug.wallSliding ?? false)
    const virtualControlsVisible = Boolean(host.touchControls?.isVisible?.())
    const snapshot = makeGameCombatSnapshot({
      recentHits: host.combatDebugBus.getRecentHits(10),
      totals: host.combatDebugBus.getTotals(),
      player: {
        hp: host.playerHp,
        maxHp: host.playerMaxHp,
        bodyProfileKey: String(physicsDebug.bodyProfileKey ?? '') || null,
        blocked: (physicsDebug.blocked as any) ?? null,
        touching: (physicsDebug.touching as any) ?? null,
        dropThroughActive: Boolean(physicsDebug.dropThroughActive),
        coyoteMs: Number(locomotionDebug.coyoteMs ?? 0),
        jumpBufferMs: Number(locomotionDebug.jumpBufferMs ?? 0),
        dashRemainingMs: Number(locomotionDebug.dashMs ?? 0),
        dashCooldownMs,
        dashStarted: Boolean(locomotionDebug.dashStarted),
        dashEnded: Boolean(locomotionDebug.dashEnded),
        slideRemainingMs,
        wallSide: (locomotionDebug.wallSide === -1 || locomotionDebug.wallSide === 1 ? locomotionDebug.wallSide : 0) as -1 | 0 | 1,
        lastLandingSpeed: Number(locomotionDebug.lastLandingSpeed ?? 0),
        lastJumpSource: String(locomotionDebug.lastJumpSource ?? 'none'),
        chargeMs,
        shotsFiredTotal,
        lastProjectileSpawnMs,
        lastProjectileSpawnFrame,
        lastProjectile,
        iFramesMs,
        lastDamageSource: String(combatPlayerDebug.lastDamageSource ?? 'none'),
        lastDamageTier: String(combatPlayerDebug.lastDamageTier ?? 'none'),
        knockback: (combatPlayerDebug.lastKnockback as any) ?? null,
        wallSliding,
        touchButtons: (inputDebug.touchButtons as any) ?? null,
        virtualControlsVisible
      },
      boss: {
        hp: host.bossHp ?? null,
        phase: host.currentPhaseName
      }
    })

    return snapshot
  }

  getNewPlayerDebugState(): Record<string, unknown> | null {
    const host = this.host
    const runtimeState = host.newPlayerRuntime?.getDebugState?.() ?? null
    if (!runtimeState) {
      return null
    }
    const physicsState = (runtimeState as any).physics && typeof (runtimeState as any).physics === 'object'
      ? { ...(runtimeState as any).physics }
      : {}
    physicsState.dropThroughActive = Boolean(
      host.player && host.platformCollisionSystem?.isDropThroughActive(host.player)
    )
    return {
      ...runtimeState,
      physics: physicsState
    }
  }

  getVisualDebugSnapshot(): Record<string, unknown> | null {
    const host = this.host
    const enemyEntities = host.enemySpawner?.getEntities?.() ?? []
    let enemyPlaceholderCount = 0
    const missingEnemyAtlases = new Set<string>()

    enemyEntities.forEach((entity) => {
      const enemySprite = entity.sprite
      const usingPlaceholder = Boolean(enemySprite.data?.get?.('enemyUsingPlaceholder'))
      if (usingPlaceholder) {
        enemyPlaceholderCount += 1
      }

      const typeKey = entity.typeKey ?? (enemySprite.data?.get?.('enemyTypeKey') as string | undefined)
      if (typeof typeKey === 'string' && typeKey.length > 0 && !host.textures.exists(`atlas_${typeKey}`)) {
        missingEnemyAtlases.add(typeKey)
      }
    })

    if (enemyEntities.length === 0 && host.enemies) {
      host.enemies.getChildren().forEach((child) => {
        const sprite = child as Phaser.Physics.Arcade.Sprite
        const textureKey = String(sprite.texture?.key ?? '')
        if (!textureKey.startsWith('atlas_')) {
          enemyPlaceholderCount += 1
        }
      })
    }

    const playerTextureKey = String(host.player?.texture?.key ?? '')
    const playerUsingPlaceholder = Boolean(host.player) && playerTextureKey !== 'atlas_player_main'
    const playerAtlasMissing = host.textures.exists('atlas_player_main') ? 0 : 1

    const bossAtlasKey = host.activeBossId ? `atlas_${host.activeBossId}` : undefined
    const bossAtlasMissing =
      typeof bossAtlasKey === 'string' && bossAtlasKey.length > 0 && !host.textures.exists(bossAtlasKey) ? 1 : 0

    const config = host.game.config as any
    const renderConfig = config.render ?? {}
    const antialias = renderConfig.antialias ?? config.antialias ?? STRICT_PIXEL_RENDER_POLICY.antialias
    const roundPixels = renderConfig.roundPixels ?? config.roundPixels ?? STRICT_PIXEL_RENDER_POLICY.roundPixels
    const pixelArt = config.pixelArt ?? STRICT_PIXEL_RENDER_POLICY.pixelArt
    let nonPixelFilteredCount = 0
    if (antialias !== STRICT_PIXEL_RENDER_POLICY.antialias) {
      nonPixelFilteredCount += 1
    }
    if (roundPixels !== STRICT_PIXEL_RENDER_POLICY.roundPixels) {
      nonPixelFilteredCount += 1
    }
    if (pixelArt !== STRICT_PIXEL_RENDER_POLICY.pixelArt) {
      nonPixelFilteredCount += 1
    }

    return {
      placeholderCount: (playerUsingPlaceholder ? 1 : 0) + enemyPlaceholderCount + (host.bossUsingPlaceholder ? 1 : 0),
      missingAtlasCount: playerAtlasMissing + bossAtlasMissing + missingEnemyAtlases.size,
      nonPixelFilteredCount,
      backgroundLayerCount: host.stageBackgroundLayers.length
    }
  }

  installOverlay(): void {
    const host = this.host
    host.actions.onPressed('debugOverlay', () => this.overlay?.toggle())

    if (DEBUG_UI) {
      this.overlay = new DebugOverlay(host)
      host.events.once(SHUTDOWN_EVENT, () => this.overlay?.destroy())
    }
  }

  updateOverlay(): void {
    const host = this.host
    if (DEBUG_UI) {
      const combatDebug = this.getCombatDebugSnapshot() as {
        recentHits?: Array<{ source: string; target: string; amount: number; accepted: boolean }>
        player?: { dashCooldownMs?: number; chargeMs?: number; iFramesMs?: number }
      } | null
      const recentHit = combatDebug?.recentHits?.[combatDebug.recentHits.length - 1]
      this.overlay?.update({
        sceneName: host.scene.key,
        managerName: host.scene.key,
        confirmHint: 'Enter / NumpadEnter (menus)',
        jumpHint: 'Space',
        pauseHint: 'Esc (return)',
        playerHp: host.playerHp,
        playerMaxHp: host.playerMaxHp,
        bossHpCurrent: host.bossHp?.current ?? null,
        bossHpMax: host.bossHp?.max ?? null,
        phaseName: host.currentPhaseName || null,
        dashCooldownMs: combatDebug?.player?.dashCooldownMs ?? host.dashCooldownTimer,
        chargeMs: combatDebug?.player?.chargeMs ?? 0,
        iFramesMs: combatDebug?.player?.iFramesMs ?? 0,
        recentHit: recentHit
          ? `${recentHit.source}->${recentHit.target} ${recentHit.amount} (${recentHit.accepted ? 'ok' : 'blocked'})`
          : null
      })
    }
  }
}
