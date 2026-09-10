import type { BossAttackDefinition } from '../boss/framework/types'
import type {
  BossAttackCombatProfile,
  BossAttackLifecyclePhase,
  BossMotionIntentKind,
  BossRoomDynamicsProfile
} from './bossCombatProfiles'
import { resolveBossAnchorX, resolveBossAttackLifecycle } from './bossCombatProfiles'

export interface BossMotionBounds {
  minX: number
  maxX: number
}

export interface BossMotionFrameInput {
  nowMs: number
  x: number
  y: number
  velocityX: number
  velocityY: number
  grounded: boolean
  playerX: number
  playerY: number
  groundY: number
  bounds: BossMotionBounds
}

export interface BossMotionFrameOutput {
  phase: BossAttackLifecyclePhase
  intent: BossMotionIntentKind
  facing: -1 | 1
  allowGravity: boolean
  velocityX?: number
  velocityY?: number
  setX?: number
  setY?: number
  phaseChanged: boolean
  motionStarted: boolean
  landed: boolean
}

export interface BossMotionDebugState {
  intent: BossMotionIntentKind
  lifecyclePhase: BossAttackLifecyclePhase
  lockedFacing: 'west' | 'east'
  attackId: string | null
  startedAtMs: number
  groundY: number
}

type ActiveBossAction = {
  attack: BossAttackDefinition
  profile: BossAttackCombatProfile
  startedAtMs: number
  facing: -1 | 1
  phase: BossAttackLifecyclePhase
  motionStarted: boolean
  teleported: boolean
  wasAirborne: boolean
  landed: boolean
}

const signFacing = (playerX: number, bossX: number): -1 | 1 => (playerX < bossX ? -1 : 1)

export class BossMotionController {
  private active: ActiveBossAction | null = null
  private lastGroundY = 0

  constructor(private readonly room: BossRoomDynamicsProfile) {}

  beginAttack(
    nowMs: number,
    attack: BossAttackDefinition,
    profile: BossAttackCombatProfile,
    bossX: number,
    playerX: number,
    groundY: number
  ): void {
    this.lastGroundY = groundY
    this.active = {
      attack,
      profile,
      startedAtMs: Math.max(0, nowMs),
      facing: signFacing(playerX, bossX),
      phase: 'windup',
      motionStarted: false,
      teleported: false,
      wasAirborne: false,
      landed: false
    }
  }

  finishAttack(): void {
    this.active = null
  }

  update(input: BossMotionFrameInput): BossMotionFrameOutput | null {
    const action = this.active
    if (!action) {
      if (input.grounded) this.lastGroundY = input.y
      return null
    }

    if (input.grounded) {
      this.lastGroundY = input.y
    } else {
      action.wasAirborne = true
    }

    const elapsed = Math.max(0, input.nowMs - action.startedAtMs)
    const nextPhase = resolveBossAttackLifecycle(
      elapsed,
      action.attack,
      action.profile.landingMs ?? 0
    )
    const phaseChanged = nextPhase !== action.phase
    action.phase = nextPhase

    if (action.profile.facingPolicy === 'track_until_active' && nextPhase === 'windup') {
      action.facing = signFacing(input.playerX, input.x)
    } else if (action.profile.facingPolicy === 'movement_driven' && Math.abs(input.velocityX) > 1) {
      action.facing = input.velocityX < 0 ? -1 : 1
    }

    const landed = action.wasAirborne && input.grounded && !action.landed
    if (landed) action.landed = true

    const output: BossMotionFrameOutput = {
      phase: nextPhase,
      intent: action.profile.motion.kind,
      facing: action.facing,
      allowGravity: true,
      phaseChanged,
      motionStarted: false,
      landed
    }

    const motion = action.profile.motion
    const activeOrLanding = nextPhase === 'active' || nextPhase === 'landing'

    switch (motion.kind) {
      case 'hold':
        output.velocityX = 0
        break
      case 'walk_to':
        output.velocityX = signFacing(input.playerX, input.x) * (motion.speed ?? 72)
        break
      case 'jump_to':
        if (nextPhase === 'active' && input.grounded && !action.motionStarted) {
          output.velocityX = action.facing * (motion.speed ?? 110)
          output.velocityY = motion.jumpVelocityY ?? -300
          action.motionStarted = true
          output.motionStarted = true
        } else if (!input.grounded && activeOrLanding) {
          output.velocityX = action.facing * (motion.speed ?? 110)
        }
        break
      case 'dash_through':
        if (nextPhase === 'windup' || nextPhase === 'recovery') {
          output.velocityX = 0
        } else if (nextPhase === 'active') {
          output.velocityX = action.facing * (motion.speed ?? 260)
          if (!action.motionStarted) {
            action.motionStarted = true
            output.motionStarted = true
          }
        }
        break
      case 'hover_to': {
        const targetY = this.lastGroundY - (motion.hoverHeight ?? 72)
        if (nextPhase === 'windup' || nextPhase === 'active') {
          output.allowGravity = false
          const difference = targetY - input.y
          output.velocityY = Math.abs(difference) < 3 ? 0 : Math.sign(difference) * (motion.riseSpeed ?? 140)
          output.velocityX = nextPhase === 'active' ? action.facing * (motion.speed ?? 60) : 0
          if (!action.motionStarted) {
            action.motionStarted = true
            output.motionStarted = true
          }
        }
        break
      }
      case 'dive_to': {
        const targetY = this.lastGroundY - (motion.hoverHeight ?? 96)
        if (nextPhase === 'windup') {
          output.allowGravity = false
          output.velocityY = input.y > targetY ? -(motion.riseSpeed ?? 180) : 0
          output.velocityX = 0
        } else if (nextPhase === 'active') {
          output.allowGravity = false
          output.velocityX = action.facing * (motion.speed ?? 120)
          output.velocityY = motion.diveSpeed ?? 420
          if (!action.motionStarted) {
            action.motionStarted = true
            output.motionStarted = true
          }
        }
        break
      }
      case 'teleport_to':
        output.velocityX = 0
        if (nextPhase === 'active' && !action.teleported) {
          output.setX = resolveBossAnchorX(
            this.room.anchorFractions,
            input.bounds.minX,
            input.bounds.maxX,
            input.playerX,
            true
          )
          output.setY = this.lastGroundY
          action.teleported = true
          action.motionStarted = true
          output.motionStarted = true
        } else if (nextPhase === 'active' && action.teleported && motion.speed) {
          output.velocityX = action.facing * motion.speed
        }
        break
      case 'slam_to_floor':
        if (nextPhase === 'windup' && input.grounded && !action.motionStarted) {
          output.velocityX = 0
          output.velocityY = motion.jumpVelocityY ?? -230
          action.motionStarted = true
          output.motionStarted = true
        } else if (nextPhase === 'active' && !input.grounded) {
          output.velocityX = 0
          output.velocityY = motion.diveSpeed ?? 440
        } else if (input.grounded) {
          output.velocityX = 0
        }
        break
      default:
        break
    }

    return output
  }

  getDebugState(): BossMotionDebugState {
    return {
      intent: this.active?.profile.motion.kind ?? 'hold',
      lifecyclePhase: this.active?.phase ?? 'done',
      lockedFacing: this.active?.facing === -1 ? 'west' : 'east',
      attackId: this.active?.attack.id ?? null,
      startedAtMs: this.active?.startedAtMs ?? 0,
      groundY: Math.round(this.lastGroundY)
    }
  }
}
