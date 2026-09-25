import Phaser from 'phaser'
import { GAME_HEIGHT } from '../../config/renderPolicy'
import { getCampaignStage } from '../../content/campaign'
import type { PlayerDamageRequest } from '../../player/types'
import { resolveStageHazardTexture, resolveStageVentFrame } from '../../ui/gameplay/GameplayTextures'
import {
  applyBreakableWallHit,
  breakableWallCrackStage,
  createBreakableWallState,
  isSaberReachingWall,
  shotReachesWall,
  wallBox,
  type BreakableWallDefinition,
  type BreakableWallState
} from '../breakableWall'
import {
  boxesOverlap,
  createCrumbleStates,
  crumbleBox,
  crumbleShakeOffset,
  crumbleTiming,
  isStandingOn,
  stepCrumble,
  type Box,
  type CrumbleState
} from '../crumbleGroup'
import { advanceStageClock, resolveHazard, ventCycleAt, type ResolvedHazard, type VentPhase } from '../hazards'
import {
  createRisingLiquidState,
  isInsideLiquid,
  resetRisingLiquid,
  stepRisingLiquid,
  type RisingLiquidDefinition,
  type RisingLiquidState
} from '../risingLiquid'
import { detectRoomLockVerbs, type RoomLockVerbSample } from '../roomLock'
import {
  CRUMBLE_SLAB,
  CRUMBLE_SLAB_TOP_ROW,
  MECHANICS_ATLAS,
  MECHANICS_FRAME_SIZE,
  SLAG_FILL_OFFSET_PX,
  SLAG_SURFACE_TOP_ROW,
  VENT_NOZZLE_ORIGIN_Y,
  breakableWallFrameIndex,
  crumbleFrameIndex,
  mechanicsFrame,
  slagFrameIndices,
  ventFlameFrameIndex,
  ventNozzleFrameIndex,
  wallTileLayout
} from '../mechanicsVisuals'
import { mechanicsArtReady, mechanicsFrameName, playMechanicHit, setMechanicsFrame } from './mechanicsArt'

export { stageMechanicPlatforms } from '../stageMechanics'

/** Scene data key `render_game_to_text` reads for `mechanics` (vents, hazards, liquids, crumbles, walls). */
export const STAGE_MECHANICS_DATA_KEY = 'stageMechanics'

type Visual = Phaser.GameObjects.GameObject & {
  x: number
  y: number
  alpha: number
  setAlpha(value: number): unknown
  setVisible(value: boolean): unknown
}

export type StageMechanicsDeps = {
  scene: Phaser.Scene
  stageId: string
  player: () => Phaser.Physics.Arcade.Sprite | undefined
  runtime: () => { getVerbSample(): RoomLockVerbSample | null; getFacing(): 1 | -1 } | undefined
  platforms: () => { findPlatformVisual(id: string): Phaser.GameObjects.GameObject | undefined } | undefined
  playerBullets: () => Phaser.Physics.Arcade.Group | undefined
  /** The death sequence runs (liquids hold); its end is the checkpoint respawn (liquids restart). */
  isDying: () => boolean
  damagePlayer: (request: PlayerDamageRequest) => unknown
}

type HazardEntry = { hazard: ResolvedHazard; body: Phaser.GameObjects.GameObject & { body: unknown } }
/** The flame body stays a Rectangle (the damage box); `jet` is the drawn flame when the mechanics atlas is loaded. */
type VentEntry = HazardEntry & { flame: Phaser.GameObjects.Rectangle; nozzle: Phaser.GameObjects.GameObject; jet?: Phaser.GameObjects.Image; phase: VentPhase; untilFireMs: number }
type SlagStrip = { surface: Phaser.GameObjects.TileSprite; fill: Phaser.GameObjects.TileSprite }
type LiquidEntry = { def: RisingLiquidDefinition; state: RisingLiquidState; fill: Phaser.GameObjects.Rectangle; surface: Phaser.GameObjects.Rectangle; art?: SlagStrip }
/** `art` replaces the platform's drawing (hidden, its body kept) and follows its shake, drop and fade. */
type CrumbleEntry = { state: CrumbleState; box: Box; timing: { shakeMs: number; respawnMs: number }; visual?: Visual; baseX: number; baseY: number; art?: Phaser.GameObjects.Image }
type WallEntry = { def: BreakableWallDefinition; state: BreakableWallState; box: Box; visual?: Visual; cracks: Phaser.GameObjects.Graphics; art?: Phaser.GameObjects.TileSprite }

const FLAME_COLOR = 0xff7a1c
const ARM_FLASH_COLOR = 0xffe08a
const NOZZLE_COLOR = 0x35130c
const SLAG_COLOR = 0xff5a1f
const SLAG_SURFACE_COLOR = 0xffe08a
const LETHAL_DAMAGE = 99
/** The backdrop's pit slag strip depth (StageBackdrop.ts): the art covers the same rectangle. */
const PIT_SLAG_DEPTH_PX = 10
/** The collapse frame shows this long before the broken wall fades. */
const WALL_COLLAPSE_HOLD_MS = 140

/** Frame name of a drawn mechanic for `render_game_to_text().mechanics`, null when hidden or not art. */
const frameName = mechanicsFrameName

function staticBodyOf(object: Phaser.GameObjects.GameObject): Phaser.Physics.Arcade.StaticBody | undefined {
  const body = (object as Phaser.Types.Physics.Arcade.GameObjectWithBody).body
  return body instanceof Phaser.Physics.Arcade.StaticBody ? body : undefined
}

function heroBox(player: Phaser.Physics.Arcade.Sprite): Box | null {
  const body = player.body as Phaser.Physics.Arcade.Body | undefined
  return body ? { left: body.left, right: body.right, top: body.top, bottom: body.bottom } : null
}

/**
 * Phaser edge of the stage mechanics library (06 §6.2; Heat Works first): timed vents on one stage
 * clock, rising liquid, crumble groups and breakable walls. Pure rules live in `src/mechanics/*.ts`;
 * this class draws the tells, toggles bodies and reads the hero once per frame (POST_UPDATE).
 */
export class StageMechanicsAdapter {
  private clockMs = 0
  private wasDying = false
  private prevHeroX: number | null = null
  private prevSample: RoomLockVerbSample | null = null
  private readonly hazards: HazardEntry[] = []
  private readonly vents: VentEntry[] = []
  private readonly liquids: LiquidEntry[] = []
  private readonly crumbles: CrumbleEntry[] = []
  private readonly walls: WallEntry[] = []
  /** Slag at the bottom of each floor gap (drawn over the backdrop's flat strip, same rectangle). */
  private readonly pitSlag: SlagStrip[] = []
  private readonly art: boolean

  constructor(private readonly deps: StageMechanicsDeps) {
    const { scene } = deps
    this.art = mechanicsArtReady(scene)
    const arena = getCampaignStage(deps.stageId).arena
    for (const def of arena.risingLiquids ?? []) this.liquids.push(this.createLiquid(def))
    if (this.art) {
      for (const gap of arena.floorGaps ?? []) this.pitSlag.push(this.createSlagStrip(gap.x, gap.width, GAME_HEIGHT - PIT_SLAG_DEPTH_PX, PIT_SLAG_DEPTH_PX, true))
    }
    for (const group of arena.crumbleGroups ?? []) {
      const timing = crumbleTiming(group)
      createCrumbleStates(group).forEach((state, index) => {
        const visual = deps.platforms()?.findPlatformVisual(state.id) as Visual | undefined
        const box = crumbleBox(group.platforms[index])
        this.crumbles.push({ state, box, timing, visual, baseX: visual?.x ?? 0, baseY: visual?.y ?? 0, art: this.createCrumbleArt(box, visual) })
      })
    }
    for (const def of arena.breakableWalls ?? []) {
      const visual = deps.platforms()?.findPlatformVisual(def.id) as Visual | undefined
      const cracks = scene.add.graphics().setDepth(2)
      const box = wallBox(def)
      this.walls.push({ def, state: createBreakableWallState(def), box, visual, cracks, art: this.createWallArt(box, visual) })
    }
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
    scene.data.set(STAGE_MECHANICS_DATA_KEY, this)
  }

  /** Called by `buildStageHazards`: every hazard gets its box and damage from its definition; vents join the clock. */
  addHazards(group: Phaser.Physics.Arcade.StaticGroup, definitions: ReturnType<typeof getCampaignStage>['arena']['hazards']): void {
    const { scene, stageId } = this.deps
    for (const hazard of definitions.map(resolveHazard)) {
      if (hazard.kind === 'vent') {
        this.vents.push(this.createVent(group, hazard))
        continue
      }
      const sprite = group.create(hazard.x, hazard.y, resolveStageHazardTexture(hazard.id, stageId, scene)) as Phaser.Physics.Arcade.Sprite
      this.tagHazard(sprite, hazard)
      sprite.refreshBody()
      // After the refresh: `refreshBody` resets a static body to the texture size (the old 28x10 never held).
      staticBodyOf(sprite)?.setSize(hazard.width, hazard.height, true)
      this.hazards.push({ hazard, body: sprite as HazardEntry['body'] })
    }
    this.syncVents(true)
  }

  getDebugState() {
    const box = (object: Phaser.GameObjects.GameObject) => {
      const body = staticBodyOf(object)
      return body ? { x: body.x, y: body.y, width: body.width, height: body.height } : null
    }
    return {
      clockMs: Math.round(this.clockMs),
      hazards: [...this.hazards, ...this.vents].map(({ hazard, body }) => ({
        id: hazard.id,
        kind: hazard.kind,
        damage: hazard.damage,
        box: box(body),
        live: Boolean(staticBodyOf(body)?.enable)
      })),
      vents: this.vents.map((vent) => ({
        id: vent.hazard.id,
        phase: vent.phase,
        untilFireMs: Math.round(vent.untilFireMs),
        live: Boolean(staticBodyOf(vent.flame)?.enable),
        nozzleFrame: frameName(vent.nozzle),
        flameFrame: frameName(vent.jet)
      })),
      risingLiquids: this.liquids.map(({ def, state, art }) => ({ ...state, surfaceY: Math.round(state.surfaceY), floorY: def.floorY, topY: def.topY, held: this.wasDying, surfaceFrame: frameName(art?.surface), surfaceArtTop: art?.surface.visible ? art.surface.y : null })),
      crumbles: this.crumbles.map(({ state, visual, art }) => ({ ...state, timerMs: Math.round(state.timerMs), bodyEnabled: Boolean(visual && staticBodyOf(visual)?.enable), frame: frameName(art) })),
      breakableWalls: this.walls.map(({ state, visual, art }) => ({ ...state, bodyEnabled: Boolean(visual && staticBodyOf(visual)?.enable), frame: frameName(art) })),
      pitSlag: { strips: this.pitSlag.length, surfaceFrame: frameName(this.pitSlag[0]?.surface) }
    }
  }

  private tagHazard(object: Phaser.GameObjects.GameObject, hazard: ResolvedHazard): void {
    object.setDataEnabled()
    object.data?.set('damageSourceType', 'hazard')
    object.data?.set('damageSourceId', hazard.id)
    object.data?.set('damageAmount', hazard.damage)
  }

  private createVent(group: Phaser.Physics.Arcade.StaticGroup, hazard: ResolvedHazard): VentEntry {
    const { scene, stageId } = this.deps
    const flame = scene.add.rectangle(hazard.x, hazard.y, hazard.width, hazard.height, FLAME_COLOR, 0).setDepth(3)
    scene.physics.add.existing(flame, true)
    group.add(flame)
    this.tagHazard(flame, hazard)
    if (this.art) {
      // The jet covers the damage box from the nozzle end, scaled to its height; the nozzle (added after) sits over its base.
      const up = hazard.direction === 'up'
      const edgeY = up ? hazard.y + hazard.height / 2 : hazard.y - hazard.height / 2
      const jet = scene.add
        .image(hazard.x, edgeY, MECHANICS_ATLAS.key, mechanicsFrame('vent_flame', 0))
        .setOrigin(0.5, up ? 1 : 0)
        .setScale(hazard.height / MECHANICS_FRAME_SIZE.vent_flame.height)
        .setFlipY(!up)
        .setDepth(3)
        .setVisible(false)
      const nozzle = scene.add
        .image(hazard.x, edgeY, MECHANICS_ATLAS.key, mechanicsFrame('vent_nozzle', 0))
        .setOrigin(0.5, up ? VENT_NOZZLE_ORIGIN_Y.up : VENT_NOZZLE_ORIGIN_Y.down)
        .setFlipY(!up)
        .setDepth(3)
      return { hazard, body: flame as HazardEntry['body'], flame, nozzle, jet, phase: 'idle', untilFireMs: 0 }
    }
    const baseY = hazard.direction === 'up' ? hazard.y + hazard.height / 2 - 4 : hazard.y - hazard.height / 2 + 4
    const frame = resolveStageVentFrame(stageId, scene)
    const nozzle: Phaser.GameObjects.GameObject = frame
      ? scene.add.image(hazard.x, baseY, frame.key, frame.frame).setDepth(3).setFlipY(hazard.direction === 'down')
      : scene.add.rectangle(hazard.x, baseY, hazard.width + 8, 8, NOZZLE_COLOR, 1).setDepth(3)
    return { hazard, body: flame as HazardEntry['body'], flame, nozzle, phase: 'idle', untilFireMs: 0 }
  }

  private createLiquid(def: RisingLiquidDefinition): LiquidEntry {
    const { scene } = this.deps
    const height = Math.max(GAME_HEIGHT, def.floorY) - def.topY + 32
    const fill = scene.add.rectangle(def.x, def.floorY, def.width, height, def.color ?? SLAG_COLOR, 0.82).setOrigin(0, 0).setDepth(3).setVisible(false)
    const surface = scene.add.rectangle(def.x, def.floorY, def.width, 2, SLAG_SURFACE_COLOR, 1).setOrigin(0, 0).setDepth(3).setVisible(false)
    const art = this.art ? this.createSlagStrip(def.x, def.width, def.floorY, height, false) : undefined
    if (art && typeof def.color === 'number') [art.surface, art.fill].forEach((strip) => strip.setTint(def.color as number))
    return { def, state: createRisingLiquidState(def), fill, surface, art }
  }

  /**
   * A slag surface strip whose liquid edge (frame row `SLAG_SURFACE_TOP_ROW`) sits on `liquidTop`, and
   * the fill tiled below it from just under that edge; both tile left-right and cycle their frames slowly.
   */
  private createSlagStrip(x: number, width: number, liquidTop: number, depthPx: number, visible: boolean): SlagStrip {
    const { scene } = this.deps
    const surfaceSize = MECHANICS_FRAME_SIZE.slag_surface
    const frames = slagFrameIndices(0)
    const fill = scene.add
      .tileSprite(x, liquidTop + SLAG_FILL_OFFSET_PX, width, Math.max(1, depthPx - SLAG_FILL_OFFSET_PX), MECHANICS_ATLAS.key, mechanicsFrame('slag_fill', frames.fill))
      .setOrigin(0, 0)
      .setDepth(3)
      .setVisible(visible)
    const surface = scene.add
      .tileSprite(x, liquidTop - SLAG_SURFACE_TOP_ROW, width, surfaceSize.height, MECHANICS_ATLAS.key, mechanicsFrame('slag_surface', frames.surface))
      .setOrigin(0, 0)
      .setDepth(3)
      .setVisible(visible)
    return { surface, fill }
  }

  private syncSlagFrames(strip: SlagStrip): void {
    const frames = slagFrameIndices(this.clockMs)
    setMechanicsFrame(strip.surface, 'slag_surface', frames.surface)
    setMechanicsFrame(strip.fill, 'slag_fill', frames.fill)
  }

  /** The crumble slab frame scaled to the platform's width, its slab top on the platform's top; hides the platform's drawing. */
  private createCrumbleArt(box: Box, visual: Visual | undefined): Phaser.GameObjects.Image | undefined {
    if (!this.art || !visual) return undefined
    visual.setVisible(false)
    const scale = (box.right - box.left) / CRUMBLE_SLAB.width
    return this.deps.scene.add
      .image(box.left - CRUMBLE_SLAB.left * scale, box.top - CRUMBLE_SLAB_TOP_ROW[0] * scale, MECHANICS_ATLAS.key, mechanicsFrame('crumble', 0))
      .setOrigin(0, 0)
      .setScale(scale)
      .setDepth(2)
  }

  /** The wall frame tiled to the wall's height (whole tiles) and at least `WALL_MIN_DRAW_WIDTH` wide; hides the platform's drawing. */
  private createWallArt(box: Box, visual: Visual | undefined): Phaser.GameObjects.TileSprite | undefined {
    if (!this.art || !visual) return undefined
    visual.setVisible(false)
    const width = box.right - box.left
    const height = box.bottom - box.top
    const layout = wallTileLayout(width, height)
    const art = this.deps.scene.add
      .tileSprite((box.left + box.right) / 2, box.top, layout.drawWidth / layout.tileScaleX, height / layout.tileScaleY, MECHANICS_ATLAS.key, mechanicsFrame('breakable_wall', 0))
      .setOrigin(0.5, 0)
      .setDepth(2)
    // Laid out at the frame's own size (whole tiles), then scaled to the drawn width and the wall's height.
    art.setScale(layout.tileScaleX, layout.tileScaleY)
    return art
  }

  private update(_time: number, delta: number): void {
    const { scene } = this.deps
    const paused = Boolean(scene.physics?.world?.isPaused)
    const before = this.clockMs
    this.clockMs = advanceStageClock(this.clockMs, delta, paused)
    // Every timer steps by the clock's advance (capped per frame), so crumbles and slag keep the vents' time.
    const stepMs = this.clockMs - before
    this.syncVents(false)
    this.pitSlag.forEach((strip) => this.syncSlagFrames(strip))
    if (paused) return
    const player = this.deps.player()
    const dying = this.deps.isDying()
    if (this.wasDying && !dying) this.onRespawn()
    this.wasDying = dying
    if (!player?.active) return
    const hero = heroBox(player)
    if (!hero) return
    const body = player.body as Phaser.Physics.Arcade.Body
    this.updateLiquids(player.x, hero, dying, stepMs)
    this.updateCrumbles(hero, Boolean(body.blocked.down || body.touching.down), stepMs)
    this.updateWalls(player, hero, delta)
  }

  private syncVents(force: boolean): void {
    for (const vent of this.vents) {
      const cycle = ventCycleAt(vent.hazard.timing!, this.clockMs)
      vent.untilFireMs = cycle.untilFireMs
      const body = staticBodyOf(vent.flame)
      if (body) body.enable = cycle.phase === 'firing'
      if (vent.jet && vent.nozzle instanceof Phaser.GameObjects.Image) {
        // Art: cold, arming dull/bright for the 300ms flash, firing; the jet flickers only while the body is live.
        setMechanicsFrame(vent.nozzle, 'vent_nozzle', ventNozzleFrameIndex(cycle.phase, this.clockMs))
        const flameIndex = ventFlameFrameIndex(cycle.phase, this.clockMs)
        vent.jet.setVisible(flameIndex !== null)
        if (flameIndex !== null) setMechanicsFrame(vent.jet, 'vent_flame', flameIndex)
        vent.flame.fillAlpha = 0
        if (force || cycle.phase !== vent.phase) vent.phase = cycle.phase
        continue
      }
      // Arming flash: the nozzle blinks and a low flame flickers for the 300ms before it fires.
      const blink = cycle.phase === 'arming' && Math.floor(this.clockMs / 60) % 2 === 0
      const nozzle = vent.nozzle
      if (nozzle instanceof Phaser.GameObjects.Image) {
        if (blink) nozzle.setTint(ARM_FLASH_COLOR)
        else nozzle.clearTint()
      } else if (nozzle instanceof Phaser.GameObjects.Rectangle) {
        nozzle.fillColor = blink ? ARM_FLASH_COLOR : NOZZLE_COLOR
      }
      vent.flame.fillAlpha = cycle.phase === 'firing' ? 0.9 : cycle.phase === 'arming' ? (blink ? 0.35 : 0.15) : 0
      if (force || cycle.phase !== vent.phase) vent.phase = cycle.phase
    }
  }

  private onRespawn(): void {
    for (const liquid of this.liquids) {
      liquid.state = resetRisingLiquid(liquid.def)
      this.drawLiquid(liquid)
    }
  }

  private updateLiquids(heroX: number, hero: Box, dying: boolean, delta: number): void {
    const prevHeroX = this.prevHeroX ?? heroX
    this.prevHeroX = heroX
    for (const liquid of this.liquids) {
      if (dying) continue
      liquid.state = stepRisingLiquid(liquid.def, liquid.state, { heroX, prevHeroX, deltaMs: delta })
      this.drawLiquid(liquid)
      if (liquid.state.phase !== 'dormant' && isInsideLiquid(liquid.def, liquid.state.surfaceY, hero)) {
        this.deps.damagePlayer({ amount: LETHAL_DAMAGE, tier: 'heavy', sourceType: 'hazard', sourceId: liquid.def.id, bypassIFrames: true })
      }
    }
  }

  private drawLiquid(liquid: LiquidEntry): void {
    const visible = liquid.state.phase !== 'dormant'
    const y = Math.round(liquid.state.surfaceY)
    if (liquid.art) {
      // The kill line is `surfaceY`: the strip's liquid edge row sits on it, the fill starts just under it.
      liquid.art.surface.setVisible(visible).setY(y - SLAG_SURFACE_TOP_ROW)
      liquid.art.fill.setVisible(visible).setY(y + SLAG_FILL_OFFSET_PX)
      this.syncSlagFrames(liquid.art)
      return
    }
    liquid.fill.setVisible(visible).setY(y)
    liquid.surface.setVisible(visible).setY(y)
  }

  private updateCrumbles(hero: Box, grounded: boolean, delta: number): void {
    for (const crumble of this.crumbles) {
      const before = crumble.state.phase
      crumble.state = stepCrumble(
        crumble.state,
        { heroStanding: isStandingOn(hero, crumble.box, grounded), heroOverlapping: boxesOverlap(hero, crumble.box), deltaMs: delta },
        crumble.timing
      )
      const visual = crumble.visual
      if (!visual) continue
      const body = staticBodyOf(visual)
      if (crumble.state.phase === 'shaking') visual.x = crumble.baseX + crumbleShakeOffset(crumble.state)
      if (before !== 'fallen' && crumble.state.phase === 'fallen') {
        if (body) body.enable = false
        visual.x = crumble.baseX
        this.deps.scene.tweens.add({ targets: visual, y: crumble.baseY + 24, alpha: 0, duration: 260, ease: 'Quad.in' })
      } else if (before === 'fallen' && crumble.state.phase === 'solid') {
        this.deps.scene.tweens.killTweensOf(visual)
        visual.x = crumble.baseX
        visual.y = crumble.baseY
        visual.setAlpha(1)
        if (body) body.enable = true
      }
      this.drawCrumble(crumble)
    }
  }

  /** The art follows the (hidden) platform drawing's shake, drop and fade; the frame follows the phase. */
  private drawCrumble(crumble: CrumbleEntry): void {
    const { art, visual } = crumble
    if (!art || !visual) return
    const index = crumbleFrameIndex(crumble.state, crumble.timing.shakeMs)
    setMechanicsFrame(art, 'crumble', index)
    const scale = art.scaleX
    art.x = crumble.box.left - CRUMBLE_SLAB.left * scale + (visual.x - crumble.baseX)
    art.y = crumble.box.top - CRUMBLE_SLAB_TOP_ROW[index] * scale + (visual.y - crumble.baseY)
    art.setAlpha(visual.alpha)
  }

  private updateWalls(player: Phaser.Physics.Arcade.Sprite, hero: Box, delta: number): void {
    if (this.walls.length === 0) return
    const runtime = this.deps.runtime()
    const sample = runtime?.getVerbSample() ?? null
    const cuts = sample ? detectRoomLockVerbs(this.prevSample, sample).filter((verb) => verb === 'saber').length : 0
    this.prevSample = sample
    const facing = runtime?.getFacing() ?? 1
    for (let cut = 0; cut < cuts; cut += 1) {
      for (const wall of this.walls) {
        if (wall.state.phase !== 'broken' && isSaberReachingWall({ x: player.x, top: hero.top, bottom: hero.bottom }, facing, wall.box)) {
          this.hitWall(wall, { kind: 'saber' }, facing > 0 ? wall.box.left : wall.box.right, player.y)
        }
      }
    }
    const bullets = this.deps.playerBullets()?.getChildren() ?? []
    for (const object of bullets) {
      const bullet = object as Phaser.Physics.Arcade.Sprite
      const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
      const chargeLevel = Number(bullet.data?.get?.('chargeLevel') ?? 0)
      if (!bullet.active || !body?.enable || chargeLevel < 1 || bullet.data?.get?.('breakableWallHit')) continue
      const shot = { left: body.left, right: body.right, top: body.top, bottom: body.bottom, velocityX: body.velocity.x }
      const wall = this.walls.find((entry) => entry.state.phase !== 'broken' && shotReachesWall(shot, entry.box, Math.max(delta, 17)))
      if (!wall) continue
      bullet.data?.set?.('breakableWallHit', wall.def.id)
      this.hitWall(wall, { kind: 'shot', chargeLevel }, body.velocity.x >= 0 ? wall.box.left : wall.box.right, bullet.y)
    }
  }

  /** A counted hit: the crack frame (or line) for the new stage, a spark where it landed and a hit SFX; a broken wall loses its body and fades. */
  private hitWall(wall: WallEntry, hit: { kind: 'saber' } | { kind: 'shot'; chargeLevel: number }, sparkX: number, sparkY: number): void {
    const next = applyBreakableWallHit(wall.def, wall.state, hit)
    if (next === wall.state) return
    wall.state = next
    this.drawCracks(wall)
    const { top, bottom } = wall.box
    playMechanicHit(this.deps.scene, sparkX, Math.min(Math.max(sparkY, top + 6), bottom - 6), hit.kind === 'saber' ? 'sword_hit' : 'enemy_hit')
    if (next.phase !== 'broken' || !wall.visual) return
    const body = staticBodyOf(wall.visual)
    if (body) body.enable = false
    const targets = wall.art ? [wall.visual, wall.art] : [wall.visual, wall.cracks]
    this.deps.scene.tweens.add({
      targets,
      alpha: 0,
      delay: wall.art ? WALL_COLLAPSE_HOLD_MS : 0,
      duration: 220,
      onComplete: () => { wall.visual?.setVisible(false); wall.art?.setVisible(false) }
    })
  }

  /** Crack stages: the wall frame by hits over hitsRequired (art), else one more jagged line per stage across the wall face. */
  private drawCracks(wall: WallEntry): void {
    if (wall.art) {
      setMechanicsFrame(wall.art, 'breakable_wall', breakableWallFrameIndex(wall.state))
      return
    }
    const stage = breakableWallCrackStage(wall.state)
    const { left, right, top, bottom } = wall.box
    wall.cracks.clear().lineStyle(1, 0x1a0f08, 0.9)
    for (let line = 0; line < stage; line += 1) {
      const y0 = top + ((bottom - top) * (line + 1)) / (stage + 1)
      wall.cracks.beginPath().moveTo(left + 1, y0)
      wall.cracks.lineTo((left + right) / 2, y0 - 5).lineTo(right - 1, y0 + 3).strokePath()
    }
  }

  private destroy(): void {
    const { scene } = this.deps
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    this.vents.forEach((vent) => { vent.nozzle.destroy(); vent.jet?.destroy() })
    const destroyStrip = (strip: SlagStrip | undefined) => { strip?.surface.destroy(); strip?.fill.destroy() }
    this.liquids.forEach((liquid) => { liquid.fill.destroy(); liquid.surface.destroy(); destroyStrip(liquid.art) })
    this.pitSlag.forEach(destroyStrip)
    this.crumbles.forEach((crumble) => crumble.art?.destroy())
    this.walls.forEach((wall) => { wall.cracks.destroy(); wall.art?.destroy() })
    scene.data?.remove(STAGE_MECHANICS_DATA_KEY)
  }
}

/** Stage build entry (after the platforms): always installs, so the stage clock exists for the vents. */
export function installStageMechanics(deps: StageMechanicsDeps): StageMechanicsAdapter {
  return new StageMechanicsAdapter(deps)
}

/** The stage's hazard group: spikes and vents sized and damaged from their definitions (vents on the stage clock). */
export function buildStageHazards(scene: Phaser.Scene, stageId: string): Phaser.Physics.Arcade.StaticGroup {
  const group = scene.physics.add.staticGroup()
  const adapter = scene.data.get(STAGE_MECHANICS_DATA_KEY) as StageMechanicsAdapter | undefined
  adapter?.addHazards(group, getCampaignStage(stageId).arena.hazards)
  return group
}
