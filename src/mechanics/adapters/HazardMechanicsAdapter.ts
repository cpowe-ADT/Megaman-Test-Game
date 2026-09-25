import Phaser from 'phaser'
import type { StageArenaDefinition } from '../../content/campaign'
import type { PlayerDamageRequest } from '../../player/types'
import type { Box } from '../crumbleGroup'
import {
  ICICLE_DEFAULT_DAMAGE,
  ICICLE_HALF_WIDTH,
  ICICLE_LENGTH,
  createIcicleState,
  icicleShakeOffset,
  resetIcicle,
  stepIcicle,
  type IcicleDefinition,
  type IcicleState
} from '../icicle'
import { MECHANICS_V2_ATLAS } from '../mechanicsVisuals'
import {
  ICICLE_SHARDS_MS,
  ICICLE_SPIKE_TOP_ROW,
  MECHANICS_V2_FRAME_SIZE,
  RAIL_FOOT_ROW,
  ROCKFALL_BOULDER_CENTRE_ROW,
  ROCKFALL_RUBBLE_FOOT_ROW,
  icicleFrameIndex,
  mechanicsV2Frame,
  railFrame,
  rockfallFrameIndex
} from '../mechanicsV2Visuals'
import {
  ROCKFALL_DEFAULT_DAMAGE,
  ROCKFALL_DEFAULT_SIZE,
  ROCKFALL_RUBBLE_MS,
  createRockfallState,
  resetRockfall,
  stepRockfall,
  type RockfallDefinition,
  type RockfallState
} from '../rockfall'
import { railCycleAt, resolveRailGroup, type RailPhase, type ResolvedRail, type ResolvedRailGroup } from '../timedRailGroup'
import { mechanicsFrameName, mechanicsV2ArtReady, playMechanicHit, setMechanicsV2Frame, type MechanicsFrame } from './mechanicsArt'

export type HazardMechanicsDeps = {
  scene: Phaser.Scene
  damagePlayer: (request: PlayerDamageRequest) => unknown
}

type RailEntry = { rail: ResolvedRail; body?: Phaser.GameObjects.Rectangle; art?: Phaser.GameObjects.Image; plain?: Phaser.GameObjects.Rectangle }
type RailGroupEntry = { group: ResolvedRailGroup; phase: RailPhase; untilArcMs: number; rails: RailEntry[] }
type RockEntry = { def: RockfallDefinition; state: RockfallState; art?: Phaser.GameObjects.Image; plain?: Phaser.GameObjects.Rectangle; shadow: Phaser.GameObjects.Ellipse }
type IcicleEntry = { def: IcicleDefinition; state: IcicleState; mount?: Phaser.GameObjects.Image; spike: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; shards?: Phaser.GameObjects.Image }

const HAZARD_DEPTH = 3
const RAIL_PLAIN_COLOR = { off: 0x5a6070, arming: 0xfff0a0, arcing: 0x9fe6ff } as const
const ROCK_PLAIN_COLOR = 0x8a7a66
const ICICLE_PLAIN_COLOR = 0xbfe8ff
const SHADOW_ALPHA = 0.35

function staticBodyOf(object: Phaser.GameObjects.GameObject | undefined): Phaser.Physics.Arcade.StaticBody | undefined {
  const body = (object as Phaser.Types.Physics.Arcade.GameObjectWithBody | undefined)?.body
  return body instanceof Phaser.Physics.Arcade.StaticBody ? body : undefined
}

function heroDirection(hero: Box, x: number): -1 | 1 {
  return (hero.left + hero.right) / 2 < x ? -1 : 1
}

/**
 * Phaser edge of the 12b damage mechanics: `timed_rail_group` (arc boxes in the stage hazard group, live
 * only while arcing, like vents), `rockfall` (dust puff, floor shadow, tumbling boulder, rubble) and
 * `icicle` (mount, shaking spike, fall, shards). Boulders and icicles hurt through the damage path on
 * contact; both reset on the checkpoint respawn. Installed by `StageMechanicsAdapter`, which owns the clock.
 */
export class HazardMechanicsAdapter {
  private readonly railGroups: RailGroupEntry[] = []
  private readonly rocks: RockEntry[] = []
  private readonly icicles: IcicleEntry[] = []
  private readonly art: boolean

  constructor(
    private readonly deps: HazardMechanicsDeps,
    arena: Pick<StageArenaDefinition, 'timedRailGroups' | 'rockfalls' | 'icicles'>
  ) {
    const { scene } = deps
    this.art = mechanicsV2ArtReady(scene)
    for (const def of arena.timedRailGroups ?? []) {
      const group = resolveRailGroup(def)
      this.railGroups.push({ group, phase: 'off', untilArcMs: 0, rails: group.rails.map((rail) => this.createRailArt(rail)) })
    }
    for (const def of arena.rockfalls ?? []) {
      const size = def.size ?? ROCKFALL_DEFAULT_SIZE
      const shadow = scene.add.ellipse(def.x, def.floorY + size / 2, size, 5, 0x000000, SHADOW_ALPHA).setDepth(HAZARD_DEPTH).setVisible(false)
      const entry: RockEntry = { def, state: createRockfallState(def), shadow }
      if (this.art) entry.art = scene.add.image(def.x, def.topY, MECHANICS_V2_ATLAS.key, mechanicsV2Frame('rockfall', 0)).setDepth(HAZARD_DEPTH).setVisible(false)
      else entry.plain = scene.add.rectangle(def.x, def.topY, size, size, ROCK_PLAIN_COLOR, 1).setDepth(HAZARD_DEPTH).setVisible(false)
      this.rocks.push(entry)
    }
    for (const def of arena.icicles ?? []) this.icicles.push(this.createIcicle(def))
  }

  private createRailArt(rail: ResolvedRail): RailEntry {
    const { scene } = this.deps
    if (!this.art) return { rail, plain: scene.add.rectangle(rail.x, rail.floorY - 7, rail.width, 3, RAIL_PLAIN_COLOR.off, 1).setDepth(HAZARD_DEPTH) }
    const size = MECHANICS_V2_FRAME_SIZE.power_rail
    const art = scene.add
      .image(rail.x, rail.floorY, MECHANICS_V2_ATLAS.key, mechanicsV2Frame('power_rail', 0))
      .setOrigin(0.5, (RAIL_FOOT_ROW[0] + 1) / size.height)
      .setDepth(HAZARD_DEPTH)
    art.setScale(rail.width / size.width, 1)
    return { rail, art }
  }

  /** The mount (frame rows above the ceiling line) stays; the spike below it shakes and falls; the shards show on the floor. */
  private createIcicle(def: IcicleDefinition): IcicleEntry {
    const { scene } = this.deps
    const state = createIcicleState(def)
    if (!this.art) {
      const spike = scene.add.rectangle(def.x, def.y, ICICLE_HALF_WIDTH * 2, ICICLE_LENGTH, ICICLE_PLAIN_COLOR, 1).setOrigin(0.5, 0).setDepth(HAZARD_DEPTH)
      return { def, state, spike }
    }
    const size = MECHANICS_V2_FRAME_SIZE.icicle
    const frame = mechanicsV2Frame('icicle', 0)
    const top = def.y - ICICLE_SPIKE_TOP_ROW
    const mount = scene.add.image(def.x, top, MECHANICS_V2_ATLAS.key, frame).setOrigin(0.5, 0).setDepth(HAZARD_DEPTH)
    mount.setCrop(0, 0, size.width, ICICLE_SPIKE_TOP_ROW)
    const spike = scene.add.image(def.x, top, MECHANICS_V2_ATLAS.key, frame).setOrigin(0.5, 0).setDepth(HAZARD_DEPTH)
    spike.setCrop(0, ICICLE_SPIKE_TOP_ROW, size.width, size.height - ICICLE_SPIKE_TOP_ROW)
    const shards = scene.add
      .image(def.x, def.floorY, MECHANICS_V2_ATLAS.key, mechanicsV2Frame('icicle', 1))
      .setOrigin(0.5, (size.height - 1) / size.height)
      .setDepth(HAZARD_DEPTH)
      .setVisible(false)
    shards.setCrop(0, ICICLE_SPIKE_TOP_ROW - 1, size.width, size.height - ICICLE_SPIKE_TOP_ROW + 1)
    return { def, state, mount, spike, shards }
  }

  /** Called from `addHazards`: each rail's arc box joins the stage hazard group (Game's overlap hurts), tagged like a vent. */
  addToHazardGroup(group: Phaser.Physics.Arcade.StaticGroup): void {
    const { scene } = this.deps
    for (const entry of this.railGroups) {
      for (const railEntry of entry.rails) {
        const { rail } = railEntry
        const body = scene.add.rectangle(rail.x, rail.y, rail.width, rail.height, 0x9fe6ff, 0).setDepth(HAZARD_DEPTH)
        scene.physics.add.existing(body, true)
        group.add(body)
        body.setDataEnabled()
        body.data?.set('damageSourceType', 'hazard')
        body.data?.set('damageSourceId', rail.id)
        body.data?.set('damageAmount', entry.group.damage)
        railEntry.body = body
      }
    }
  }

  /** Every frame (paused too, so the rails hold their phase); `frame` is null while paused or with no hero. */
  update(frame: MechanicsFrame | null, clockMs: number): void {
    this.syncRails(clockMs)
    if (frame && !frame.dying) {
      for (const rock of this.rocks) this.stepRock(rock, frame)
      for (const icicle of this.icicles) this.stepIcicleEntry(icicle, frame)
    }
    this.rocks.forEach((rock) => this.drawRock(rock, clockMs))
    this.icicles.forEach((icicle) => this.drawIcicle(icicle))
  }

  private syncRails(clockMs: number): void {
    for (const entry of this.railGroups) {
      const cycle = railCycleAt(entry.group.timing, clockMs)
      entry.phase = cycle.phase
      entry.untilArcMs = cycle.untilArcMs
      const look = railFrame(cycle.phase, clockMs)
      for (const railEntry of entry.rails) {
        const body = staticBodyOf(railEntry.body)
        if (body) body.enable = cycle.phase === 'arcing'
        if (railEntry.art) {
          setMechanicsV2Frame(railEntry.art, 'power_rail', look.index)
          railEntry.art.setFlipX(look.flipX).setOrigin(0.5, (RAIL_FOOT_ROW[look.index] + 1) / MECHANICS_V2_FRAME_SIZE.power_rail.height)
        } else if (railEntry.plain) {
          railEntry.plain.fillColor = RAIL_PLAIN_COLOR[cycle.phase === 'off' ? 'off' : cycle.phase]
        }
      }
    }
  }

  private stepRock(rock: RockEntry, frame: MechanicsFrame): void {
    const result = stepRockfall(rock.def, rock.state, { heroX: frame.heroX, prevHeroX: frame.prevHeroX, hero: frame.hero, deltaMs: frame.stepMs })
    const broke = rock.state.phase === 'falling' && result.state.phase === 'rubble'
    rock.state = result.state
    if (result.hit) {
      const amount = Math.max(1, Math.round(rock.def.damage ?? ROCKFALL_DEFAULT_DAMAGE))
      this.deps.damagePlayer({ amount, tier: amount >= 2 ? 'heavy' : 'light', sourceType: 'hazard', sourceId: rock.def.id, direction: heroDirection(frame.hero, rock.def.x) })
    }
    if (broke) playMechanicHit(this.deps.scene, rock.def.x, rock.state.y, 'enemy_hit')
  }

  private stepIcicleEntry(icicle: IcicleEntry, frame: MechanicsFrame): void {
    const result = stepIcicle(icicle.def, icicle.state, { hero: frame.hero, deltaMs: frame.stepMs })
    const shattered = icicle.state.phase === 'falling' && result.state.phase === 'shattered'
    icicle.state = result.state
    if (result.hit) {
      const amount = Math.max(1, Math.round(icicle.def.damage ?? ICICLE_DEFAULT_DAMAGE))
      this.deps.damagePlayer({ amount, tier: amount >= 2 ? 'heavy' : 'light', sourceType: 'hazard', sourceId: icicle.def.id, direction: heroDirection(frame.hero, icicle.def.x) })
    }
    if (shattered) playMechanicHit(this.deps.scene, icicle.def.x, icicle.def.y + icicle.state.dropY + ICICLE_LENGTH, 'enemy_hit')
  }

  private drawRock(rock: RockEntry, clockMs: number): void {
    const { def, state } = rock
    const size = def.size ?? ROCKFALL_DEFAULT_SIZE
    const floorLine = def.floorY + size / 2
    // The floor shadow grows as the drop nears: the tell of where it lands.
    const shadowShown = state.phase === 'warning' || state.phase === 'falling'
    const progress = state.phase === 'falling' ? Math.min(1, Math.max(0, (state.y - def.topY) / Math.max(1, def.floorY - def.topY))) : 0
    rock.shadow.setVisible(shadowShown).setScale(0.5 + 0.5 * progress, 1)
    const fade = state.phase === 'rubble' ? Math.min(1, Math.max(0, 1.6 - (1.6 * state.timerMs) / ROCKFALL_RUBBLE_MS)) : 1
    if (rock.plain) {
      rock.plain.setVisible(state.phase === 'falling' || state.phase === 'rubble').setPosition(def.x, state.y).setAlpha(fade)
      return
    }
    const art = rock.art
    if (!art) return
    const index = rockfallFrameIndex(state.phase, clockMs)
    art.setVisible(index !== null).setAlpha(fade)
    if (index === null) return
    setMechanicsV2Frame(art, 'rockfall', index)
    const height = MECHANICS_V2_FRAME_SIZE.rockfall.height
    if (index === 0) art.setOrigin(0.5, 0).setPosition(def.x, def.topY - size / 2)
    else if (index === 3) art.setOrigin(0.5, (ROCKFALL_RUBBLE_FOOT_ROW + 1) / height).setPosition(def.x, Math.min(floorLine, state.y + size / 2))
    else art.setOrigin(0.5, ROCKFALL_BOULDER_CENTRE_ROW / height).setPosition(def.x, state.y)
  }

  private drawIcicle(icicle: IcicleEntry): void {
    const { def, state, spike, shards } = icicle
    const falling = state.phase !== 'shattered'
    spike.setVisible(falling)
    const baseY = spike instanceof Phaser.GameObjects.Image ? def.y - ICICLE_SPIKE_TOP_ROW : def.y
    spike.setPosition(def.x + icicleShakeOffset(state), baseY + state.dropY)
    if (!shards) return
    const shown = state.phase === 'shattered' && state.timerMs < ICICLE_SHARDS_MS
    shards.setVisible(shown).setAlpha(shown ? 1 - state.timerMs / ICICLE_SHARDS_MS : 0)
    if (shown) shards.setY(def.y + state.dropY + ICICLE_LENGTH)
  }

  /** The checkpoint respawn: boulders wait again and icicles hang again. */
  onRespawn(): void {
    this.rocks.forEach((rock) => { rock.state = resetRockfall(rock.def, rock.state) })
    this.icicles.forEach((icicle) => { icicle.state = resetIcicle(icicle.def, icicle.state) })
  }

  getDebugState() {
    return {
      railGroups: this.railGroups.map((entry) => ({
        id: entry.group.id,
        phase: entry.phase,
        untilArcMs: Math.round(entry.untilArcMs),
        damage: entry.group.damage,
        rails: entry.rails.map(({ rail, body, art }) => {
          const staticBody = staticBodyOf(body)
          return {
            id: rail.id,
            live: Boolean(staticBody?.enable),
            box: staticBody ? { x: staticBody.x, y: staticBody.y, width: staticBody.width, height: staticBody.height } : null,
            frame: mechanicsFrameName(art),
            flipX: Boolean(art?.flipX)
          }
        })
      })),
      rockfalls: this.rocks.map(({ state, art, shadow }) => ({
        ...state,
        y: Math.round(state.y),
        timerMs: Math.round(state.timerMs),
        velocityY: Math.round(state.velocityY),
        frame: mechanicsFrameName(art),
        shadow: shadow.visible
      })),
      icicles: this.icicles.map(({ def, state, spike, shards }) => ({
        ...state,
        dropY: Math.round(state.dropY),
        timerMs: Math.round(state.timerMs),
        velocityY: Math.round(state.velocityY),
        tipY: Math.round(def.y + state.dropY + ICICLE_LENGTH),
        frame: state.phase === 'shattered' ? mechanicsFrameName(shards) : mechanicsFrameName(spike),
        frameIndex: icicleFrameIndex(state.phase)
      }))
    }
  }

  destroy(): void {
    this.railGroups.forEach((entry) => entry.rails.forEach((rail) => { rail.art?.destroy(); rail.plain?.destroy() }))
    this.rocks.forEach((rock) => { rock.art?.destroy(); rock.plain?.destroy(); rock.shadow.destroy() })
    this.icicles.forEach((icicle) => { icicle.mount?.destroy(); icicle.spike.destroy(); icicle.shards?.destroy() })
  }
}
