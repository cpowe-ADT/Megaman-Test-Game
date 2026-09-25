import Phaser from 'phaser'
import { GAME_HEIGHT } from '../../config/renderPolicy'
import { getCampaignStage } from '../../content/campaign'
import { Settings } from '../../systems/Settings'
import {
  applyRoomLockDefeats,
  applyRoomLockInput,
  armRoomLock,
  createRoomLockState,
  detectRoomLockVerbs,
  findRoomIndex,
  isDefeatLock,
  isSaberInReach,
  resolveCameraRoomIndex,
  resolveWorldCeiling,
  roomLockKeyHint,
  verticalSegmentRoom,
  type RoomLockDefinition,
  type RoomLockInput,
  type RoomLockState,
  type RoomLockVerbSample,
  type RoomRect,
  type VerticalSegmentDefinition
} from '../roomLock'
import { GAMEPLAY_VIEWPORT_TOP } from '../../config/gameplayLayout'
import { MAIN_GROUND_HEIGHT } from '../../stage/stageGeometry'
import {
  MECHANICS_ATLAS,
  MECHANICS_FRAME_SIZE,
  SCRAP_GATE_TILE_SCALE,
  bottomAlignedTileOffset,
  energyGateFrameIndex,
  gateSignPosition,
  gateSignText,
  isGateSignShown,
  mechanicsFrame,
  scrapGateFrameIndex
} from '../mechanicsVisuals'
import { mechanicsArtReady, mechanicsFrameName, playMechanicHit, playMechanicSfx, setMechanicsFrame } from './mechanicsArt'
import { roomLockPhaseSfx } from '../../audio/mechanicsSfx'

/** A verb gate's world-space sign: key and verb from the live bindings (`C  SLASH`), shown near the closed gate. */
type GateSign = { container: Phaser.GameObjects.Container; panel: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text }
const SIGN_PAD_X = 4
const SIGN_HEIGHT = 12

/** The player runtime surface the adapter reads: the typed verb sample and facing. */
export type RoomLockRuntime = {
  getVerbSample(): RoomLockVerbSample | null
  getFacing(): 1 | -1
}

export type RoomLockAdapterDeps = {
  scene: Phaser.Scene
  stageId: string
  player: () => Phaser.Physics.Arcade.Sprite | undefined
  runtime: () => RoomLockRuntime | undefined
  /** A lock armed: the story director plays Rook's recorded prompt and the lane shows the key hint. */
  /** The lock's position in the stage's `roomLocks` (the coach line with the same position plays). */
  onArmed: (lockIndex: number, keyHint: string) => void
  /** A defeat lock closed (the mid-boss room): the story director plays the stage's `miniboss_callout` on the radio lane. */
  onDefeatLockArmed?: (lockId: string) => void
  /** Level markers gone for good this run (`EnemySpawner.getClearedMarkerIds`); a defeat lock opens when all of its are. */
  clearedMarkers?: () => ReadonlySet<string> | readonly string[]
  /** Hands the camera back to the host: the boss-room lock when it is on, else the stage bounds. */
  restoreCamera: () => void
}

/** Scene data key `render_game_to_text` reads for `mechanics.roomLocks`. */
export const ROOM_LOCK_DATA_KEY = 'roomLocks'
const GATE_WIDTH = 12
const ENERGY_GATE_COLOR = 0x7ec8ff
const SCRAP_WALL_COLOR = 0x6b5a48
const FIGHT_GATE_COLOR = 0xffb347
/** `cameraRoom` while the stage bounds keep the shaft's raised top (the hero left the shaft high). */
const RAISED_STAGE_CAMERA = -2

/**
 * Phaser edge of `room_lock` (prompt 05 §5.7): closes a gate body at each room's exit, arms a lock
 * when the player enters its room, reads the runtime's verbs each frame while a lock is armed, holds
 * the camera to the room (and lifts the world ceiling inside the tall shaft), and opens the gate.
 */
export class RoomLockAdapter {
  private states: RoomLockState[]
  private readonly gates: Phaser.GameObjects.Rectangle[] = []
  /** Drawn gates (mechanics_v1): `energy_gate` for verb and fight locks, `scrap_gate` for the saber lock; the Rectangle keeps the body. */
  private readonly gateArt: (Phaser.GameObjects.TileSprite | undefined)[] = []
  private readonly signs: (GateSign | undefined)[] = []
  private clockMs = 0
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = []
  private readonly defaultWorld: RoomRect
  private prevSample: RoomLockVerbSample | null = null
  private cameraRoom = -1
  /** Locks first (their indexes are the coach-line positions), then the gateless vertical segments, always open. */
  private readonly rooms: { room: RoomRect }[]
  private readonly segmentPhases: { phase: 'open' }[]

  constructor(
    private readonly deps: RoomLockAdapterDeps,
    private readonly locks: readonly RoomLockDefinition[],
    private readonly segments: readonly VerticalSegmentDefinition[] = []
  ) {
    const { scene } = deps
    this.states = locks.map(createRoomLockState)
    this.rooms = [...locks, ...segments.map((segment) => ({ room: verticalSegmentRoom(segment, GAME_HEIGHT) }))]
    this.segmentPhases = segments.map(() => ({ phase: 'open' as const }))
    const bounds = scene.physics.world.bounds
    this.defaultWorld = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    const player = deps.player()
    for (const lock of locks) {
      const top = Math.min(0, lock.room.y)
      const height = GAME_HEIGHT - top
      const saber = lock.requiredInput === 'saber'
      const color = saber ? SCRAP_WALL_COLOR : isDefeatLock(lock) ? FIGHT_GATE_COLOR : ENERGY_GATE_COLOR
      const gate = scene.add
        .rectangle(lock.gateX, top + height / 2, GATE_WIDTH, height, color, saber ? 1 : 0.55)
        .setDepth(4)
      scene.physics.add.existing(gate, true)
      ;(gate.body as Phaser.Physics.Arcade.StaticBody | undefined)?.updateFromGameObject()
      if (player) this.colliders.push(scene.physics.add.collider(player, gate))
      this.gates.push(gate)
      const art = mechanicsArtReady(scene) ? this.createGateArt(lock, top) : undefined
      if (art) gate.setVisible(false)
      this.gateArt.push(art)
      this.signs.push(lock.requiredInput ? this.createSign() : undefined)
    }
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
    scene.data.set(ROOM_LOCK_DATA_KEY, this)
  }

  getDebugState(): Array<
    RoomLockState & { gateX: number; gateClosed: boolean; cameraHeld: boolean; room: RoomRect; gateFrame: string | null; sign: { visible: boolean; text: string; x: number; y: number; width: number; height: number } | null }
  > {
    return this.states.map((state, index) => {
      const art = this.gateArt[index]
      const sign = this.signs[index]
      return {
        ...state,
        gateX: this.locks[index].gateX,
        gateClosed: Boolean((this.gates[index]?.body as Phaser.Physics.Arcade.StaticBody | undefined)?.enable),
        cameraHeld: this.cameraRoom === index,
        room: { ...this.locks[index].room },
        gateFrame: mechanicsFrameName(art),
        sign: sign ? { visible: sign.container.visible, text: sign.label.text, x: sign.container.x, y: sign.container.y, width: sign.panel.width, height: sign.panel.height } : null
      }
    })
  }

  /**
   * The gate column from the room's top to the floor, tiles ending whole on the floor: the energy
   * field at 1:1 (tinted amber for a fight gate), the scrap plates at `SCRAP_GATE_TILE_SCALE`.
   */
  private createGateArt(lock: RoomLockDefinition, top: number): Phaser.GameObjects.TileSprite {
    const saber = lock.requiredInput === 'saber'
    const group = saber ? 'scrap_gate' : 'energy_gate'
    const scale = saber ? SCRAP_GATE_TILE_SCALE : 1
    const size = MECHANICS_FRAME_SIZE[group]
    const height = (GAME_HEIGHT - MAIN_GROUND_HEIGHT - top) / scale
    const art = this.deps.scene.add
      .tileSprite(lock.gateX, top, size.width, height, MECHANICS_ATLAS.key, mechanicsFrame(group, 0))
      .setOrigin(0.5, 0)
      .setScale(scale)
      .setDepth(4)
    art.tilePositionY = bottomAlignedTileOffset(height, size.height)
    if (isDefeatLock(lock)) art.setTint(FIGHT_GATE_COLOR)
    return art
  }

  private createSign(): GateSign {
    const { scene } = this.deps
    const label = scene.cache.bitmapFont.exists('font')
      ? scene.add.bitmapText(0, 0, 'font', '', 8).setOrigin(0.5, 0.5).setTint(0xfff1b0)
      : scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff1b0', fontStyle: 'bold' }).setOrigin(0.5, 0.5)
    const panel = scene.add.rectangle(0, 0, 8, SIGN_HEIGHT, 0x0b1624, 0.88).setStrokeStyle(1, 0x7de8ff, 0.9)
    const container = scene.add.container(0, 0, [panel, label]).setDepth(5).setVisible(false)
    return { container, panel, label }
  }

  /** Signs and gate frames, every frame the world runs. */
  private syncArt(player: Phaser.Physics.Arcade.Sprite): void {
    const view = this.deps.scene.cameras.main.worldView
    this.locks.forEach((lock, index) => {
      const state = this.states[index]
      const art = this.gateArt[index]
      if (art && state.phase !== 'open') {
        if (lock.requiredInput === 'saber') setMechanicsFrame(art, 'scrap_gate', scrapGateFrameIndex(state))
        else setMechanicsFrame(art, 'energy_gate', energyGateFrameIndex(this.clockMs))
      }
      const sign = this.signs[index]
      if (!sign || !lock.requiredInput) return
      const shown = isGateSignShown(state, player.x, lock.gateX)
      sign.container.setVisible(shown)
      if (!shown) return
      const text = gateSignText(lock.requiredInput, Settings.get().bindings)
      if (sign.label.text !== text) {
        sign.label.setText(text)
        sign.panel.setSize(Math.ceil(sign.label.width) + SIGN_PAD_X * 2, SIGN_HEIGHT)
      }
      const position = gateSignPosition({
        gateX: lock.gateX,
        floorY: GAME_HEIGHT - MAIN_GROUND_HEIGHT,
        signWidth: sign.panel.width,
        signHeight: SIGN_HEIGHT,
        view: { x: view.x, y: view.y, width: view.width, height: view.height },
        hudBandPx: GAMEPLAY_VIEWPORT_TOP
      })
      sign.container.setPosition(position.x, position.y)
    })
  }

  /** `render_game_to_text().mechanics.verticalSegments`: the camera follows vertically while `cameraHeld`. */
  getSegmentDebugState(): Array<{ id: string; room: RoomRect; cameraHeld: boolean }> {
    return this.segments.map((segment, index) => ({
      id: segment.id,
      room: { ...this.rooms[this.locks.length + index].room },
      cameraHeld: this.cameraRoom === this.locks.length + index
    }))
  }

  private update(_time: number, delta: number): void {
    const player = this.deps.player()
    if (!player?.active || this.deps.scene.physics.world.isPaused) return
    this.clockMs += Math.min(Math.max(0, delta || 0), 100)
    const index = findRoomIndex(this.locks, player.x)
    if (index >= 0 && this.states[index].phase === 'dormant') {
      const armed = armRoomLock(this.states[index])
      playMechanicSfx(this.deps.scene, null, roomLockPhaseSfx(this.states[index].phase, armed.phase))
      this.states[index] = armed
      this.prevSample = null
      const lock = this.locks[index]
      if (lock.requiredInput) this.deps.onArmed(index, roomLockKeyHint(lock.requiredInput, Settings.get().bindings))
      else this.deps.onDefeatLockArmed?.(lock.id)
    }
    if (index >= 0 && this.states[index].phase === 'locked' && isDefeatLock(this.locks[index])) {
      this.commit(index, applyRoomLockDefeats(this.states[index], this.deps.clearedMarkers?.() ?? []))
      this.prevSample = null
    } else if (index >= 0 && this.states[index].phase === 'locked') {
      const sample = this.deps.runtime()?.getVerbSample() ?? null
      const verbs = sample ? detectRoomLockVerbs(this.prevSample, sample) : []
      this.prevSample = sample
      for (const verb of verbs) this.apply(index, verb, player)
    } else {
      this.prevSample = null
    }
    this.syncBounds(player)
    this.syncArt(player)
  }

  private apply(index: number, verb: RoomLockInput, player: Phaser.Physics.Arcade.Sprite): void {
    const lock = this.locks[index]
    const facing = this.deps.runtime()?.getFacing() ?? 1
    if (verb === 'saber' && !isSaberInReach(player.x, facing, lock.gateX)) return
    const before = this.states[index]
    this.commit(index, applyRoomLockInput(before, verb))
    // A counted cut on the scrap gate: a spark on its face and the sword hit SFX.
    if (verb === 'saber' && this.states[index] !== before) playMechanicHit(this.deps.scene, lock.gateX - facing * (GATE_WIDTH / 2), player.y - 4, 'sword_hit')
  }

  /**
   * A changed state steps the scrap gate's cut frame (or fades a fight gate, and the flat gate without
   * art, with progress) and removes the body when the lock opens: the sign hides, the gate falls apart and fades.
   */
  private commit(index: number, next: RoomLockState): void {
    if (next === this.states[index]) return
    playMechanicSfx(this.deps.scene, null, roomLockPhaseSfx(this.states[index].phase, next.phase))
    this.states[index] = next
    const gate = this.gates[index]
    const art = this.gateArt[index]
    const scrap = this.locks[index].requiredInput === 'saber'
    if (next.phase !== 'open') {
      if (art && scrap) setMechanicsFrame(art, 'scrap_gate', scrapGateFrameIndex(next))
      else (art ?? gate).setAlpha(Math.max(0.35, 1 - next.progress / next.hitsRequired))
      return
    }
    const body = gate.body as Phaser.Physics.Arcade.StaticBody | undefined
    if (body) body.enable = false
    this.signs[index]?.container.setVisible(false)
    if (art && scrap) setMechanicsFrame(art, 'scrap_gate', scrapGateFrameIndex(next))
    const target = art ?? gate
    this.deps.scene.tweens.add({ targets: target, alpha: 0, delay: art && scrap ? 140 : 0, duration: 240, onComplete: () => target.setVisible(false) })
  }

  /**
   * Camera and world ceiling. The camera holds the player's room while its gate is closed (and the
   * tall shaft for as long as the hero is in it, at its full height so the follow can scroll). The
   * raised ceiling outlives the shaft until the hero is below the base ceiling or grounded; until
   * then the camera keeps the stage width with the raised top instead of snapping down.
   */
  private syncBounds(player: Phaser.Physics.Arcade.Sprite): void {
    const index = resolveCameraRoomIndex(this.rooms, [...this.states, ...this.segmentPhases], player.x, GAME_HEIGHT)
    const world = this.deps.scene.physics.world
    const camera = this.deps.scene.cameras.main
    const base = this.defaultWorld
    const room = index >= 0 ? this.rooms[index].room : null
    const body = player.body as Phaser.Physics.Arcade.Body | undefined
    const top = resolveWorldCeiling({
      baseTop: base.y,
      currentTop: world.bounds.y,
      tallRoomTop: room && room.height > GAME_HEIGHT ? room.y + 8 : null,
      heroTop: body?.top ?? player.y,
      grounded: Boolean(body?.blocked.down)
    })
    if (world.bounds.y !== top) world.setBounds(base.x, top, base.width, base.y + base.height - top)
    if (room) {
      // A hero drifting out of the shaft high into the next (locked) room stays on screen.
      const cameraTop = top < base.y ? Math.min(room.y, top - 8) : room.y
      camera.setBounds(room.x, cameraTop, room.width, room.y + room.height - cameraTop)
      this.cameraRoom = index
    } else if (top < base.y) {
      const cameraTop = Math.min(0, top - 8)
      camera.setBounds(base.x, cameraTop, base.width, GAME_HEIGHT - cameraTop)
      this.cameraRoom = RAISED_STAGE_CAMERA
    } else {
      if (this.cameraRoom !== -1) this.deps.restoreCamera()
      this.cameraRoom = -1
    }
  }

  private destroy(): void {
    this.deps.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    this.colliders.forEach((collider) => collider.destroy())
    this.gates.forEach((gate) => gate.destroy())
    this.gateArt.forEach((art) => art?.destroy())
    this.signs.forEach((sign) => sign?.container.destroy())
    this.deps.scene.data?.remove(ROOM_LOCK_DATA_KEY)
  }
}

/** Stage build entry: installs the adapter when the stage authors room locks (the tutorial, Heat Works) or vertical segments. */
export function installRoomLocks(deps: RoomLockAdapterDeps): RoomLockAdapter | null {
  const arena = getCampaignStage(deps.stageId).arena
  const locks = arena.roomLocks ?? []
  const segments = (arena.verticalSegments ?? []).filter((segment) => segment.verticalScreens > 1)
  return locks.length > 0 || segments.length > 0 ? new RoomLockAdapter(deps, locks, segments) : null
}
