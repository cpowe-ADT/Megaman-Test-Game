import type Phaser from 'phaser'
import AudioService from '../../audio'
import { FINAL_STAGE_ID } from '../../content/campaign'
import {
  OMEGA_DOORS,
  OMEGA_DOOR_REACH,
  OMEGA_REMATCH_START_X,
  buildRematchEntry,
  buildReturnEntry,
  doorAt,
  initialOmegaRunState,
  isArchiveExitOpen,
  isOmegaRematch,
  keepRunOnGameOver,
  omegaActOfCheckpoint,
  omegaRunSnapshot,
  readOmegaEntry,
  shouldCheckpointOnReturn,
  type OmegaAct,
  type OmegaRunState
} from '../../content/omegaArchive'
import { rematchConfigId } from '../../content/omegaRematch'
import { OMEGA_HUB_GATE } from '../../content/stages/omegaFortress'
import { getWeaponMaxEnergy } from '../../progression'
import { Save, type ActiveRunSaveData } from '../../systems/Save'
import { DROP_HEAL } from '../../ui/pickups/dropRewards'
import { PICKUPS_ATLAS, pickupFrame } from '../../ui/pickups/pickupArt'
import { PIXEL_FONT, PIXEL_FONT_PX } from '../../ui/pixelFont'

export { resolveOmegaEntryRun } from '../../content/omegaArchive'
export { resolveBossDefinition } from '../../content/omegaRematch'

/** `scene.data` key: smoke and debug read `getDebugState()` from here (like the stage mechanics adapter). */
export const OMEGA_ACTS_DATA_KEY = 'omegaActs'

const FLOOR = 236
const GROUNDED_Y = 214
const GATE_TOP = 60
const CONTINUE_LIVES = 3
const ACT_TITLES: Record<OmegaAct, string> = { 1: 'ACT 1 • RELAY SPIRE', 2: 'ACT 2 • WARDEN ARCHIVE', 3: 'ACT 3 • THE CORE' }

/** The Game scene members the acts read and write (Game is the host; it gains one call, not logic). */
export interface OmegaActsHost extends Phaser.Scene {
  player?: Phaser.Physics.Arcade.Sprite
  activeStageId: string
  respawnPoint?: { x: number; y: number }
  currentCheckpointIndex: number
  currentCheckpointId: string | null
  weaponEnergyById: Record<string, number>
  progressionSave: ReturnType<typeof Save.load>
  actions?: { isHeld(action: 'aimUp'): boolean }
  paused: boolean
  victoryTriggered: boolean
  gameOverTriggered: boolean
  captureActiveRunSnapshot(): ActiveRunSaveData | null
  restorePlayerHealth(amount: number): number
  showStageToast(message: string, durationMs?: number): void
  syncWeaponHud(): void
  /** The archive door (act 2) and the Core's approach (act 3) ask it for one radio-ticker line each,
   * once (prompt 07 7.6 item "OMEGA acts"; EVAL-P6-011 open item). Game already owns one (its private
   * field satisfies this the same way `showStageToast` does); a host without one simply skips it. */
  storyDirector?: { onOmegaActEntered(act: OmegaAct): void }
}

type Refill = { kind: 'hp' | 'energy'; sprite: Phaser.GameObjects.Image }

/**
 * The Central Core's acts in the scene (prompt 12 part 12e, EVAL-P6-011): the Warden Archive's eight doors and
 * sealed exit, the rematch and hub re-entries (`Game` restarts with scene data `omega`), the refills after a clear,
 * the checkpoint after every second clear, and the act titles. Rules are in `src/content/omegaArchive.ts`.
 */
export class OmegaActs {
  readonly state: OmegaRunState
  private act: OmegaAct
  private readonly doorLabels: Phaser.GameObjects.Text[] = []
  private readonly doorFrames: Phaser.GameObjects.Rectangle[] = []
  private prompt?: Phaser.GameObjects.Text
  private gate?: { wall: Phaser.GameObjects.Rectangle; collider: Phaser.Physics.Arcade.Collider; label: Phaser.GameObjects.Text }
  private refills: Refill[] = []
  private upWasHeld = true
  private leaving = false
  private checkpointSaved = false

  constructor(private readonly host: OmegaActsHost, state: OmegaRunState) {
    this.state = state
    this.act = isOmegaRematch(state) ? 2 : omegaActOfCheckpoint(host.currentCheckpointId)
  }

  start(): void {
    const host = this.host
    this.drawArchive()
    const entry = this.state.entry
    if (entry?.mode === 'rematch') {
      // The fight is in the Core's room. The archive stays the checkpoint (index and id), and no checkpoint is
      // crossed while in a rematch (`DeathSequence.updateRespawnCheckpoint` asks `isRematch`); a death respawns here.
      this.placeHero(OMEGA_REMATCH_START_X)
      host.respawnPoint = { x: OMEGA_REMATCH_START_X, y: GROUNDED_Y }
      host.showStageToast(`${OMEGA_DOORS[entry.door].label} REMATCH`, 1100)
    } else if (entry?.mode === 'return') {
      const door = OMEGA_DOORS[entry.door]
      this.placeHero(door.x)
      this.spawnRefills(door.x)
      const count = this.state.cleared.length
      // Sub-tank fills are already in the save (written when they change), so the run is all a checkpoint writes.
      if (shouldCheckpointOnReturn(count, this.state.saved.length)) {
        this.state.saved = [...this.state.cleared]
        const snapshot = host.captureActiveRunSnapshot()
        this.checkpointSaved = Boolean(snapshot && Save.saveActiveRun(snapshot))
      }
      host.showStageToast(`${door.label} COPY DOWN • ${count}/${OMEGA_DOORS.length}${this.checkpointSaved ? ' • CHECKPOINT' : ''}`, 1400)
    }
    if (this.act >= 2 && !isArchiveExitOpen(this.state.cleared)) this.sealExit()
    host.events.on('update', this.update, this)
    host.events.once('shutdown', () => host.events.off('update', this.update, this))
  }

  isRematch(): boolean {
    return isOmegaRematch(this.state)
  }

  /** Enters `index`'s door: the scene restarts as that rematch with the run in memory. False when it cannot. */
  enterDoor(index: number): boolean {
    const door = OMEGA_DOORS[index]
    if (this.leaving || !door || this.isRematch() || this.state.cleared.includes(door.bossId)) return false
    const run = this.host.captureActiveRunSnapshot()
    if (!run) return false
    this.leaving = true
    this.host.scene.restart(buildRematchEntry(run, this.state, index, rematchConfigId(door.bossId)))
    return true
  }

  /** The rematch warden fell (after its death chain): back to the archive at its door, the clear in the session. */
  onRematchCleared(): void {
    const entry = this.state.entry
    const run = this.host.captureActiveRunSnapshot()
    if (!entry || entry.mode !== 'rematch' || !run || this.leaving) return
    this.leaving = true
    this.host.scene.restart(buildReturnEntry(run, this.state, entry.door))
  }

  /** A game over from act 2 on keeps the run at its checkpoint for the continue, at full HP; not on Veteran. */
  keepRunAtGameOver(): boolean {
    const snapshot = this.host.captureActiveRunSnapshot()
    if (!snapshot || !keepRunOnGameOver(this.host.progressionSave.difficulty, snapshot.omegaAct ?? 1)) return false
    return Save.saveActiveRun({ ...snapshot, playerHp: snapshot.playerMaxHp, playerLives: CONTINUE_LIVES })
  }

  snapshot(run: ActiveRunSaveData): ActiveRunSaveData {
    return omegaRunSnapshot(run, this.state)
  }

  getDebugState() {
    return {
      act: this.act,
      mode: this.state.entry?.mode ?? null,
      door: this.state.entry?.door ?? null,
      cleared: [...this.state.cleared],
      saved: [...this.state.saved],
      checkpointSaved: this.checkpointSaved,
      exitOpen: isArchiveExitOpen(this.state.cleared),
      gateClosed: Boolean(this.gate),
      refills: this.refills.filter((refill) => refill.sprite.active).map((refill) => refill.kind),
      doors: OMEGA_DOORS.map((door) => ({ index: door.index, bossId: door.bossId, label: door.label, x: door.x, cleared: this.state.cleared.includes(door.bossId) }))
    }
  }

  private update(): void {
    const host = this.host
    const player = host.player
    if (this.leaving || !player?.active || host.paused || host.victoryTriggered || host.gameOverTriggered) return
    const act = this.isRematch() ? 2 : omegaActOfCheckpoint(host.currentCheckpointId)
    if (act > this.act) {
      this.act = act
      host.showStageToast(ACT_TITLES[act], 1600)
      host.storyDirector?.onOmegaActEntered(act)
      if (act >= 2 && !isArchiveExitOpen(this.state.cleared)) this.sealExit()
    }
    this.collectRefills(player)
    const held = Boolean(host.actions?.isHeld('aimUp'))
    const pressed = held && !this.upWasHeld
    this.upWasHeld = held
    const body = player.body as Phaser.Physics.Arcade.Body | undefined
    const grounded = Boolean(body?.blocked.down || body?.touching.down)
    const door = this.act === 2 && !this.isRematch() && grounded ? doorAt(player.x, this.state.cleared) : null
    if (this.prompt) {
      this.prompt.setVisible(Boolean(door))
      if (door) this.prompt.setPosition(door.x, FLOOR - 70)
    }
    if (door && pressed) this.enterDoor(door.index)
  }

  private placeHero(x: number): void {
    const player = this.host.player
    if (!player) return
    player.setPosition(x, GROUNDED_Y)
    ;(player.body as Phaser.Physics.Arcade.Body | undefined)?.reset(x, GROUNDED_Y)
    this.host.cameras.main.centerOn(x, GROUNDED_Y)
  }

  private text(x: number, y: number, value: string, color: string): Phaser.GameObjects.Text {
    return this.host.add.text(x, y, value, { fontFamily: PIXEL_FONT, fontSize: `${PIXEL_FONT_PX}px`, color }).setOrigin(0.5).setDepth(3)
  }

  /** Eight doors, each labelled by its element only; a cleared door dims and reads CLEAR. */
  private drawArchive(): void {
    for (const door of OMEGA_DOORS) {
      const cleared = this.state.cleared.includes(door.bossId)
      const frame = this.host.add.rectangle(door.x, FLOOR - 22, OMEGA_DOOR_REACH * 2, 44, cleared ? 0x1a1a22 : 0x120a24, 1)
      frame.setStrokeStyle(1, cleared ? 0x44485a : 0x7fe7ff, 1).setDepth(1)
      this.doorFrames.push(frame)
      this.doorLabels.push(this.text(door.x, FLOOR - 54, door.label, cleared ? '#5a5e70' : '#cfe8ff'))
      if (cleared) this.doorLabels.push(this.text(door.x, FLOOR - 22, 'CLEAR', '#6f7690'))
    }
    this.prompt = this.text(0, 0, 'UP: ENTER', '#ffe28a').setVisible(false)
  }

  /** The archive's exit: a wall at the hub's right end until all eight rematches are cleared. */
  private sealExit(): void {
    const host = this.host
    if (this.gate || !host.player) return
    const height = FLOOR - GATE_TOP
    const wall = host.add.rectangle(OMEGA_HUB_GATE.x + OMEGA_HUB_GATE.width / 2, GATE_TOP + height / 2, OMEGA_HUB_GATE.width, height, 0x2c2242, 1)
    wall.setStrokeStyle(1, 0xff5a7a, 1).setDepth(1)
    host.physics.add.existing(wall, true)
    const collider = host.physics.add.collider(host.player, wall)
    const label = this.text(OMEGA_HUB_GATE.x - 40, GATE_TOP + 40, `SEALED ${this.state.cleared.length}/${OMEGA_DOORS.length}`, '#ff8aa0')
    this.gate = { wall, collider, label }
  }

  /** A large HP refill and a full weapon-energy refill beside the door the hero came back through. */
  private spawnRefills(x: number): void {
    const kinds: Array<[Refill['kind'], number, string]> = [['hp', x - 24, pickupFrame('health_large')], ['energy', x + 24, pickupFrame('energy_large')]]
    for (const [kind, refillX, frame] of kinds) {
      const sprite = this.host.add.image(refillX, FLOOR - 10, PICKUPS_ATLAS.key, frame).setScale(0.6).setDepth(4)
      this.refills.push({ kind, sprite })
    }
  }

  private collectRefills(player: Phaser.Physics.Arcade.Sprite): void {
    const host = this.host
    for (const refill of this.refills) {
      if (!refill.sprite.active || Math.abs(player.x - refill.sprite.x) > 12 || Math.abs(player.y - refill.sprite.y) > 24) continue
      refill.sprite.destroy()
      if (refill.kind === 'hp') {
        const healed = host.restorePlayerHealth(DROP_HEAL.health_large)
        AudioService.playSfx('pickup_health')
        host.showStageToast(healed > 0 ? `HP +${healed}` : 'HP MAX', 650)
      } else {
        for (const weaponId of Object.keys(host.weaponEnergyById)) host.weaponEnergyById[weaponId] = getWeaponMaxEnergy(weaponId)
        host.syncWeaponHud()
        AudioService.playSfx('pickup_ammo')
        host.showStageToast('WEAPON ENERGY MAX', 650)
      }
    }
  }
}

/** Called once from `Game.create` after the run is applied: the acts exist only in the Central Core. */
export function attachOmegaActs(host: OmegaActsHost, data: unknown, activeRun: ActiveRunSaveData | null): OmegaActs | null {
  if (host.activeStageId !== FINAL_STAGE_ID) {
    host.data?.remove?.(OMEGA_ACTS_DATA_KEY)
    return null
  }
  const entry = readOmegaEntry(data)
  const savedRun = entry ? null : activeRun ?? Save.loadActiveRun()
  const acts = new OmegaActs(host, initialOmegaRunState(entry, savedRun, host.currentCheckpointId))
  host.data?.set(OMEGA_ACTS_DATA_KEY, acts)
  acts.start()
  return acts
}

/** The scene's acts, if it is the Central Core (the snapshot, the boss beats and game over ask). */
export function omegaActsOf(scene: unknown): OmegaActs | null {
  const acts = (scene as { data?: { get?(key: string): unknown } } | null)?.data?.get?.(OMEGA_ACTS_DATA_KEY)
  return acts instanceof OmegaActs ? acts : null
}
