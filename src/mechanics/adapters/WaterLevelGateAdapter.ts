import Phaser from 'phaser'
import type { Box } from '../crumbleGroup'
import type { ZonePush } from '../forceZone'
import { MECHANICS_V2_ATLAS } from '../mechanicsVisuals'
import { FLOW_SCROLL_PX_PER_S, MECHANICS_V2_FRAME_SIZE, flowFrameIndex, flowTileOffsetX, mechanicsV2Frame } from '../mechanicsV2Visuals'
import { isHeroUnderwater, waterBuoyancyOn, waterGateBox, waterLevelAt, type WaterLevelGateDefinition, type WaterLevelState } from '../waterLevelGate'
import { mechanicsFrameName, setMechanicsV2Frame } from './mechanicsArt'

export type WaterLevelGateDeps = {
  scene: Phaser.Scene
  player: () => Phaser.Physics.Arcade.Sprite | undefined
  /** `mechanics_v2` loaded: the surface band uses the `current` bubbles; without it the water is flat colour. */
  art: boolean
  /** Just under the hero, like the current zones. */
  depth: number
}

type WaterEntry = {
  def: WaterLevelGateDefinition
  state: WaterLevelState
  fill: Phaser.GameObjects.Rectangle
  band?: Phaser.GameObjects.TileSprite
  line: Phaser.GameObjects.Rectangle
  gate?: Phaser.GameObjects.Rectangle
  heroUnder: boolean
}

const WATER_COLOR = 0x2f86c8
const WATER_ALPHA = 0.42
const STILL_WATER_ALPHA = 0.92
const SURFACE_COLOR = 0xc8f2ff
const BAND_ALPHA = 0.7
const GATE_COLOR = 0x46677f
const GATE_EDGE = 0xa9dcf5
/** Still pools sit in the pits over the backdrop's slag strip (depth 3). */
const STILL_WATER_DEPTH = 3.2
const GATE_DEPTH = 4

/**
 * Phaser edge of `waterLevelGate.ts`: draws each water body (a translucent fill from the surface to the
 * basin floor, a bubbling band under the surface, a bright surface line), steps the level on the stage
 * clock, opens and closes each sluice (a static body the hero collides with), and hands the float under
 * the surface to the motor environment through `MotionMechanicsAdapter`, which owns it.
 */
export class WaterLevelGateAdapter {
  private readonly entries: WaterEntry[] = []
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = []

  constructor(
    private readonly deps: WaterLevelGateDeps,
    definitions: readonly WaterLevelGateDefinition[]
  ) {
    const { scene } = deps
    const player = deps.player()
    for (const def of definitions) {
      const still = !def.timing
      const depth = still ? STILL_WATER_DEPTH : deps.depth
      const fill = scene.add
        .rectangle(def.x, def.highY, def.width, Math.max(1, def.bottomY - def.highY), WATER_COLOR, still ? STILL_WATER_ALPHA : WATER_ALPHA)
        .setOrigin(0, 0)
        .setDepth(depth)
      const band = deps.art
        ? scene.add
            .tileSprite(def.x + def.width / 2, def.highY, def.width, MECHANICS_V2_FRAME_SIZE.current.height, MECHANICS_V2_ATLAS.key, mechanicsV2Frame('current', 0))
            .setOrigin(0.5, 0)
            .setAlpha(BAND_ALPHA)
            .setDepth(depth)
        : undefined
      const line = scene.add.rectangle(def.x, def.highY, def.width, 2, SURFACE_COLOR, 0.9).setOrigin(0, 0).setDepth(depth)
      const box = waterGateBox(def)
      let gate: Phaser.GameObjects.Rectangle | undefined
      if (box) {
        gate = scene.add
          .rectangle((box.left + box.right) / 2, (box.top + box.bottom) / 2, box.right - box.left, box.bottom - box.top, GATE_COLOR, 1)
          .setStrokeStyle(1, GATE_EDGE, 0.9)
          .setDepth(GATE_DEPTH)
        scene.physics.add.existing(gate, true)
        ;(gate.body as Phaser.Physics.Arcade.StaticBody | undefined)?.updateFromGameObject()
        if (player) this.colliders.push(scene.physics.add.collider(player, gate))
      }
      const entry: WaterEntry = { def, state: waterLevelAt(def, 0), fill, band, line, gate, heroUnder: false }
      this.entries.push(entry)
      this.draw(entry, 0)
    }
  }

  get count(): number {
    return this.entries.length
  }

  /** Every frame the world runs (the level follows the stage clock, so it holds while paused). */
  update(clockMs: number): void {
    for (const entry of this.entries) {
      entry.state = waterLevelAt(entry.def, clockMs)
      this.draw(entry, clockMs)
    }
  }

  /** The float on the hero this frame (one push per water it is under). */
  pushesOn(hero: Box | null): ZonePush[] {
    const pushes: ZonePush[] = []
    for (const entry of this.entries) {
      entry.heroUnder = hero ? isHeroUnderwater(entry.def, entry.state.surfaceY, hero) : false
      const push = hero ? waterBuoyancyOn(entry.def, entry.state.surfaceY, hero) : null
      if (push) pushes.push(push)
    }
    return pushes
  }

  private draw(entry: WaterEntry, clockMs: number): void {
    const { def, state } = entry
    const surface = Math.round(state.surfaceY)
    const depth = def.bottomY - surface
    const wet = depth > 0
    entry.fill.setVisible(wet)
    if (wet) {
      entry.fill.setY(surface)
      entry.fill.setSize(def.width, depth)
    }
    entry.line.setVisible(wet).setY(surface - 1)
    if (entry.band) {
      entry.band.setVisible(wet && depth >= entry.band.height / 2).setY(surface)
      setMechanicsV2Frame(entry.band, 'current', flowFrameIndex(clockMs))
      entry.band.tilePositionX = flowTileOffsetX(clockMs, FLOW_SCROLL_PX_PER_S.current / 3, MECHANICS_V2_FRAME_SIZE.current.width)
    }
    if (entry.gate) {
      const body = entry.gate.body as Phaser.Physics.Arcade.StaticBody | undefined
      if (body) body.enable = !state.gateOpen
      // Open, the sluice is raised out of the passage: only its lintel stays drawn.
      entry.gate.setAlpha(state.gateOpen ? 0.18 : 1)
    }
  }

  getDebugState() {
    return {
      waterLevelGates: this.entries.map(({ def, state, gate, band, heroUnder }) => ({
        id: def.id,
        phase: state.phase,
        surfaceY: Math.round(state.surfaceY),
        untilChangeMs: Math.round(state.untilChangeMs),
        highY: def.highY,
        lowY: def.lowY,
        gateOpen: state.gateOpen,
        gateClosed: Boolean((gate?.body as Phaser.Physics.Arcade.StaticBody | undefined)?.enable),
        gateX: def.gate?.x ?? null,
        heroUnder,
        bandFrame: mechanicsFrameName(band)
      }))
    }
  }

  destroy(): void {
    this.colliders.forEach((collider) => collider.destroy())
    this.entries.forEach((entry) => {
      entry.fill.destroy()
      entry.band?.destroy()
      entry.line.destroy()
      entry.gate?.destroy()
    })
  }
}
