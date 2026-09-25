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
    }
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
    scene.data.set(ROOM_LOCK_DATA_KEY, this)
  }

  getDebugState(): Array<RoomLockState & { gateX: number; gateClosed: boolean; cameraHeld: boolean; room: RoomRect }> {
    return this.states.map((state, index) => ({
      ...state,
      gateX: this.locks[index].gateX,
      gateClosed: Boolean((this.gates[index]?.body as Phaser.Physics.Arcade.StaticBody | undefined)?.enable),
      cameraHeld: this.cameraRoom === index,
      room: { ...this.locks[index].room }
    }))
  }

  /** `render_game_to_text().mechanics.verticalSegments`: the camera follows vertically while `cameraHeld`. */
  getSegmentDebugState(): Array<{ id: string; room: RoomRect; cameraHeld: boolean }> {
    return this.segments.map((segment, index) => ({
      id: segment.id,
      room: { ...this.rooms[this.locks.length + index].room },
      cameraHeld: this.cameraRoom === this.locks.length + index
    }))
  }

  private update(): void {
    const player = this.deps.player()
    if (!player?.active || this.deps.scene.physics.world.isPaused) return
    const index = findRoomIndex(this.locks, player.x)
    if (index >= 0 && this.states[index].phase === 'dormant') {
      this.states[index] = armRoomLock(this.states[index])
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
  }

  private apply(index: number, verb: RoomLockInput, player: Phaser.Physics.Arcade.Sprite): void {
    const lock = this.locks[index]
    const facing = this.deps.runtime()?.getFacing() ?? 1
    if (verb === 'saber' && !isSaberInReach(player.x, facing, lock.gateX)) return
    this.commit(index, applyRoomLockInput(this.states[index], verb))
  }

  /** A changed state fades the gate with progress and removes its body when the lock opens. */
  private commit(index: number, next: RoomLockState): void {
    if (next === this.states[index]) return
    this.states[index] = next
    const gate = this.gates[index]
    if (next.phase !== 'open') {
      gate.setAlpha(Math.max(0.35, 1 - next.progress / next.hitsRequired))
      return
    }
    const body = gate.body as Phaser.Physics.Arcade.StaticBody | undefined
    if (body) body.enable = false
    this.deps.scene.tweens.add({ targets: gate, alpha: 0, duration: 240, onComplete: () => gate.setVisible(false) })
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
