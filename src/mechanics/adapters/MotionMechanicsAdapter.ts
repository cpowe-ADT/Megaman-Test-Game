import Phaser from 'phaser'
import type { StageArenaDefinition } from '../../content/campaign'
import { NEUTRAL_PLAYER_ENVIRONMENT, type PlayerEnvironment } from '../../player/environment'
import { conveyorBox, conveyorCarryAt, conveyorCarryDeltaX, conveyorSpeed, type ConveyorDefinition } from '../conveyor'
import type { Box } from '../crumbleGroup'
import { currentFlowDirection, type CurrentZoneDefinition } from '../currentZone'
import type { ZoneRect } from '../forceZone'
import { resolveHeroEnvironment } from '../heroEnvironment'
import { iceFloorBox, type IceFloorDefinition } from '../iceFloor'
import { MECHANICS_V2_ATLAS } from '../mechanicsVisuals'
import {
  CONVEYOR_BELT_TOP_ROW,
  FLOW_SCROLL_PX_PER_S,
  MAGNET_FIELD_TINT,
  MAGNET_PLATE_HEIGHT,
  MAGNET_PLATE_TOP_ROW,
  MECHANICS_V2_FRAME_SIZE,
  conveyorFrameIndex,
  conveyorTileLayout,
  flowFrameIndex,
  flowTileOffsetX,
  iceTileFrameIndex,
  liftTileOffsetY,
  magnetFrameIndex,
  mechanicsV2Frame,
  windArtAlpha,
  windLiftFrameIndex
} from '../mechanicsV2Visuals'
import { resolveWindZone, windCycleAt, type ResolvedWindZone, type WindPhase } from '../windZone'
import { mechanicsFrameName, mechanicsV2ArtReady, playMechanicSfx, setMechanicsV2Frame, type MechanicsFrame } from './mechanicsArt'
import { windPhaseSfx } from '../../audio/mechanicsSfx'

export type MotionMechanicsDeps = {
  scene: Phaser.Scene
  player: () => Phaser.Physics.Arcade.Sprite | undefined
  runtime: () => { setEnvironment?(environment: Partial<PlayerEnvironment> | null): void } | undefined
  platforms: () => { findPlatformVisual(id: string): Phaser.GameObjects.GameObject | undefined } | undefined
}

type Hideable = Phaser.GameObjects.GameObject & { setVisible(value: boolean): unknown }
type BeltEntry = { def: ConveyorDefinition; speed: number; box: Box; art?: Phaser.GameObjects.TileSprite; carried: number }
type IceEntry = { def: IceFloorDefinition; box: Box; art?: Phaser.GameObjects.TileSprite }
type CurrentEntry = { def: CurrentZoneDefinition; direction: 1 | -1; art?: Phaser.GameObjects.TileSprite; plain?: Phaser.GameObjects.Rectangle }
type WindEntry = {
  zone: ResolvedWindZone
  phase: WindPhase
  untilBlowMs: number
  art?: Phaser.GameObjects.TileSprite
  plate?: Phaser.GameObjects.Image
  plain?: Phaser.GameObjects.Rectangle
}

const CURRENT_ALPHA = 0.6
const LIFT_ALPHA = 0.8
const MAGNET_FIELD_ALPHA = 0.55
const PLAIN_ZONE_COLOR = { current: 0x3fa7ff, wind: 0xdff4ff, magnet: 0xa99bff } as const
/** Zone art sits just under the hero (it read over the hero at depth 1); belts and ice stand at the platforms' art depth. */
const ZONE_DEPTH_UNDER_HERO = 0.5
const SURFACE_DEPTH = 2

/**
 * Phaser edge of the 12b movement mechanics: `conveyor`, `ice_floor`, `current_zone` and `wind_zone` (gust,
 * lift, magnet lift). Once per frame it folds the belt and ice under the hero's feet and the zones around
 * its body into the motor environment (`runtime.setEnvironment`), moves other grounded bodies (enemies,
 * pickups) along the belts, and draws the tells from `mechanics_v2`: stepping chevrons, the ice shimmer,
 * bubbles and streaks drifting with the flow. Installed by `StageMechanicsAdapter`, which owns the clock.
 */
export class MotionMechanicsAdapter {
  private readonly belts: BeltEntry[] = []
  private readonly ice: IceEntry[] = []
  private readonly currents: CurrentEntry[] = []
  private readonly winds: WindEntry[] = []
  private readonly art: boolean
  private readonly zoneDepth: number
  private environment: PlayerEnvironment = { ...NEUTRAL_PLAYER_ENVIRONMENT }
  private beltId: string | null = null
  private iceId: string | null = null
  private zoneIds: string[] = []

  constructor(
    private readonly deps: MotionMechanicsDeps,
    arena: Pick<StageArenaDefinition, 'conveyors' | 'iceFloors' | 'currentZones' | 'windZones'>
  ) {
    this.art = mechanicsV2ArtReady(deps.scene)
    this.zoneDepth = (deps.player()?.depth ?? 0) - ZONE_DEPTH_UNDER_HERO
    for (const def of arena.conveyors ?? []) {
      const box = conveyorBox(def)
      const speed = conveyorSpeed(def)
      this.belts.push({ def, speed, box, art: this.createBeltArt(def.id, box, speed), carried: 0 })
    }
    for (const def of arena.iceFloors ?? []) {
      const box = iceFloorBox(def)
      this.ice.push({ def, box, art: this.createIceArt(def.id, box) })
    }
    for (const def of arena.currentZones ?? []) {
      const direction = currentFlowDirection(def)
      const entry: CurrentEntry = { def, direction }
      if (this.art) entry.art = this.createZoneArt(def, 'current', 0).setAlpha(CURRENT_ALPHA).setFlipX(direction < 0)
      else entry.plain = this.createPlainZone(def, PLAIN_ZONE_COLOR.current, 0.18)
      this.currents.push(entry)
    }
    for (const def of arena.windZones ?? []) this.winds.push(this.createWind(resolveWindZone(def)))
  }

  /** Any movement mechanic on this stage (a stage without one never touches the hero's environment). */
  get active(): boolean {
    return this.belts.length + this.ice.length + this.currents.length + this.winds.length > 0
  }

  /** The belts' and ice floors' own drawing is hidden; the art stands on the body's top edge. */
  private hidePlatformDrawing(id: string): boolean {
    const visual = this.deps.platforms()?.findPlatformVisual(id) as Hideable | undefined
    if (!this.art || !visual) return false
    visual.setVisible(false)
    return true
  }

  private createBeltArt(id: string, box: Box, speed: number): Phaser.GameObjects.TileSprite | undefined {
    if (!this.hidePlatformDrawing(id)) return undefined
    const size = MECHANICS_V2_FRAME_SIZE.conveyor
    const layout = conveyorTileLayout(box.right - box.left)
    const art = this.deps.scene.add
      .tileSprite((box.left + box.right) / 2, box.top - CONVEYOR_BELT_TOP_ROW, layout.tiles * size.width, size.height, MECHANICS_V2_ATLAS.key, mechanicsV2Frame('conveyor', 0))
      .setOrigin(0.5, 0)
      .setDepth(SURFACE_DEPTH)
      .setFlipX(speed < 0)
    art.setScale(layout.scaleX, 1)
    return art
  }

  private createIceArt(id: string, box: Box): Phaser.GameObjects.TileSprite | undefined {
    if (!this.hidePlatformDrawing(id)) return undefined
    return this.deps.scene.add
      .tileSprite((box.left + box.right) / 2, box.top, box.right - box.left, box.bottom - box.top, MECHANICS_V2_ATLAS.key, mechanicsV2Frame('ice_tile', 0))
      .setOrigin(0.5, 0)
      .setDepth(SURFACE_DEPTH)
  }

  private createZoneArt(rect: ZoneRect, group: 'current' | 'wind_gust' | 'wind_lift', index: 0 | 1): Phaser.GameObjects.TileSprite {
    return this.deps.scene.add
      .tileSprite(rect.x + rect.width / 2, rect.y, rect.width, rect.height, MECHANICS_V2_ATLAS.key, mechanicsV2Frame(group, index))
      .setOrigin(0.5, 0)
      .setDepth(this.zoneDepth)
  }

  private createPlainZone(rect: ZoneRect, color: number, alpha: number): Phaser.GameObjects.Rectangle {
    return this.deps.scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, color, alpha).setOrigin(0, 0).setDepth(this.zoneDepth)
  }

  private createWind(zone: ResolvedWindZone): WindEntry {
    const entry: WindEntry = { zone, phase: 'calm', untilBlowMs: 0 }
    const magnet = zone.style === 'magnet'
    if (!this.art) {
      entry.plain = this.createPlainZone(zone.rect, magnet ? PLAIN_ZONE_COLOR.magnet : PLAIN_ZONE_COLOR.wind, 0.16)
      return entry
    }
    if (zone.kind === 'gust') {
      entry.art = this.createZoneArt(zone.rect, 'wind_gust', 0).setFlipX(zone.direction < 0).setVisible(false)
      return entry
    }
    entry.art = this.createZoneArt(zone.rect, 'wind_lift', 1).setAlpha(magnet ? MAGNET_FIELD_ALPHA : LIFT_ALPHA)
    if (magnet) {
      entry.art.setTint(MAGNET_FIELD_TINT)
      entry.plate = this.deps.scene.add
        .image(zone.rect.x + zone.rect.width / 2, 0, MECHANICS_V2_ATLAS.key, mechanicsV2Frame('magnet_lift', 0))
        .setOrigin(0.5, 0)
        .setDepth(SURFACE_DEPTH)
    }
    return entry
  }

  /** Every frame (paused too: the clock holds, so the art holds). `frame` is null while paused or with no hero. */
  update(frame: MechanicsFrame | null, clockMs: number): void {
    for (const wind of this.winds) {
      const cycle = windCycleAt(wind.zone, clockMs)
      // Timed gusts only: lifts and untimed zones blow all the time.
      const gustSfx = wind.zone.kind === 'gust' && wind.zone.timing ? windPhaseSfx(wind.phase, cycle.phase) : null
      wind.phase = cycle.phase
      wind.untilBlowMs = cycle.untilBlowMs
      const { rect } = wind.zone
      if (gustSfx) playMechanicSfx(this.deps.scene, { left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height }, gustSfx)
    }
    this.draw(clockMs)
    if (!frame || !this.active) return
    this.carryBodies(frame.stepMs)
    if (frame.dying) {
      this.applyEnvironment({ ...NEUTRAL_PLAYER_ENVIRONMENT }, null, null, [])
      return
    }
    const resolved = resolveHeroEnvironment({
      hero: frame.hero,
      grounded: frame.grounded,
      clockMs,
      conveyors: this.belts.map((belt) => belt.def),
      iceFloors: this.ice.map((entry) => entry.def),
      currents: this.currents.map((entry) => entry.def),
      winds: this.winds.map((entry) => entry.zone)
    })
    this.applyEnvironment(resolved.environment, resolved.beltId, resolved.iceId, resolved.zoneIds)
  }

  private applyEnvironment(environment: PlayerEnvironment, beltId: string | null, iceId: string | null, zoneIds: string[]): void {
    this.environment = environment
    this.beltId = beltId
    this.iceId = iceId
    this.zoneIds = zoneIds
    this.deps.runtime()?.setEnvironment?.(environment)
  }

  /** Enemies, pickups and any other grounded dynamic body on a belt move with it (the hero moves through its motor). */
  private carryBodies(stepMs: number): void {
    this.belts.forEach((belt) => { belt.carried = 0 })
    if (this.belts.length === 0 || stepMs <= 0) return
    const heroBody = this.deps.player()?.body
    const defs = this.belts.map((belt) => belt.def)
    for (const body of this.deps.scene.physics.world.bodies.entries) {
      if (body === heroBody || !body.enable || !(body.blocked.down || body.touching.down)) continue
      const object = body.gameObject as (Phaser.GameObjects.GameObject & { x: number }) | undefined
      if (!object?.active) continue
      const carry = conveyorCarryAt(defs, { left: body.left, right: body.right, top: body.top, bottom: body.bottom }, true)
      if (!carry.id || carry.speed === 0) continue
      object.x += conveyorCarryDeltaX(carry.speed, stepMs)
      const belt = this.belts.find((entry) => entry.def.id === carry.id)
      if (belt) belt.carried += 1
    }
  }

  private draw(clockMs: number): void {
    for (const belt of this.belts) if (belt.art) setMechanicsV2Frame(belt.art, 'conveyor', conveyorFrameIndex(belt.speed, clockMs))
    for (const entry of this.ice) if (entry.art) setMechanicsV2Frame(entry.art, 'ice_tile', iceTileFrameIndex(clockMs))
    for (const entry of this.currents) {
      if (!entry.art) continue
      setMechanicsV2Frame(entry.art, 'current', flowFrameIndex(clockMs))
      entry.art.tilePositionX = flowTileOffsetX(clockMs, FLOW_SCROLL_PX_PER_S.current, MECHANICS_V2_FRAME_SIZE.current.width)
    }
    for (const wind of this.winds) this.drawWind(wind, clockMs)
  }

  private drawWind(wind: WindEntry, clockMs: number): void {
    const { zone, phase } = wind
    if (wind.plain) {
      wind.plain.setVisible(phase !== 'calm').setAlpha(phase === 'blowing' ? 1 : 0.5)
      return
    }
    const art = wind.art
    if (!art) return
    if (zone.kind === 'gust') {
      const alpha = windArtAlpha(phase)
      art.setVisible(alpha > 0).setAlpha(alpha)
      setMechanicsV2Frame(art, 'wind_gust', flowFrameIndex(clockMs))
      art.tilePositionX = flowTileOffsetX(clockMs, FLOW_SCROLL_PX_PER_S.gust, MECHANICS_V2_FRAME_SIZE.wind_gust.width)
      return
    }
    // A lift (or magnet field) shows while blowing, faint while a timed one builds.
    art.setVisible(phase !== 'calm')
    setMechanicsV2Frame(art, 'wind_lift', windLiftFrameIndex(clockMs))
    art.tilePositionY = liftTileOffsetY(clockMs, FLOW_SCROLL_PX_PER_S.lift, MECHANICS_V2_FRAME_SIZE.wind_lift.height)
    if (wind.plate) {
      const index = magnetFrameIndex(phase === 'blowing', clockMs)
      setMechanicsV2Frame(wind.plate, 'magnet_lift', index)
      // The plate's last row sits on the zone's floor edge whatever row this frame drew it at.
      wind.plate.y = zone.rect.y + zone.rect.height - MAGNET_PLATE_HEIGHT - MAGNET_PLATE_TOP_ROW[index]
    }
  }

  getDebugState() {
    return {
      conveyors: this.belts.map((belt) => ({
        id: belt.def.id,
        speed: belt.speed,
        heroOn: this.beltId === belt.def.id,
        carried: belt.carried,
        frame: mechanicsFrameName(belt.art),
        flipX: Boolean(belt.art?.flipX)
      })),
      iceFloors: this.ice.map((entry) => ({ id: entry.def.id, heroOn: this.iceId === entry.def.id, frame: mechanicsFrameName(entry.art) })),
      currentZones: this.currents.map((entry) => ({
        id: entry.def.id,
        direction: entry.direction,
        heroInside: this.zoneIds.includes(entry.def.id),
        frame: mechanicsFrameName(entry.art),
        flipX: Boolean(entry.art?.flipX),
        tileX: entry.art ? Math.round(entry.art.tilePositionX) : null
      })),
      windZones: this.winds.map((wind) => ({
        id: wind.zone.id,
        kind: wind.zone.kind,
        style: wind.zone.style,
        direction: wind.zone.direction,
        phase: wind.phase,
        untilBlowMs: Math.round(wind.untilBlowMs),
        heroInside: this.zoneIds.includes(wind.zone.id),
        frame: mechanicsFrameName(wind.art),
        alpha: wind.art ? Number(wind.art.alpha.toFixed(2)) : null,
        plateFrame: mechanicsFrameName(wind.plate)
      })),
      heroEnvironment: { ...this.environment, beltId: this.beltId, iceId: this.iceId, zoneIds: [...this.zoneIds] }
    }
  }

  destroy(): void {
    this.belts.forEach((belt) => belt.art?.destroy())
    this.ice.forEach((entry) => entry.art?.destroy())
    this.currents.forEach((entry) => { entry.art?.destroy(); entry.plain?.destroy() })
    this.winds.forEach((wind) => { wind.art?.destroy(); wind.plate?.destroy(); wind.plain?.destroy() })
  }
}
