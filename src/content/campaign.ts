import { IDENTITY } from './identity'
import type { BossId, WeaponId } from '../bosses/types'
import type { EnemyLevelMarker } from '../enemy/types'
import type { SaveData } from '../systems/Save'
import {
  BOSS_ROOM_VIEWPORT_WIDTH,
  buildDefaultBossRoom,
  filterBossRoomEnemies,
  filterBossRoomHazards,
  filterBossRoomPlatforms,
  type StageBackgroundDefinition,
  type StageBossRoomDefinition
} from './stageArenaLayout'
import { getStageBackgroundDefinition } from './stageBackgroundCatalog'

export type CampaignStageKind = 'tutorial' | 'robot_master' | 'final'

export type StagePlatformDefinition = {
  id: string
  x: number
  y: number
  width: number
  height?: number
  type?: 'solid' | 'oneWay' | 'passThrough'
  color?: number
  motion?: {
    toX: number
    duration: number
    yoyo?: boolean
    repeat?: number
    ease?: string
  }
}

export type StageArenaDefinition = {
  width?: number
  allowFallOff: boolean
  leftWall: boolean
  rightWall: boolean
  backgroundColor?: string
  background: StageBackgroundDefinition
  spawn: { x: number; y: number }
  bossSpawn: { x: number; y: number }
  bossRoom: StageBossRoomDefinition
  checkpoints: Array<{ id: string; x: number; y: number; triggerX: number; radioSequenceId?: string }>
  hazards: Array<{ id: string; x: number; y: number }>
  midPlatforms: StagePlatformDefinition[]
}

export type CampaignStageDefinition = {
  id: string
  district: string
  difficultyRating: 1 | 2 | 3
  kind: CampaignStageKind
  bossId: BossId
  runtimeBossConfigId?: string
  title: string
  selectLabel: string
  introCallout: string
  description: string
  arenaLabel: string
  rewardWeaponId?: WeaponId
  rewardEnabled: boolean
  enemyMarkers: EnemyLevelMarker[]
  arena: StageArenaDefinition
}

export type StageContentRetentionReport = {
  stageId: string
  routeWidth: number
  worldWidth: number
  bossRoomX: number
  authored: {
    enemies: number
    hazards: number
    platforms: number
    checkpoints: number
  }
  retained: {
    enemies: number
    hazards: number
    platforms: number
    checkpoints: number
  }
}

export const GROUNDED_PLAYER_SPAWN_Y = 214

const STAGE_CONTENT_RETENTION = new Map<string, StageContentRetentionReport>()

function checkpoint(id: string, x: number, y: number, triggerX: number) {
  return { id, x, y, triggerX }
}

function marker(
  id: string,
  typeKey: EnemyLevelMarker['typeKey'],
  x: number,
  y: number,
  patrolMinX?: number,
  patrolMaxX?: number,
  runtime?: Partial<
    Pick<EnemyLevelMarker, 'spawnTriggerX' | 'spawnLeadX' | 'retireTriggerX' | 'persistent'>
  >
): EnemyLevelMarker {
  return { id, typeKey, x, y, patrolMinX, patrolMaxX, ...runtime }
}

const EMPTY_BACKGROUND: StageBackgroundDefinition = {
  baseColor: '#0b1220',
  layers: []
}

const EMPTY_BOSS_ROOM: StageBossRoomDefinition = {
  x: 0,
  width: 448,
  leftInset: 24,
  rightInset: 24,
  playerIntroX: 72,
  bossSpawnX: 352,
  lockCamera: true
}

export const TUTORIAL_STAGE_ID = 'tutorial_sentinel'
export const FINAL_STAGE_ID = 'omega_fortress'

export const ROBOT_MASTER_STAGE_IDS = [
  'pyro_maw',
  'tide_reaver',
  'volt_hopper',
  'basalt_titan',
  'ferro_blade',
  'mire_wraith',
  'gale_vixen',
  'glacier_ronin'
] as const

export type RobotMasterStageId = (typeof ROBOT_MASTER_STAGE_IDS)[number]
export type CampaignStageId = typeof TUTORIAL_STAGE_ID | typeof FINAL_STAGE_ID | RobotMasterStageId

export const CAMPAIGN_STAGES: Record<CampaignStageId, CampaignStageDefinition> = {
  tutorial_sentinel: {
    district: 'Drill Hangar', difficultyRating: 1,
    id: TUTORIAL_STAGE_ID,
    kind: 'tutorial',
    bossId: 'sentinel_rook',
    title: 'Tutorial: Sentinel Drill',
    selectLabel: 'TUTORIAL',
    introCallout: 'SYSTEMS CHECK',
    description: 'Short onboarding route for movement, jumps, shooting, and the first boss.',
    arenaLabel: 'Drill Hangar',
    rewardEnabled: false,
    enemyMarkers: [
      marker('tutorial_gunner', 'enemy_gunner_bot', 136, 185, 110, 176, {
        spawnTriggerX: 52,
        retireTriggerX: 204
      }),
      marker('tutorial_hopper', 'enemy_shock_hopper', 220, 185, undefined, undefined, {
        spawnTriggerX: 96,
        retireTriggerX: 282
      }),
      marker('tutorial_drone', 'enemy_drone', 308, 126, undefined, undefined, {
        spawnTriggerX: 144,
        retireTriggerX: 360
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#0e1622',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 400, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [
        checkpoint('tutorial_start', 44, 40, 0),
        checkpoint('tutorial_boss_gate', 132, 40, 160)
      ],
      hazards: [{ id: 'tutorial_spike_1', x: 240, y: 230 }],
      midPlatforms: [
        { id: 'tutorial_mid_1', x: 150, y: 176, width: 56, type: 'oneWay', color: 0x304a6d },
        { id: 'tutorial_mid_2', x: 236, y: 138, width: 56, type: 'oneWay', color: 0x304a6d }
      ]
    }
  },
  pyro_maw: {
    district: 'Heat Works', difficultyRating: 1,
    id: 'pyro_maw',
    kind: 'robot_master',
    bossId: 'pyro_maw',
    title: IDENTITY.WARDEN_NAMES.pyro_maw,
    selectLabel: IDENTITY.WARDEN_NAMES.pyro_maw.toUpperCase(),
    introCallout: 'SMELTER INFERNO',
    description: 'Dense ground patrols and heat vents teach dash timing and careful spacing.',
    arenaLabel: 'Smelter Crucible',
    rewardWeaponId: 'FlameSerpent',
    rewardEnabled: true,
    enemyMarkers: [
      marker('pyro_slicer', 'enemy_slicer_bot', 160, 185, 132, 204, {
        spawnTriggerX: 104,
        retireTriggerX: 240
      }),
      marker('pyro_mine', 'enemy_mine_bot', 232, 185, undefined, undefined, {
        spawnTriggerX: 128,
        retireTriggerX: 300
      }),
      marker('pyro_rocket', 'enemy_rocket_bot', 324, 185, undefined, undefined, {
        spawnTriggerX: 150,
        retireTriggerX: 380
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#180d0b',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('pyro_start', 44, 40, 0), checkpoint('pyro_mid', 152, 40, 170)],
      hazards: [
        { id: 'pyro_lava_1', x: 118, y: 230 },
        { id: 'pyro_lava_2', x: 302, y: 230 }
      ],
      midPlatforms: [
        { id: 'pyro_mid_1', x: 180, y: 170, width: 54, type: 'oneWay', color: 0x6c3520 },
        { id: 'pyro_mid_2', x: 250, y: 132, width: 60, type: 'oneWay', color: 0x6c3520 }
      ]
    }
  },
  tide_reaver: {
    district: 'Water District', difficultyRating: 2,
    id: 'tide_reaver',
    kind: 'robot_master',
    bossId: 'tide_reaver',
    title: IDENTITY.WARDEN_NAMES.tide_reaver,
    selectLabel: IDENTITY.WARDEN_NAMES.tide_reaver.toUpperCase(),
    introCallout: 'PRESSURE LOCK',
    description: 'Vertical one-way platforms and ranged enemies reward short-hop accuracy.',
    arenaLabel: 'Reservoir Lock',
    rewardWeaponId: 'HydroLance',
    rewardEnabled: true,
    enemyMarkers: [
      marker('tide_drone', 'enemy_drone', 152, 150, undefined, undefined, {
        spawnTriggerX: 60,
        retireTriggerX: 214
      }),
      marker('tide_gunner', 'enemy_gunner_bot', 236, 185, 210, 286, {
        spawnTriggerX: 100,
        retireTriggerX: 308
      }),
      marker('tide_rocket', 'enemy_rocket_bot', 330, 185, undefined, undefined, {
        spawnTriggerX: 166,
        retireTriggerX: 388
      })
    ],
    arena: {
      allowFallOff: true,
      leftWall: false,
      rightWall: false,
      backgroundColor: '#081622',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('tide_start', 44, 40, 0), checkpoint('tide_mid', 156, 40, 185)],
      hazards: [{ id: 'tide_spike_1', x: 206, y: 230 }],
      midPlatforms: [
        { id: 'tide_mid_1', x: 150, y: 176, width: 50, type: 'oneWay', color: 0x214c77 },
        { id: 'tide_mid_2', x: 210, y: 144, width: 44, type: 'oneWay', color: 0x214c77 },
        { id: 'tide_mid_3', x: 268, y: 112, width: 44, type: 'oneWay', color: 0x214c77 }
      ]
    }
  },
  volt_hopper: {
    district: 'Power District', difficultyRating: 2,
    id: 'volt_hopper',
    kind: 'robot_master',
    bossId: 'volt_hopper',
    title: IDENTITY.WARDEN_NAMES.volt_hopper,
    selectLabel: IDENTITY.WARDEN_NAMES.volt_hopper.toUpperCase(),
    introCallout: 'GRID SURGE',
    description: 'Fast lane swaps and aerial threats create the most mobility-heavy midgame stage.',
    arenaLabel: 'Conduit Lattice',
    rewardWeaponId: 'ThunderSpike',
    rewardEnabled: true,
    enemyMarkers: [
      marker('volt_eye', 'enemy_laser_eye', 152, 136, undefined, undefined, {
        spawnTriggerX: 54,
        retireTriggerX: 214
      }),
      marker('volt_bouncer', 'enemy_bouncer', 228, 185, 210, 258, {
        spawnTriggerX: 104,
        retireTriggerX: 286
      }),
      marker('volt_drone', 'enemy_shield_drone', 312, 116, undefined, undefined, {
        spawnTriggerX: 146,
        retireTriggerX: 368
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#0c1020',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('volt_start', 44, 40, 0), checkpoint('volt_mid', 154, 40, 172)],
      hazards: [
        { id: 'volt_spike_1', x: 132, y: 230 },
        { id: 'volt_spike_2', x: 320, y: 230 }
      ],
      midPlatforms: [
        { id: 'volt_mid_1', x: 166, y: 170, width: 54, type: 'oneWay', color: 0x314b86 },
        { id: 'volt_mid_2', x: 242, y: 132, width: 54, type: 'oneWay', color: 0x314b86, motion: { toX: 292, duration: 1800 } }
      ]
    }
  },
  basalt_titan: {
    district: 'Structural Works', difficultyRating: 2,
    id: 'basalt_titan',
    kind: 'robot_master',
    bossId: 'basalt_titan',
    title: IDENTITY.WARDEN_NAMES.basalt_titan,
    selectLabel: IDENTITY.WARDEN_NAMES.basalt_titan.toUpperCase(),
    introCallout: 'QUARRY IMPACT',
    description: 'Heavy enemies and cramped footing emphasize careful spacing and knockback control.',
    arenaLabel: 'Quarry Shaft',
    rewardWeaponId: 'QuakeKnuckle',
    rewardEnabled: true,
    enemyMarkers: [
      marker('basalt_armored', 'enemy_armored_bot', 150, 185, 124, 186, {
        spawnTriggerX: 58,
        retireTriggerX: 222
      }),
      marker('basalt_bouncer', 'enemy_bouncer', 230, 185, 212, 258, {
        spawnTriggerX: 116,
        retireTriggerX: 294
      }),
      marker('basalt_mine', 'enemy_mine_bot', 316, 185, undefined, undefined, {
        spawnTriggerX: 156,
        retireTriggerX: 378
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#15100c',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('basalt_start', 44, 40, 0), checkpoint('basalt_mid', 146, 40, 165)],
      hazards: [{ id: 'basalt_spike_1', x: 216, y: 230 }],
      midPlatforms: [
        { id: 'basalt_mid_1', x: 182, y: 170, width: 48, type: 'oneWay', color: 0x4b3c29 },
        { id: 'basalt_mid_2', x: 256, y: 146, width: 58, type: 'solid', color: 0x4b3c29 }
      ]
    }
  },
  ferro_blade: {
    district: 'Transit Security', difficultyRating: 2,
    id: 'ferro_blade',
    kind: 'robot_master',
    bossId: 'ferro_blade',
    title: IDENTITY.WARDEN_NAMES.ferro_blade,
    selectLabel: IDENTITY.WARDEN_NAMES.ferro_blade.toUpperCase(),
    introCallout: 'CUTTER FORGE',
    description: 'Projectile lanes and narrow platforms reward deliberate weapon usage.',
    arenaLabel: 'Forge Catwalk',
    rewardWeaponId: 'MagcutDisc',
    rewardEnabled: true,
    enemyMarkers: [
      marker('ferro_gunner', 'enemy_gunner_bot', 144, 185, 118, 186, {
        spawnTriggerX: 56,
        retireTriggerX: 210
      }),
      marker('ferro_turret', 'enemy_frost_turret', 244, 149, undefined, undefined, {
        spawnTriggerX: 106,
        retireTriggerX: 304
      }),
      marker('ferro_eye', 'enemy_laser_eye', 326, 149, undefined, undefined, {
        spawnTriggerX: 150,
        retireTriggerX: 384
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#12131a',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('ferro_start', 44, 40, 0), checkpoint('ferro_mid', 158, 40, 188)],
      hazards: [
        { id: 'ferro_spike_1', x: 168, y: 230 },
        { id: 'ferro_spike_2', x: 248, y: 230 }
      ],
      midPlatforms: [
        { id: 'ferro_mid_1', x: 146, y: 172, width: 44, type: 'solid', color: 0x3d4659 },
        { id: 'ferro_mid_2', x: 246, y: 132, width: 52, type: 'oneWay', color: 0x3d4659 }
      ]
    }
  },
  mire_wraith: {
    district: 'Medicine District', difficultyRating: 3,
    id: 'mire_wraith',
    kind: 'robot_master',
    bossId: 'mire_wraith',
    title: IDENTITY.WARDEN_NAMES.mire_wraith,
    selectLabel: IDENTITY.WARDEN_NAMES.mire_wraith.toUpperCase(),
    introCallout: 'BIOHAZARD LAB',
    description: 'Persistent threat zones and floating enemies pressure route planning.',
    arenaLabel: 'Waste Labyrinth',
    rewardWeaponId: 'AcidGlob',
    rewardEnabled: true,
    enemyMarkers: [
      marker('mire_fly', 'enemy_fly_trap', 150, 164, undefined, undefined, {
        spawnTriggerX: 58,
        retireTriggerX: 214
      }),
      marker('mire_mine', 'enemy_mine_bot', 236, 185, undefined, undefined, {
        spawnTriggerX: 108,
        retireTriggerX: 304
      }),
      marker('mire_shield', 'enemy_shield_drone', 322, 126, undefined, undefined, {
        spawnTriggerX: 150,
        retireTriggerX: 384
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#0d140f',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('mire_start', 44, 40, 0), checkpoint('mire_mid', 150, 40, 178)],
      hazards: [{ id: 'mire_spike_1', x: 286, y: 230 }],
      midPlatforms: [
        { id: 'mire_mid_1', x: 174, y: 178, width: 50, type: 'oneWay', color: 0x2a5b38 },
        { id: 'mire_mid_2', x: 240, y: 140, width: 50, type: 'oneWay', color: 0x2a5b38 }
      ]
    }
  },
  gale_vixen: {
    district: 'Weather District', difficultyRating: 3,
    id: 'gale_vixen',
    kind: 'robot_master',
    bossId: 'gale_vixen',
    title: IDENTITY.WARDEN_NAMES.gale_vixen,
    selectLabel: IDENTITY.WARDEN_NAMES.gale_vixen.toUpperCase(),
    introCallout: 'JETSTREAM RUN',
    description: 'Air space control and moving platforms make this stage the hardest mobility test.',
    arenaLabel: 'Sky Dock',
    rewardWeaponId: 'AeroDarts',
    rewardEnabled: true,
    enemyMarkers: [
      marker('gale_drone', 'enemy_drone', 148, 104, undefined, undefined, {
        spawnTriggerX: 62,
        retireTriggerX: 214
      }),
      marker('gale_shield', 'enemy_shield_drone', 234, 138, undefined, undefined, {
        spawnTriggerX: 114,
        retireTriggerX: 312
      }),
      marker('gale_eye', 'enemy_laser_eye', 324, 142, undefined, undefined, {
        spawnTriggerX: 156,
        retireTriggerX: 384
      })
    ],
    arena: {
      allowFallOff: true,
      leftWall: false,
      rightWall: false,
      backgroundColor: '#0d1520',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('gale_start', 44, 40, 0), checkpoint('gale_mid', 150, 40, 186)],
      hazards: [{ id: 'gale_spike_1', x: 118, y: 230 }],
      midPlatforms: [
        { id: 'gale_mid_1', x: 154, y: 180, width: 44, type: 'oneWay', color: 0x31516c },
        { id: 'gale_mid_2', x: 226, y: 150, width: 44, type: 'oneWay', color: 0x31516c, motion: { toX: 286, duration: 1400 } },
        { id: 'gale_mid_3', x: 306, y: 120, width: 44, type: 'oneWay', color: 0x31516c }
      ]
    }
  },
  glacier_ronin: {
    district: 'Public Archives', difficultyRating: 3,
    id: 'glacier_ronin',
    kind: 'robot_master',
    bossId: 'glacier_ronin',
    title: IDENTITY.WARDEN_NAMES.glacier_ronin,
    selectLabel: IDENTITY.WARDEN_NAMES.glacier_ronin.toUpperCase(),
    introCallout: 'SHARD KEEPER',
    description: 'Careful footing, ranged pressure, and precise jumps close out the robot master loop.',
    arenaLabel: 'Cryo Keep',
    rewardWeaponId: 'FrostShatter',
    rewardEnabled: true,
    enemyMarkers: [
      marker('glacier_drone', 'enemy_drone', 152, 126, undefined, undefined, {
        spawnTriggerX: 64,
        retireTriggerX: 222
      }),
      marker('glacier_gunner', 'enemy_gunner_bot', 238, 185, 216, 282, {
        spawnTriggerX: 112,
        retireTriggerX: 304
      }),
      marker('glacier_turret', 'enemy_frost_turret', 322, 149, undefined, undefined, {
        spawnTriggerX: 154,
        retireTriggerX: 384
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#0c1420',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('glacier_start', 44, 40, 0), checkpoint('glacier_mid', 150, 40, 184)],
      hazards: [
        { id: 'glacier_spike_1', x: 196, y: 230 },
        { id: 'glacier_spike_2', x: 300, y: 230 }
      ],
      midPlatforms: [
        { id: 'glacier_mid_1', x: 168, y: 174, width: 48, type: 'oneWay', color: 0x4e79a6 },
        { id: 'glacier_mid_2', x: 246, y: 136, width: 52, type: 'oneWay', color: 0x4e79a6 }
      ]
    }
  },
  omega_fortress: {
    district: 'Central Core', difficultyRating: 3,
    id: FINAL_STAGE_ID,
    kind: 'final',
    bossId: 'omega_core',
    runtimeBossConfigId: 'omega_core',
    title: 'Omega Fortress',
    selectLabel: 'FINAL',
    introCallout: IDENTITY.ANTAGONIST_NAME,
    description: 'Remixed final route that cashes in on the full unlocked toolkit and ends the campaign.',
    arenaLabel: 'Omega Citadel',
    rewardEnabled: false,
    enemyMarkers: [
      marker('omega_armored', 'enemy_armored_bot', 142, 185, 116, 176, {
        spawnTriggerX: 56,
        retireTriggerX: 214
      }),
      marker('omega_shield', 'enemy_shield_drone', 220, 116, undefined, undefined, {
        spawnTriggerX: 102,
        retireTriggerX: 284
      }),
      marker('omega_bouncer', 'enemy_bouncer', 292, 185, undefined, undefined, {
        spawnTriggerX: 138,
        retireTriggerX: 348
      }),
      marker('omega_laser', 'enemy_laser_eye', 350, 148, undefined, undefined, {
        spawnTriggerX: 162,
        retireTriggerX: 400
      })
    ],
    arena: {
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      backgroundColor: '#100b18',
      background: EMPTY_BACKGROUND,
      spawn: { x: 44, y: 40 },
      bossSpawn: { x: 398, y: 184 },
      bossRoom: EMPTY_BOSS_ROOM,
      checkpoints: [checkpoint('omega_start', 44, 40, 0), checkpoint('omega_mid', 164, 40, 192)],
      hazards: [
        { id: 'omega_spike_1', x: 132, y: 230 },
        { id: 'omega_spike_2', x: 320, y: 230 }
      ],
      midPlatforms: [
        { id: 'omega_mid_1', x: 162, y: 178, width: 54, type: 'oneWay', color: 0x4b3868 },
        { id: 'omega_mid_2', x: 244, y: 138, width: 58, type: 'oneWay', color: 0x4b3868, motion: { toX: 304, duration: 1600 } },
        { id: 'omega_mid_3', x: 334, y: 112, width: 42, type: 'oneWay', color: 0x4b3868 }
      ]
    }
  }
}

type StageExtensionPatch = {
  width: number
  bossSpawnX: number
  checkpoints: Array<{ id: string; x: number; y: number; triggerX: number }>
  hazards?: Array<{ id: string; x: number; y: number }>
  midPlatforms?: StagePlatformDefinition[]
  enemyMarkers?: EnemyLevelMarker[]
}

const STAGE_EXTENSION_PATCHES: Partial<Record<CampaignStageId, StageExtensionPatch>> = {
  tutorial_sentinel: {
    width: 640,
    bossSpawnX: 574,
    checkpoints: [
      checkpoint('tutorial_start', 44, 40, 0),
      checkpoint('tutorial_mid', 214, 40, 230),
      checkpoint('tutorial_boss_gate', 402, 40, 488)
    ],
    hazards: [
      { id: 'tutorial_spike_2', x: 434, y: 230 }
    ],
    midPlatforms: [
      { id: 'tutorial_mid_3', x: 352, y: 166, width: 52, type: 'oneWay', color: 0x304a6d },
      { id: 'tutorial_mid_4', x: 448, y: 132, width: 52, type: 'oneWay', color: 0x304a6d }
    ],
    enemyMarkers: [
      marker('tutorial_shield', 'enemy_shield_drone', 424, 142, undefined, undefined, {
        spawnTriggerX: 248,
        retireTriggerX: 506
      }),
      marker('tutorial_rocket', 'enemy_rocket_bot', 510, 185, undefined, undefined, {
        spawnTriggerX: 332,
        retireTriggerX: 592
      })
    ]
  },
  pyro_maw: {
    width: 928,
    bossSpawnX: 844,
    checkpoints: [
      checkpoint('pyro_start', 44, 40, 0),
      checkpoint('pyro_mid_a', 214, 40, 232),
      checkpoint('pyro_mid_b', 458, 40, 488),
      checkpoint('pyro_mid_c', 616, 40, 662),
      checkpoint('pyro_boss_gate', 760, 40, 808)
    ],
    hazards: [
      { id: 'pyro_lava_3', x: 502, y: 230 },
      { id: 'pyro_lava_4', x: 726, y: 230 }
    ],
    midPlatforms: [
      { id: 'pyro_mid_3', x: 430, y: 176, width: 56, type: 'oneWay', color: 0x6c3520 },
      { id: 'pyro_mid_4', x: 548, y: 146, width: 62, type: 'solid', color: 0x6c3520, motion: { toX: 598, duration: 2200 } },
      { id: 'pyro_mid_5', x: 690, y: 126, width: 56, type: 'oneWay', color: 0x6c3520 },
      { id: 'pyro_mid_6', x: 812, y: 154, width: 48, type: 'oneWay', color: 0x6c3520 }
    ],
    enemyMarkers: [
      marker('pyro_bouncer_late', 'enemy_bouncer', 438, 185, undefined, undefined, {
        spawnTriggerX: 252,
        retireTriggerX: 530
      }),
      marker('pyro_armored_late', 'enemy_armored_bot', 586, 185, 556, 640, {
        spawnTriggerX: 372,
        retireTriggerX: 686
      }),
      marker('pyro_drone_late', 'enemy_drone', 734, 128, undefined, undefined, {
        spawnTriggerX: 520,
        retireTriggerX: 818
      }),
      marker('pyro_shield_gate', 'enemy_shield_drone', 828, 140, undefined, undefined, {
        spawnTriggerX: 646,
        retireTriggerX: 900
      })
    ]
  },
  tide_reaver: {
    width: 928,
    bossSpawnX: 844,
    checkpoints: [
      checkpoint('tide_start', 44, 40, 0),
      checkpoint('tide_mid_a', 194, 40, 224),
      checkpoint('tide_mid_b', 430, 40, 470),
      checkpoint('tide_mid_c', 588, 40, 634),
      checkpoint('tide_boss_gate', 748, 40, 806)
    ],
    hazards: [
      { id: 'tide_spike_2', x: 502, y: 230 },
      { id: 'tide_spike_3', x: 688, y: 230 }
    ],
    midPlatforms: [
      { id: 'tide_mid_4', x: 402, y: 182, width: 48, type: 'oneWay', color: 0x214c77 },
      { id: 'tide_mid_5', x: 492, y: 150, width: 46, type: 'oneWay', color: 0x214c77, motion: { toX: 544, duration: 2100 } },
      { id: 'tide_mid_6', x: 598, y: 118, width: 46, type: 'oneWay', color: 0x214c77 },
      { id: 'tide_mid_7', x: 706, y: 150, width: 52, type: 'oneWay', color: 0x214c77 },
      { id: 'tide_mid_8', x: 818, y: 126, width: 48, type: 'oneWay', color: 0x214c77 }
    ],
    enemyMarkers: [
      marker('tide_hopper_late', 'enemy_shock_hopper', 432, 185, undefined, undefined, {
        spawnTriggerX: 256,
        retireTriggerX: 510
      }),
      marker('tide_shield_late', 'enemy_shield_drone', 560, 126, undefined, undefined, {
        spawnTriggerX: 378,
        retireTriggerX: 662
      }),
      marker('tide_fly_late', 'enemy_fly_trap', 724, 150, undefined, undefined, {
        spawnTriggerX: 534,
        retireTriggerX: 814
      }),
      marker('tide_mine_gate', 'enemy_mine_bot', 820, 185, undefined, undefined, {
        spawnTriggerX: 642,
        retireTriggerX: 904
      })
    ]
  },
  volt_hopper: {
    width: 928,
    bossSpawnX: 844,
    checkpoints: [
      checkpoint('volt_start', 44, 40, 0),
      checkpoint('volt_mid_a', 212, 40, 230),
      checkpoint('volt_mid_b', 462, 40, 500),
      checkpoint('volt_mid_c', 618, 40, 656),
      checkpoint('volt_boss_gate', 742, 40, 790)
    ],
    hazards: [
      { id: 'volt_spike_3', x: 478, y: 230 },
      { id: 'volt_spike_4', x: 748, y: 230 }
    ],
    midPlatforms: [
      { id: 'volt_mid_3', x: 420, y: 176, width: 56, type: 'oneWay', color: 0x314b86 },
      { id: 'volt_mid_4', x: 538, y: 144, width: 56, type: 'oneWay', color: 0x314b86, motion: { toX: 606, duration: 2600 } },
      { id: 'volt_mid_5', x: 688, y: 118, width: 50, type: 'oneWay', color: 0x314b86 }
    ],
    enemyMarkers: [
      marker('volt_turret_late', 'enemy_frost_turret', 440, 149, undefined, undefined, {
        spawnTriggerX: 260,
        retireTriggerX: 536
      }),
      marker('volt_drone_late', 'enemy_drone', 586, 110, undefined, undefined, {
        spawnTriggerX: 398,
        retireTriggerX: 682
      }),
      marker('volt_rocket_late', 'enemy_rocket_bot', 742, 185, undefined, undefined, {
        spawnTriggerX: 582,
        retireTriggerX: 828
      })
    ]
  },
  basalt_titan: {
    width: 928,
    bossSpawnX: 844,
    checkpoints: [
      checkpoint('basalt_start', 44, 40, 0),
      checkpoint('basalt_mid_a', 208, 40, 224),
      checkpoint('basalt_mid_b', 454, 40, 492),
      checkpoint('basalt_mid_c', 606, 40, 650),
      checkpoint('basalt_boss_gate', 750, 40, 804)
    ],
    hazards: [
      { id: 'basalt_spike_2', x: 520, y: 230 },
      { id: 'basalt_spike_3', x: 714, y: 230 }
    ],
    midPlatforms: [
      { id: 'basalt_mid_3', x: 430, y: 176, width: 48, type: 'solid', color: 0x4b3c29 },
      { id: 'basalt_mid_4', x: 570, y: 154, width: 58, type: 'oneWay', color: 0x4b3c29, motion: { toX: 622, duration: 2300 } },
      { id: 'basalt_mid_5', x: 710, y: 132, width: 60, type: 'solid', color: 0x4b3c29 },
      { id: 'basalt_mid_6', x: 826, y: 164, width: 52, type: 'solid', color: 0x4b3c29 }
    ],
    enemyMarkers: [
      marker('basalt_bouncer_late', 'enemy_bouncer', 444, 185, undefined, undefined, {
        spawnTriggerX: 256,
        retireTriggerX: 536
      }),
      marker('basalt_armored_late_2', 'enemy_armored_bot', 602, 185, 574, 646, {
        spawnTriggerX: 418,
        retireTriggerX: 700
      }),
      marker('basalt_hopper_late', 'enemy_shock_hopper', 742, 185, undefined, undefined, {
        spawnTriggerX: 564,
        retireTriggerX: 832
      }),
      marker('basalt_eye_gate', 'enemy_laser_eye', 836, 144, undefined, undefined, {
        spawnTriggerX: 648,
        retireTriggerX: 910
      })
    ]
  },
  ferro_blade: {
    width: 928,
    bossSpawnX: 844,
    checkpoints: [
      checkpoint('ferro_start', 44, 40, 0),
      checkpoint('ferro_mid_a', 212, 40, 240),
      checkpoint('ferro_mid_b', 452, 40, 490),
      checkpoint('ferro_mid_c', 606, 40, 652),
      checkpoint('ferro_boss_gate', 748, 40, 804)
    ],
    hazards: [
      { id: 'ferro_spike_3', x: 492, y: 230 },
      { id: 'ferro_spike_4', x: 706, y: 230 }
    ],
    midPlatforms: [
      { id: 'ferro_mid_3', x: 432, y: 172, width: 48, type: 'solid', color: 0x3d4659 },
      { id: 'ferro_mid_4', x: 560, y: 146, width: 54, type: 'oneWay', color: 0x3d4659, motion: { toX: 614, duration: 2100 } },
      { id: 'ferro_mid_5', x: 696, y: 124, width: 52, type: 'oneWay', color: 0x3d4659 },
      { id: 'ferro_mid_6', x: 818, y: 154, width: 50, type: 'solid', color: 0x3d4659 }
    ],
    enemyMarkers: [
      marker('ferro_slicer_late', 'enemy_slicer_bot', 434, 185, 404, 478, {
        spawnTriggerX: 260,
        retireTriggerX: 522
      }),
      marker('ferro_eye_late', 'enemy_laser_eye', 584, 132, undefined, undefined, {
        spawnTriggerX: 408,
        retireTriggerX: 678
      }),
      marker('ferro_drone_late', 'enemy_shield_drone', 738, 126, undefined, undefined, {
        spawnTriggerX: 570,
        retireTriggerX: 820
      }),
      marker('ferro_bouncer_gate', 'enemy_bouncer', 826, 185, undefined, undefined, {
        spawnTriggerX: 654,
        retireTriggerX: 904
      })
    ]
  },
  mire_wraith: {
    width: 928,
    bossSpawnX: 844,
    checkpoints: [
      checkpoint('mire_start', 44, 40, 0),
      checkpoint('mire_mid_a', 202, 40, 224),
      checkpoint('mire_mid_b', 450, 40, 488),
      checkpoint('mire_mid_c', 606, 40, 652),
      checkpoint('mire_boss_gate', 746, 40, 804)
    ],
    hazards: [
      { id: 'mire_spike_2', x: 508, y: 230 },
      { id: 'mire_spike_3', x: 706, y: 230 }
    ],
    midPlatforms: [
      { id: 'mire_mid_3', x: 410, y: 176, width: 50, type: 'oneWay', color: 0x2a5b38 },
      { id: 'mire_mid_4', x: 532, y: 142, width: 48, type: 'oneWay', color: 0x2a5b38, motion: { toX: 590, duration: 2150 } },
      { id: 'mire_mid_5', x: 676, y: 118, width: 48, type: 'oneWay', color: 0x2a5b38 },
      { id: 'mire_mid_6', x: 812, y: 144, width: 52, type: 'oneWay', color: 0x2a5b38 }
    ],
    enemyMarkers: [
      marker('mire_drone_late', 'enemy_drone', 440, 120, undefined, undefined, {
        spawnTriggerX: 258,
        retireTriggerX: 520
      }),
      marker('mire_fly_late', 'enemy_fly_trap', 578, 166, undefined, undefined, {
        spawnTriggerX: 418,
        retireTriggerX: 676
      }),
      marker('mire_bouncer_late', 'enemy_bouncer', 734, 185, undefined, undefined, {
        spawnTriggerX: 566,
        retireTriggerX: 822
      }),
      marker('mire_shield_gate', 'enemy_shield_drone', 822, 132, undefined, undefined, {
        spawnTriggerX: 650,
        retireTriggerX: 902
      })
    ]
  },
  gale_vixen: {
    width: 960,
    bossSpawnX: 876,
    checkpoints: [
      checkpoint('gale_start', 44, 40, 0),
      checkpoint('gale_mid_a', 206, 40, 236),
      checkpoint('gale_mid_b', 472, 40, 522),
      checkpoint('gale_mid_c', 626, 40, 676),
      checkpoint('gale_boss_gate', 764, 40, 820)
    ],
    hazards: [
      { id: 'gale_spike_2', x: 506, y: 230 },
      { id: 'gale_spike_3', x: 786, y: 230 }
    ],
    midPlatforms: [
      { id: 'gale_mid_4', x: 420, y: 184, width: 44, type: 'oneWay', color: 0x31516c },
      { id: 'gale_mid_5', x: 540, y: 156, width: 44, type: 'oneWay', color: 0x31516c, motion: { toX: 620, duration: 2625 } },
      { id: 'gale_mid_6', x: 668, y: 126, width: 46, type: 'oneWay', color: 0x31516c },
      { id: 'gale_mid_7', x: 794, y: 150, width: 50, type: 'oneWay', color: 0x31516c }
    ],
    enemyMarkers: [
      marker('gale_drone_late', 'enemy_drone', 430, 104, undefined, undefined, {
        spawnTriggerX: 258,
        retireTriggerX: 512
      }),
      marker('gale_hopper_late', 'enemy_shock_hopper', 576, 185, undefined, undefined, {
        spawnTriggerX: 434,
        retireTriggerX: 662
      }),
      marker('gale_rocket_late', 'enemy_rocket_bot', 786, 166, undefined, undefined, {
        spawnTriggerX: 642,
        retireTriggerX: 868
      })
    ]
  },
  glacier_ronin: {
    width: 928,
    bossSpawnX: 844,
    checkpoints: [
      checkpoint('glacier_start', 44, 40, 0),
      checkpoint('glacier_mid_a', 210, 40, 232),
      checkpoint('glacier_mid_b', 454, 40, 500),
      checkpoint('glacier_mid_c', 610, 40, 654),
      checkpoint('glacier_boss_gate', 748, 40, 804)
    ],
    hazards: [
      { id: 'glacier_spike_3', x: 508, y: 230 },
      { id: 'glacier_spike_4', x: 752, y: 230 }
    ],
    midPlatforms: [
      { id: 'glacier_mid_3', x: 430, y: 176, width: 50, type: 'oneWay', color: 0x4e79a6 },
      { id: 'glacier_mid_4', x: 568, y: 144, width: 54, type: 'oneWay', color: 0x4e79a6, motion: { toX: 620, duration: 2575 } },
      { id: 'glacier_mid_5', x: 704, y: 122, width: 56, type: 'oneWay', color: 0x4e79a6 },
      { id: 'glacier_mid_6', x: 820, y: 150, width: 48, type: 'oneWay', color: 0x4e79a6 }
    ],
    enemyMarkers: [
      marker('glacier_eye_late', 'enemy_laser_eye', 434, 144, undefined, undefined, {
        spawnTriggerX: 258,
        retireTriggerX: 520
      }),
      marker('glacier_drone_late', 'enemy_shield_drone', 596, 118, undefined, undefined, {
        spawnTriggerX: 448,
        retireTriggerX: 684
      }),
      marker('glacier_mine_late', 'enemy_mine_bot', 738, 185, undefined, undefined, {
        spawnTriggerX: 576,
        retireTriggerX: 824
      }),
      marker('glacier_bouncer_gate', 'enemy_bouncer', 826, 185, undefined, undefined, {
        spawnTriggerX: 686,
        retireTriggerX: 906
      })
    ]
  },
  omega_fortress: {
    width: 1088,
    bossSpawnX: 996,
    checkpoints: [
      checkpoint('omega_start', 44, 40, 0),
      checkpoint('omega_mid_a', 250, 40, 274),
      checkpoint('omega_mid_b', 520, 40, 566),
      checkpoint('omega_mid_c', 772, 40, 828),
      checkpoint('omega_mid_d', 876, 40, 910),
      checkpoint('omega_boss_gate', 930, 40, 964)
    ],
    hazards: [
      { id: 'omega_spike_3', x: 522, y: 230 },
      { id: 'omega_spike_4', x: 838, y: 230 }
    ],
    midPlatforms: [
      { id: 'omega_mid_4', x: 438, y: 178, width: 54, type: 'oneWay', color: 0x4b3868 },
      { id: 'omega_mid_5', x: 588, y: 142, width: 58, type: 'oneWay', color: 0x4b3868, motion: { toX: 664, duration: 2600 } },
      { id: 'omega_mid_6', x: 748, y: 118, width: 50, type: 'oneWay', color: 0x4b3868 },
      { id: 'omega_mid_7', x: 892, y: 146, width: 56, type: 'oneWay', color: 0x4b3868 }
    ],
    enemyMarkers: [
      marker('omega_drone_late', 'enemy_drone', 470, 118, undefined, undefined, {
        spawnTriggerX: 278,
        retireTriggerX: 552
      }),
      marker('omega_fly_late', 'enemy_fly_trap', 626, 164, undefined, undefined, {
        spawnTriggerX: 432,
        retireTriggerX: 712
      }),
      marker('omega_rocket_late', 'enemy_rocket_bot', 802, 185, undefined, undefined, {
        spawnTriggerX: 646,
        retireTriggerX: 890
      }),
      marker('omega_armored_late_2', 'enemy_armored_bot', 920, 185, 892, 968, {
        spawnTriggerX: 786,
        retireTriggerX: 1018
      })
    ]
  }
}

for (const [stageId, patch] of Object.entries(STAGE_EXTENSION_PATCHES) as Array<[CampaignStageId, StageExtensionPatch]>) {
  const stage = CAMPAIGN_STAGES[stageId]
  if (!stage) {
    continue
  }

  stage.enemyMarkers = [...stage.enemyMarkers, ...(patch.enemyMarkers ?? [])]
  stage.arena = {
    ...stage.arena,
    width: patch.width,
    bossSpawn: {
      x: patch.bossSpawnX,
      y: stage.arena.bossSpawn.y
    },
    checkpoints: patch.checkpoints,
    hazards: [...stage.arena.hazards, ...(patch.hazards ?? [])],
    midPlatforms: [...stage.arena.midPlatforms, ...(patch.midPlatforms ?? [])]
  }
}

for (const stage of Object.values(CAMPAIGN_STAGES)) {
  if (stage.kind !== 'final') {
    stage.runtimeBossConfigId = stage.bossId
  }
  const routeWidth = Math.max(BOSS_ROOM_VIEWPORT_WIDTH, Number(stage.arena.width ?? BOSS_ROOM_VIEWPORT_WIDTH))
  const worldWidth = routeWidth + BOSS_ROOM_VIEWPORT_WIDTH
  const background = getStageBackgroundDefinition(stage.id)
  const relocatedBossSpawnX = stage.arena.bossSpawn.x + BOSS_ROOM_VIEWPORT_WIDTH
  const bossRoom = buildDefaultBossRoom(worldWidth, {
    bossSpawnX: relocatedBossSpawnX
  })
  const authored = {
    enemies: stage.enemyMarkers.length,
    hazards: stage.arena.hazards.length,
    platforms: stage.arena.midPlatforms.length,
    checkpoints: stage.arena.checkpoints.length
  }
  const retainedEnemies = filterBossRoomEnemies(stage.enemyMarkers, bossRoom)
  const retainedHazards = filterBossRoomHazards(stage.arena.hazards, bossRoom)
  const retainedPlatforms = filterBossRoomPlatforms(stage.arena.midPlatforms, bossRoom)
  const retained = {
    enemies: retainedEnemies.length,
    hazards: retainedHazards.length,
    platforms: retainedPlatforms.length,
    checkpoints: stage.arena.checkpoints.length
  }

  const invalidCheckpoint = stage.arena.checkpoints.find(
    (entry) => entry.x < 0 || entry.x >= bossRoom.x || entry.triggerX < 0 || entry.triggerX >= bossRoom.x
  )
  const lostContent = Object.keys(authored).find(
    (key) => authored[key as keyof typeof authored] !== retained[key as keyof typeof retained]
  )
  if (invalidCheckpoint || lostContent) {
    throw new Error(
      `[Campaign] Stage '${stage.id}' has content outside its ${routeWidth}px route budget` +
        (invalidCheckpoint ? ` (checkpoint '${invalidCheckpoint.id}')` : ` (${lostContent} truncated)`)
    )
  }

  stage.enemyMarkers = retainedEnemies
  stage.arena = {
    ...stage.arena,
    width: worldWidth,
    background,
    backgroundColor: background.baseColor,
    spawn: {
      ...stage.arena.spawn,
      y: GROUNDED_PLAYER_SPAWN_Y
    },
    bossSpawn: {
      x: bossRoom.bossSpawnX,
      y: stage.arena.bossSpawn.y
    },
    bossRoom,
    checkpoints: stage.arena.checkpoints.map((entry) => ({
      ...entry,
      y: GROUNDED_PLAYER_SPAWN_Y
    })),
    hazards: retainedHazards,
    midPlatforms: retainedPlatforms
  }
  STAGE_CONTENT_RETENTION.set(stage.id, {
    stageId: stage.id,
    routeWidth,
    worldWidth,
    bossRoomX: bossRoom.x,
    authored,
    retained
  })
}

export function getCampaignStage(id: string): CampaignStageDefinition {
  return CAMPAIGN_STAGES[id as CampaignStageId] ?? CAMPAIGN_STAGES.pyro_maw
}

export function getRobotMasterStages(): CampaignStageDefinition[] {
  return ROBOT_MASTER_STAGE_IDS.map((id) => CAMPAIGN_STAGES[id])
}

export function getSelectableBossStages(): CampaignStageDefinition[] {
  return [...getRobotMasterStages(), CAMPAIGN_STAGES[FINAL_STAGE_ID]]
}

export function isCampaignStageCleared(
  saveData: Pick<SaveData, 'clearedBosses' | 'finalBossCleared'>,
  stageId: string
): boolean {
  return stageId === FINAL_STAGE_ID
    ? Boolean(saveData.finalBossCleared)
    : saveData.clearedBosses.includes(stageId)
}

export function getStageContentRetentionReport(stageId: string): StageContentRetentionReport | null {
  const report = STAGE_CONTENT_RETENTION.get(stageId)
  return report
    ? {
        ...report,
        authored: { ...report.authored },
        retained: { ...report.retained }
      }
    : null
}

export function countClearedRobotMasters(saveData: Pick<SaveData, 'clearedBosses'>): number {
  return ROBOT_MASTER_STAGE_IDS.filter((stageId) => saveData.clearedBosses.includes(stageId)).length
}

export function isFinalRouteUnlocked(saveData: Pick<SaveData, 'clearedBosses' | 'tutorialCleared'>): boolean {
  return Boolean(saveData.tutorialCleared) && countClearedRobotMasters(saveData) >= ROBOT_MASTER_STAGE_IDS.length
}
