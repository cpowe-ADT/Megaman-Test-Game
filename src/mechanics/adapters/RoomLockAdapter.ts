import Phaser from 'phaser'
import { GAME_HEIGHT } from '../../config/renderPolicy'
import { getCampaignStage } from '../../content/campaign'
import { Settings } from '../../systems/Settings'
import {
  applyRoomLockInput,
  armRoomLock,
  createRoomLockState,
  detectRoomLockVerbs,
  findRoomIndex,
  isSaberInReach,
  resolveCameraRoomIndex,
  roomLockKeyHint,
  type RoomLockDefinition,
  type RoomLockInput,
  type RoomLockState,
  type RoomLockVerbSample,
  type RoomRect
} from '../roomLock'

/** The player runtime surface the adapter reads: its public per-frame state and facing. */
export type RoomLockRuntime = {
  getDebugState(): Record<string, unknown> | null
  getFacing(): 1 | -1
}

export type RoomLockAdapterDeps = {
  scene: Phaser.Scene
  stageId: string
  player: () => Phaser.Physics.Arcade.Sprite | undefined
  runtime: () => RoomLockRuntime | undefined
  /** A lock armed: the story director plays Rook's recorded prompt and the lane shows the key hint. */
  onArmed: (index: number, keyHint: string) => void
  /** Hands the camera back to the stage bounds (the camera director owns them). */
  restoreCamera: () => void
}

/** Scene data key `render_game_to_text` reads for `mechanics.roomLocks`. */
export const ROOM_LOCK_DATA_KEY = 'roomLocks'
const GATE_WIDTH = 12
const ENERGY_GATE_COLOR = 0x7ec8ff
const SCRAP_WALL_COLOR = 0x6b5a48

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

  constructor(private readonly deps: RoomLockAdapterDeps, private readonly locks: readonly RoomLockDefinition[]) {
    const { scene } = deps
    this.states = locks.map(createRoomLockState)
    const bounds = scene.physics.world.bounds
    this.defaultWorld = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    const player = deps.player()
    for (const lock of locks) {
      const top = Math.min(0, lock.room.y)
      const height = GAME_HEIGHT - top
      const saber = lock.requiredInput === 'saber'
      const gate = scene.add
        .rectangle(lock.gateX, top + height / 2, GATE_WIDTH, height, saber ? SCRAP_WALL_COLOR : ENERGY_GATE_COLOR, saber ? 1 : 0.55)
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

  private update(): void {
    const player = this.deps.player()
    if (!player?.active || this.deps.scene.physics.world.isPaused) return
    const index = findRoomIndex(this.locks, player.x)
    if (index >= 0 && this.states[index].phase === 'dormant') {
      this.states[index] = armRoomLock(this.states[index])
      this.prevSample = null
      this.deps.onArmed(index, roomLockKeyHint(this.locks[index].requiredInput, Settings.get().bindings))
    }
    if (index >= 0 && this.states[index].phase === 'locked') {
      const sample = this.sample(player)
      const verbs = sample ? detectRoomLockVerbs(this.prevSample, sample) : []
      this.prevSample = sample
      for (const verb of verbs) this.apply(index, verb, player)
    } else {
      this.prevSample = null
    }
    this.syncCamera(player.x)
  }

  private sample(player: Phaser.Physics.Arcade.Sprite): RoomLockVerbSample | null {
    const debug = this.deps.runtime()?.getDebugState() as
      | { locomotion?: Record<string, unknown>; combat?: Record<string, unknown> }
      | null
      | undefined
    if (!debug) return null
    const locomotion = debug.locomotion ?? {}
    const combat = debug.combat ?? {}
    const projectile = combat.lastProjectile as { chargeLevel?: number } | null | undefined
    return {
      grounded: Boolean(locomotion.grounded),
      velocityY: Number(player.body?.velocity.y ?? 0),
      lastJumpSource: String(locomotion.lastJumpSource ?? 'none'),
      dashStartedAtMs: Number(locomotion.lastDashStartedAtMs ?? 0) || 0,
      wallJumping: Boolean(locomotion.wallJumping),
      projectileSpawnMs: Number(combat.lastProjectileSpawnMs ?? 0) || 0,
      projectileChargeLevel: Number(projectile?.chargeLevel ?? 0) || 0,
      slashPhase: typeof combat.slashPhase === 'string' ? combat.slashPhase : null
    }
  }

  private apply(index: number, verb: RoomLockInput, player: Phaser.Physics.Arcade.Sprite): void {
    const lock = this.locks[index]
    const facing = this.deps.runtime()?.getFacing() ?? 1
    if (verb === 'saber' && !isSaberInReach(player.x, facing, lock.gateX)) return
    const next = applyRoomLockInput(this.states[index], verb)
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

  private syncCamera(x: number): void {
    const index = resolveCameraRoomIndex(this.locks, this.states, x, GAME_HEIGHT)
    const world = this.deps.scene.physics.world
    const base = this.defaultWorld
    if (index >= 0) {
      const room = this.locks[index].room
      this.deps.scene.cameras.main.setBounds(room.x, room.y, room.width, room.height)
      const top = room.height > GAME_HEIGHT ? Math.min(base.y, room.y + 8) : base.y
      if (world.bounds.y !== top) world.setBounds(base.x, top, base.width, base.y + base.height - top)
    } else if (this.cameraRoom >= 0) {
      world.setBounds(base.x, base.y, base.width, base.height)
      this.deps.restoreCamera()
    }
    this.cameraRoom = index
  }

  private destroy(): void {
    this.deps.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    this.colliders.forEach((collider) => collider.destroy())
    this.gates.forEach((gate) => gate.destroy())
    this.deps.scene.data?.remove(ROOM_LOCK_DATA_KEY)
  }
}

/** Stage build entry: installs the adapter when the stage authors room locks (the tutorial). */
export function installRoomLocks(deps: RoomLockAdapterDeps): RoomLockAdapter | null {
  const locks = getCampaignStage(deps.stageId).arena.roomLocks ?? []
  return locks.length > 0 ? new RoomLockAdapter(deps, locks) : null
}
