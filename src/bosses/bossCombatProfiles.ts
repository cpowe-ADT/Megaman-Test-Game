import type { BossId } from './types'

export type BossMotionIntentKind =
  | 'hold'
  | 'walk_to'
  | 'jump_to'
  | 'dash_through'
  | 'hover_to'
  | 'dive_to'
  | 'teleport_to'
  | 'slam_to_floor'

export type BossAttackLifecyclePhase = 'windup' | 'active' | 'recovery' | 'landing' | 'done'
export type BossFacingPolicy = 'lock_at_windup' | 'track_until_active' | 'movement_driven'
export type BossStrategyTag =
  | 'punish'
  | 'gap_close'
  | 'zoning'
  | 'anti_air'
  | 'escape'
  | 'setup'
  | 'finisher'

export interface BossAttackMotionSpec {
  kind: BossMotionIntentKind
  speed?: number
  jumpVelocityY?: number
  hoverHeight?: number
  riseSpeed?: number
  diveSpeed?: number
  crossPlayer?: boolean
}

export interface BossAttackAnimationSpec {
  windup: string
  active: string
  recovery: string
  landing?: string
}

export interface BossAttackCombatProfile {
  attackId: string
  facingPolicy: BossFacingPolicy
  motion: BossAttackMotionSpec
  animation: BossAttackAnimationSpec
  strategyTags: BossStrategyTag[]
  requiresGrounded?: boolean
  landingMs?: number
}

export interface BossRoomDynamicsProfile {
  kind: 'flat' | 'lane_vents' | 'height_anchors' | 'mine_lanes' | 'pillar_lanes' | 'teleport_anchors'
  maxActiveHazards: number
  anchorFractions: number[]
}

export interface BossCombatProfile {
  bossId: BossId
  identity: string
  locomotion: 'grounded' | 'aerial' | 'hybrid'
  passiveMotion: BossMotionIntentKind
  attacks: Record<string, BossAttackCombatProfile>
  room: BossRoomDynamicsProfile
  deterministicDeck?: string[][]
}

type AttackSeed = Omit<BossAttackCombatProfile, 'attackId'>

const anim = (family: string, landing?: string): BossAttackAnimationSpec => ({
  windup: `${family}_windup`,
  active: `${family}_active`,
  recovery: `${family}_recovery`,
  landing
})

const attack = (attackId: string, seed: AttackSeed): BossAttackCombatProfile => ({ attackId, ...seed })

function attackMap(...entries: BossAttackCombatProfile[]): Record<string, BossAttackCombatProfile> {
  return Object.fromEntries(entries.map((entry) => [entry.attackId, entry]))
}

export const BOSS_COMBAT_PROFILES: Record<BossId, BossCombatProfile> = {
  sentinel_rook: {
    bossId: 'sentinel_rook',
    identity: 'Grounded tutorial sentinel: read the hop, clear the landing, punish recovery.',
    locomotion: 'grounded',
    passiveMotion: 'walk_to',
    room: { kind: 'flat', maxActiveHazards: 1, anchorFractions: [0.25, 0.5, 0.75] },
    attacks: attackMap(
      attack('giga_hop', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'jump_to', jumpVelocityY: -248, speed: 92 },
        animation: anim('hop', 'land'),
        strategyTags: ['gap_close', 'punish'],
        requiresGrounded: true,
        landingMs: 220
      }),
      attack('guard_shot', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hold' },
        animation: anim('guard_shot'),
        strategyTags: ['zoning', 'punish'],
        requiresGrounded: true
      }),
      attack('stomp_shock', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'slam_to_floor', jumpVelocityY: -190, diveSpeed: 410 },
        animation: anim('stomp', 'stomp_land'),
        strategyTags: ['anti_air', 'finisher'],
        requiresGrounded: true,
        landingMs: 300
      })
    )
  },
  pyro_maw: {
    bossId: 'pyro_maw',
    identity: 'Lane-control duelist: stream, lob, then dash through the opening.',
    locomotion: 'grounded',
    passiveMotion: 'walk_to',
    room: { kind: 'lane_vents', maxActiveHazards: 4, anchorFractions: [0.18, 0.38, 0.62, 0.82] },
    attacks: attackMap(
      attack('serpent_stream', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'hold' },
        animation: anim('stream'),
        strategyTags: ['zoning', 'anti_air'],
        requiresGrounded: true
      }),
      attack('ignition_dash', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dash_through', speed: 286, crossPlayer: true },
        animation: anim('dash'),
        strategyTags: ['gap_close', 'escape', 'setup'],
        requiresGrounded: true
      }),
      attack('blaze_lob', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hold' },
        animation: anim('lob'),
        strategyTags: ['zoning', 'setup'],
        requiresGrounded: true
      })
    )
  },
  tide_reaver: {
    bossId: 'tide_reaver',
    identity: 'Authored height-anchor hunter that must land between aerial patterns.',
    locomotion: 'hybrid',
    passiveMotion: 'walk_to',
    room: { kind: 'height_anchors', maxActiveHazards: 3, anchorFractions: [0.22, 0.5, 0.78] },
    attacks: attackMap(
      attack('jet_levitate', {
        facingPolicy: 'movement_driven',
        motion: { kind: 'hover_to', hoverHeight: 92, riseSpeed: 150, speed: 78 },
        animation: anim('levitate', 'splash_land'),
        strategyTags: ['escape', 'setup']
      }),
      attack('lance_volley', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hover_to', hoverHeight: 82, riseSpeed: 130 },
        animation: anim('lance'),
        strategyTags: ['zoning', 'anti_air']
      }),
      attack('riptide_crash', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dive_to', hoverHeight: 108, riseSpeed: 190, diveSpeed: 430, speed: 120 },
        animation: anim('dive', 'splash_land'),
        strategyTags: ['gap_close', 'finisher'],
        landingMs: 260
      })
    )
  },
  volt_hopper: {
    bossId: 'volt_hopper',
    identity: 'Fast chain hopper that places mines and punishes vertical alignment.',
    locomotion: 'grounded',
    passiveMotion: 'jump_to',
    room: { kind: 'mine_lanes', maxActiveHazards: 3, anchorFractions: [0.22, 0.5, 0.78] },
    attacks: attackMap(
      attack('capacitor_charge', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'jump_to', jumpVelocityY: -340, speed: 154 },
        animation: anim('capacitor_hop', 'land'),
        strategyTags: ['setup', 'escape'],
        requiresGrounded: true,
        landingMs: 140
      }),
      attack('rail_shot', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hold' },
        animation: anim('rail_shot'),
        strategyTags: ['anti_air', 'punish']
      }),
      attack('impulse_dash', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dash_through', speed: 320, crossPlayer: true },
        animation: anim('impulse_dash'),
        strategyTags: ['escape', 'gap_close'],
        requiresGrounded: true
      })
    )
  },
  basalt_titan: {
    bossId: 'basalt_titan',
    identity: 'Slow, commitment-heavy bruiser with large punish windows.',
    locomotion: 'grounded',
    passiveMotion: 'walk_to',
    room: { kind: 'pillar_lanes', maxActiveHazards: 3, anchorFractions: [0.25, 0.5, 0.75] },
    attacks: attackMap(
      attack('fault_punch', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dash_through', speed: 218 },
        animation: anim('fault_punch'),
        strategyTags: ['gap_close', 'punish'],
        requiresGrounded: true
      }),
      attack('basalt_barrage', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hold' },
        animation: anim('barrage'),
        strategyTags: ['zoning', 'setup'],
        requiresGrounded: true
      }),
      attack('crustquake', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'slam_to_floor', jumpVelocityY: -270, diveSpeed: 470 },
        animation: anim('crustquake', 'heavy_land'),
        strategyTags: ['finisher', 'anti_air'],
        requiresGrounded: true,
        landingMs: 340
      })
    )
  },
  ferro_blade: {
    bossId: 'ferro_blade',
    identity: 'Teleport-anchor duelist with a returning disc and bounded control zones.',
    locomotion: 'grounded',
    passiveMotion: 'walk_to',
    room: { kind: 'teleport_anchors', maxActiveHazards: 2, anchorFractions: [0.16, 0.5, 0.84] },
    attacks: attackMap(
      attack('vector_slice', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'teleport_to', speed: 310, crossPlayer: true },
        animation: anim('vector_slice'),
        strategyTags: ['gap_close', 'escape'],
        requiresGrounded: true
      }),
      attack('mag_disc', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'hold' },
        animation: anim('disc_throw'),
        strategyTags: ['zoning', 'punish'],
        requiresGrounded: true
      }),
      attack('polar_snare', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hold' },
        animation: anim('snare'),
        strategyTags: ['setup', 'zoning'],
        requiresGrounded: true
      })
    )
  },
  mire_wraith: {
    bossId: 'mire_wraith',
    identity: 'Low phasing slide with short-lived, capped denial zones.',
    locomotion: 'hybrid',
    passiveMotion: 'walk_to',
    room: { kind: 'flat', maxActiveHazards: 3, anchorFractions: [0.2, 0.5, 0.8] },
    attacks: attackMap(
      attack('toxic_slide', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dash_through', speed: 264, crossPlayer: true },
        animation: anim('toxic_slide'),
        strategyTags: ['gap_close', 'setup', 'escape']
      }),
      attack('glob_lob', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hold' },
        animation: anim('glob_lob'),
        strategyTags: ['zoning', 'setup']
      }),
      attack('toxic_bloom', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hover_to', hoverHeight: 48, riseSpeed: 100 },
        animation: anim('bloom'),
        strategyTags: ['zoning', 'finisher']
      })
    )
  },
  gale_vixen: {
    bossId: 'gale_vixen',
    identity: 'Deliberate aerial anchor movement with readable air dashes and landings.',
    locomotion: 'aerial',
    passiveMotion: 'hover_to',
    room: { kind: 'height_anchors', maxActiveHazards: 2, anchorFractions: [0.18, 0.5, 0.82] },
    attacks: attackMap(
      attack('turbine_slice', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dash_through', speed: 340, crossPlayer: true },
        animation: anim('turbine_slice'),
        strategyTags: ['gap_close', 'escape']
      }),
      attack('aero_volley', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hover_to', hoverHeight: 76, riseSpeed: 150 },
        animation: anim('aero_volley'),
        strategyTags: ['zoning', 'anti_air']
      }),
      attack('cyclone_lift', {
        facingPolicy: 'movement_driven',
        motion: { kind: 'hover_to', hoverHeight: 112, riseSpeed: 230, speed: 110 },
        animation: anim('cyclone_lift', 'land'),
        strategyTags: ['setup', 'escape']
      })
    )
  },
  glacier_ronin: {
    bossId: 'glacier_ronin',
    identity: 'Grounded spacing and counter duel with deliberate draw recovery.',
    locomotion: 'grounded',
    passiveMotion: 'walk_to',
    room: { kind: 'flat', maxActiveHazards: 3, anchorFractions: [0.22, 0.5, 0.78] },
    attacks: attackMap(
      attack('glacier_slide', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dash_through', speed: 276, crossPlayer: true },
        animation: anim('glacier_slide'),
        strategyTags: ['escape', 'gap_close'],
        requiresGrounded: true
      }),
      attack('frost_draw', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'hold' },
        animation: anim('frost_draw'),
        strategyTags: ['punish', 'anti_air'],
        requiresGrounded: true
      }),
      attack('shard_rain', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hold' },
        animation: anim('shard_rain'),
        strategyTags: ['zoning', 'setup'],
        requiresGrounded: true
      })
    )
  },
  omega_core: {
    bossId: 'omega_core',
    identity: 'Deterministic three-phase exam using authored hover anchors and pattern decks.',
    locomotion: 'aerial',
    passiveMotion: 'hover_to',
    room: { kind: 'height_anchors', maxActiveHazards: 4, anchorFractions: [0.18, 0.5, 0.82] },
    deterministicDeck: [
      ['directive_volley', 'lockdown_pulse'],
      ['directive_volley', 'core_ram', 'lockdown_pulse'],
      ['override_cascade', 'core_ram', 'directive_volley', 'lockdown_pulse']
    ],
    attacks: attackMap(
      attack('directive_volley', {
        facingPolicy: 'track_until_active',
        motion: { kind: 'hover_to', hoverHeight: 82, riseSpeed: 120 },
        animation: anim('directive_volley'),
        strategyTags: ['zoning', 'anti_air']
      }),
      attack('lockdown_pulse', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'hold' },
        animation: anim('lockdown_pulse'),
        strategyTags: ['setup', 'zoning']
      }),
      attack('core_ram', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'dash_through', speed: 356, crossPlayer: true },
        animation: anim('core_ram'),
        strategyTags: ['gap_close', 'punish']
      }),
      attack('override_cascade', {
        facingPolicy: 'lock_at_windup',
        motion: { kind: 'slam_to_floor', jumpVelocityY: -230, diveSpeed: 450 },
        animation: anim('override_cascade', 'cascade_land'),
        strategyTags: ['finisher', 'zoning'],
        landingMs: 260
      })
    )
  }
}

export function getBossCombatProfile(bossId: BossId): BossCombatProfile {
  return BOSS_COMBAT_PROFILES[bossId]
}

export function getBossAttackCombatProfile(
  bossId: BossId,
  attackId: string
): BossAttackCombatProfile | undefined {
  return BOSS_COMBAT_PROFILES[bossId]?.attacks[attackId]
}

export function resolveBossAttackLifecycle(
  elapsedMs: number,
  timing: { windupTime: number; activeTime: number; recoveryTime: number },
  landingMs = 0
): BossAttackLifecyclePhase {
  const elapsed = Math.max(0, elapsedMs)
  if (elapsed < timing.windupTime) return 'windup'
  if (elapsed < timing.windupTime + timing.activeTime) return 'active'
  if (elapsed < timing.windupTime + timing.activeTime + timing.recoveryTime) return 'recovery'
  if (elapsed < timing.windupTime + timing.activeTime + timing.recoveryTime + landingMs) return 'landing'
  return 'done'
}

export function resolveBossAnchorX(
  fractions: number[],
  minX: number,
  maxX: number,
  playerX: number,
  preferOppositeSide = true
): number {
  const width = Math.max(0, maxX - minX)
  const anchors = fractions.map((fraction) => minX + Math.max(0, Math.min(1, fraction)) * width)
  if (anchors.length === 0) return minX + width / 2
  const sorted = [...anchors].sort((a, b) =>
    preferOppositeSide ? Math.abs(b - playerX) - Math.abs(a - playerX) : Math.abs(a - playerX) - Math.abs(b - playerX)
  )
  return sorted[0]
}
