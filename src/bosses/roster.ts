import { IDENTITY } from '../content/identity'
import { BossBlueprint, BossId, WeaknessTable } from './types'

const PX = (w: number, h: number) => ({ x: w, y: h })

export const BOSS_ROSTER: Record<BossId, BossBlueprint> = {
  sentinel_rook: {
    id: 'sentinel_rook',
    codename: 'Sentinel ROOK',
    element: 'Normal',
    arena: 'Tutorial Drill Hangar',
    // The tutorial warden takes the Buster (and the saber) only (prompt 07 phase 7.3).
    damageProfile: { onlyWeapons: ['Buster'] },
    introCallout: 'AUTONOMOUS GATEKEEPER',
    theme: { primary: 0x7d8cff, accent: 0xfff0b3, glow: 0x96a2ff, trail: 0x4552d4 },
    baseStats: {
      maxHp: 100,
      contactDamage: 6,
      moveSpeed: 60,
      dashSpeed: 90,
      jumpHeight: 120
    },
    movementProfile: {
      weight: 'heavy',
      preferredRange: 'mid',
      mobilityNotes:
        'Short tutorial hops with heavy landing lag that teaches players timing windows.'
    },
    weaponReward: {
      id: 'ArcSlash',
      element: 'Normal',
      displayName: 'Arc Slash',
      energyCost: 2,
      maxEnergy: 24,
      description: 'Hold the sword to release a crescent wave that deletes minor shots.',
      tutorial: 'Hold the Sword button to charge the Arc Slash. Release to send a wave.'
    },
    attacks: [
      {
        name: 'Giga Hop',
        state: 'jump',
        description: 'A short, slow hop that aims to land near the player.',
        telegraph: { telegraphMs: 350, warningFx: 'wave', anchor: 'self' },
        executeMs: 600,
        cooldownMs: 900,
        movementCue: 'Applies upward velocity then eases toward player mid-air.'
      },
      {
        name: 'Guard Shot',
        state: 'shoot',
        description: 'Single pellet fired straight at the player. Used to tutorialize parries.',
        telegraph: { telegraphMs: 260, warningFx: 'fan-lines', anchor: 'target' },
        executeMs: 180,
        cooldownMs: 480,
        spawns: ['slow_bullet']
      },
      {
        name: 'Stomp Shock',
        state: 'special',
        description: 'Slow stomp that emits a low shockwave across the floor.',
        telegraph: { telegraphMs: 420, warningFx: 'glow', anchor: 'self' },
        executeMs: 320,
        cooldownMs: 1200,
        movementCue: 'Locks in place; after landing spawn ground ripple.',
        spawns: ['short_quake']
      }
    ],
    phases: [
      {
        name: 'Systems Nominal',
        shortName: 'NOMINAL',
        threshold: 1,
        enraged: false,
        description: 'Demonstrates hop, shot, and stomp slowly for onboarding.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Override Mode',
        shortName: 'OVERRIDE',
        threshold: 0.55,
        enraged: true,
        description: 'Combines stomp shock with hop follow-ups; shorter warning windows.',
        newAttacks: ['Stomp Shock'],
        retireAttacks: ['Giga Hop'],
        retimeAttacks: { 'Guard Shot': { telegraphMs: 200, cooldownMs: 380 } },
        cadenceMultiplier: 1.2
      }
    ],
    desperation: {
      name: 'Last Stand',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Rook Barrage.',
      cadenceMultiplier: 1.3,
      flashPalette: [0xffffff, 0x96a2ff, 0xfff0b3],
      attack: {
        name: 'Rook Barrage',
        state: 'shoot',
        description: 'Last-stand volley: a three-shot fan and a slow round behind it.',
        telegraph: { telegraphMs: 380, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 260,
        cooldownMs: 900,
        spawns: ['arc_shards', 'slow_bullet']
      }
    },
    spritePlan: {
      frame: PX(48, 48),
      origin: { x: 0.5, y: 0.9 },
      animations: [
        {
          atlas: 'rook',
          key: 'rook_idle',
          frames: 8,
          fps: 6,
          description: 'Idle breathing with antenna flicker.'
        },
        {
          atlas: 'rook',
          key: 'rook_hop',
          frames: 6,
          fps: 10,
          description: 'Prep crouch, launch, mid-air, and landing frames.'
        },
        {
          atlas: 'rook',
          key: 'rook_stomp',
          frames: 6,
          fps: 8,
          description: 'Heavy foot raise and slam with shockwave spawn frame.'
        },
        {
          atlas: 'rook',
          key: 'rook_shoot',
          frames: 4,
          fps: 12,
          description: 'Arm cannon raise with muzzle flash.'
        }
      ]
    }
  },
  pyro_maw: {
    id: 'pyro_maw',
    codename: IDENTITY.WARDEN_NAMES.pyro_maw.toUpperCase(),
    element: 'Fire',
    arena: 'Smelter Crucible',
    introCallout: 'INFERNAL ENGINE',
    theme: { primary: 0xff6b3b, accent: 0xffc857, glow: 0xff8b5a, trail: 0xff392b },
    baseStats: {
      maxHp: 120,
      contactDamage: 8,
      moveSpeed: 70,
      dashSpeed: 120,
      jumpHeight: 160
    },
    movementProfile: {
      weight: 'medium',
      preferredRange: 'mid',
      mobilityNotes: 'Serpentine slides with flame dashes leaving embers behind.'
    },
    weaponReward: {
      id: 'FlameSerpent',
      element: 'Fire',
      displayName: 'Flame Serpent',
      energyCost: 5,
      maxEnergy: 40,
      description: 'Hold to breathe a controllable flame stream that paints burning puddles.',
      tutorial: 'Hold the weapon button to extend the flame. Tap for a quick burst.'
    },
    attacks: [
      {
        name: 'Serpent Stream',
        shortName: 'SERPENT',
        state: 'shoot',
        description: 'Continuous flamethrower that sweeps horizontally.',
        telegraph: { telegraphMs: 320, warningFx: 'glow', anchor: 'self' },
        executeMs: 900,
        cooldownMs: 700,
        movementCue: 'Anchors feet; rotates torso following player.',
        spawns: ['flame_cone']
      },
      {
        name: 'Ignition Dash',
        shortName: 'IGNITION',
        state: 'dash',
        description: 'Ground dash leaving burning puddles that linger.',
        telegraph: { telegraphMs: 280, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 260,
        cooldownMs: 900,
        movementCue: 'Applies rapid horizontal velocity; spawns puddle each 24px.',
        spawns: ['burn_puddle']
      },
      {
        name: 'Blaze Lob',
        state: 'shoot',
        description: 'Lobs a fire orb that explodes into three arcs.',
        telegraph: { telegraphMs: 340, warningFx: 'reticle', anchor: 'projectile' },
        executeMs: 280,
        cooldownMs: 820,
        spawns: ['fire_orb', 'arc_shards']
      }
    ],
    phases: [
      {
        name: 'Combustion Stable',
        shortName: 'STABLE',
        threshold: 1,
        enraged: false,
        description: 'Alternates between lobs and flame streams with long pauses.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Thermal Runaway',
        shortName: 'THERMAL',
        threshold: 0.55,
        enraged: true,
        description: 'Ignition Dash leaves larger puddles; Serpent Stream sweeps faster.',
        newAttacks: ['Ignition Dash'],
        retireAttacks: ['Blaze Lob'],
        retimeAttacks: { 'Serpent Stream': { telegraphMs: 240, cooldownMs: 560 } },
        cadenceMultiplier: 1.35
      }
    ],
    desperation: {
      name: 'Meltdown',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Magma Geyser.',
      cadenceMultiplier: 1.45,
      flashPalette: [0xffffff, 0xff8b5a, 0xffc857],
      attack: {
        name: 'Magma Geyser',
        state: 'special',
        description: 'The floor under the hero erupts while a fire orb arcs in.',
        telegraph: { telegraphMs: 420, warningFx: 'wave', anchor: 'target' },
        executeMs: 360,
        cooldownMs: 1100,
        spawns: ['burn_puddle', 'fire_orb']
      }
    },
    spritePlan: {
      frame: PX(56, 48),
      origin: { x: 0.5, y: 0.88 },
      animations: [
        {
          atlas: 'pyro_maw',
          key: 'pyro_idle',
          frames: 10,
          fps: 8,
          description: 'Flame mane flicker with embers shedding downward.'
        },
        {
          atlas: 'pyro_maw',
          key: 'pyro_dash',
          frames: 6,
          fps: 14,
          description: 'Crouch, ignition, blurred slide frames with trailing fire.'
        },
        {
          atlas: 'pyro_maw',
          key: 'pyro_stream',
          frames: 8,
          fps: 12,
          description: 'Torso twist while exhaling flame with intensifying glow.'
        },
        {
          atlas: 'pyro_maw',
          key: 'pyro_lob',
          frames: 6,
          fps: 10,
          description: 'Wind-up, overhead toss, recovery frames.'
        }
      ]
    }
  },
  tide_reaver: {
    id: 'tide_reaver',
    codename: IDENTITY.WARDEN_NAMES.tide_reaver.toUpperCase(),
    element: 'Water',
    arena: 'Pressure Lock Reservoir',
    introCallout: 'ABYSSAL HUNTER',
    theme: { primary: 0x3b9dff, accent: 0xa0f2ff, glow: 0x62c1ff, trail: 0x1a6bff },
    baseStats: {
      maxHp: 120,
      contactDamage: 8,
      moveSpeed: 64,
      dashSpeed: 100,
      jumpHeight: 150
    },
    movementProfile: {
      weight: 'medium',
      preferredRange: 'long',
      mobilityNotes: 'Hovering water jets allow sustained air strafing and vertical dives.'
    },
    weaponReward: {
      id: 'HydroLance',
      element: 'Water',
      displayName: 'Hydro Lance',
      energyCost: 4,
      maxEnergy: 36,
      description: 'Piercing water javelin that can line up multiple targets.',
      tutorial: 'Tap for a quick lance. Hold up or down to adjust throw angle.'
    },
    attacks: [
      {
        name: 'Jet Levitate',
        state: 'move',
        description: 'Launches upward on a column of water, shifting horizontally.',
        telegraph: { telegraphMs: 260, warningFx: 'wave', anchor: 'self' },
        executeMs: 480,
        cooldownMs: 600,
        movementCue: 'Switches gravity scale to floaty while jets active.'
      },
      {
        name: 'Lance Volley',
        state: 'shoot',
        description: 'Fires two to three piercing lances in sequence.',
        telegraph: { telegraphMs: 320, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 420,
        cooldownMs: 780,
        spawns: ['water_lance']
      },
      {
        name: 'Riptide Crash',
        shortName: 'RIPTIDE',
        state: 'special',
        description: 'Ceiling cling then diagonal dive leaving puddles upon impact.',
        telegraph: { telegraphMs: 360, warningFx: 'reticle', anchor: 'target' },
        executeMs: 520,
        cooldownMs: 1100,
        movementCue: 'Increases fall speed; spawns splash pillars on landing.',
        spawns: ['splash_pillar']
      }
    ],
    phases: [
      {
        name: 'Surface Patrol',
        shortName: 'PATROL',
        threshold: 1,
        enraged: false,
        description: 'Alternates hover shots and grounded lances.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Abyssal Surge',
        shortName: 'ABYSSAL',
        threshold: 0.55,
        enraged: true,
        description: 'Introduces Riptide Crash and faster levitation strafes.',
        newAttacks: ['Riptide Crash'],
        retireAttacks: ['Jet Levitate'],
        retimeAttacks: { 'Lance Volley': { telegraphMs: 250, cooldownMs: 620 } },
        cadenceMultiplier: 1.3
      }
    ],
    desperation: {
      name: 'Undertow',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Maelstrom.',
      cadenceMultiplier: 1.4,
      flashPalette: [0xffffff, 0x62c1ff, 0xa0f2ff],
      attack: {
        name: 'Maelstrom',
        state: 'special',
        description: 'Rises, marks the hero, and drops splash pillars under a lance.',
        telegraph: { telegraphMs: 440, warningFx: 'reticle', anchor: 'target' },
        executeMs: 420,
        cooldownMs: 1150,
        spawns: ['splash_pillar', 'water_lance']
      }
    },
    spritePlan: {
      frame: PX(52, 50),
      origin: { x: 0.5, y: 0.86 },
      animations: [
        {
          atlas: 'tide_reaver',
          key: 'tide_idle',
          frames: 8,
          fps: 8,
          description: 'Hover idle with fins gently moving.'
        },
        {
          atlas: 'tide_reaver',
          key: 'tide_hover',
          frames: 6,
          fps: 12,
          description: 'Water jets cycle with droplets; horizontal drift frames.'
        },
        {
          atlas: 'tide_reaver',
          key: 'tide_lance',
          frames: 6,
          fps: 10,
          description: 'Arm draw, aim, and throw with watery trail.'
        },
        {
          atlas: 'tide_reaver',
          key: 'tide_dive',
          frames: 6,
          fps: 14,
          description: 'Ceiling cling, charge, dive with bubble streaks.'
        }
      ]
    }
  },
  volt_hopper: {
    id: 'volt_hopper',
    codename: IDENTITY.WARDEN_NAMES.volt_hopper.toUpperCase(),
    element: 'Lightning',
    arena: 'Capacitor Rooftops',
    introCallout: 'KINETIC CAPACITOR',
    theme: { primary: 0xffdd57, accent: 0xfff3b0, glow: 0xffff8d, trail: 0xffa600 },
    baseStats: {
      maxHp: 116,
      contactDamage: 8,
      moveSpeed: 90,
      dashSpeed: 140,
      jumpHeight: 180
    },
    movementProfile: {
      weight: 'light',
      preferredRange: 'mid',
      mobilityNotes: 'Chain jumps with electromagnetic tethers allow fast ceiling rebounds.'
    },
    weaponReward: {
      id: 'ThunderSpike',
      element: 'Lightning',
      displayName: 'Thunder Spike',
      energyCost: 6,
      maxEnergy: 32,
      description: 'Charged bolt that chains along floor and ceiling conductors.',
      tutorial: 'Hold to charge. Release when the reticle flashes for maximum damage.'
    },
    attacks: [
      {
        name: 'Capacitor Charge',
        shortName: 'CAPACITOR',
        state: 'jump',
        description: 'High parabolic leap that drops charged mines on apex.',
        telegraph: { telegraphMs: 280, warningFx: 'glow', anchor: 'self' },
        executeMs: 520,
        cooldownMs: 660,
        movementCue: 'Launch upward with increased gravity scale on descent.',
        spawns: ['charge_mine']
      },
      {
        name: 'Rail Shot',
        state: 'shoot',
        description: 'Aims a lightning bolt that chains vertically.',
        telegraph: { telegraphMs: 300, warningFx: 'fan-lines', anchor: 'target' },
        executeMs: 240,
        cooldownMs: 540,
        spawns: ['vertical_bolt'],
        piercesIFrames: true
      },
      {
        name: 'Impulse Dash',
        state: 'dash',
        description: 'Blink dash that leaves static orbs mid path.',
        telegraph: { telegraphMs: 180, warningFx: 'reticle', anchor: 'self' },
        executeMs: 180,
        cooldownMs: 720,
        movementCue: 'Instant acceleration to dashSpeed with slight afterimage.',
        spawns: ['static_orb']
      }
    ],
    phases: [
      {
        name: 'Charge Cycling',
        shortName: 'CYCLING',
        threshold: 1,
        enraged: false,
        description: 'Performs hop into rail shot loops.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Overvoltage',
        threshold: 0.55,
        enraged: true,
        description: 'Adds Impulse Dash mix-ups; mines chain lightning on detonation.',
        newAttacks: ['Impulse Dash'],
        retireAttacks: ['Rail Shot'],
        retimeAttacks: { 'Capacitor Charge': { telegraphMs: 220, cooldownMs: 520 } },
        cadenceMultiplier: 1.4
      }
    ],
    desperation: {
      name: 'Overload',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Storm Grid.',
      cadenceMultiplier: 1.5,
      flashPalette: [0xffffff, 0xffff8d, 0xfff3b0],
      attack: {
        name: 'Storm Grid',
        state: 'summon',
        description: 'Calls a bolt onto the hero and a static orb along the floor.',
        telegraph: { telegraphMs: 400, warningFx: 'reticle', anchor: 'target' },
        executeMs: 320,
        cooldownMs: 1050,
        spawns: ['vertical_bolt', 'static_orb']
      }
    },
    spritePlan: {
      frame: PX(48, 46),
      origin: { x: 0.5, y: 0.86 },
      animations: [
        {
          atlas: 'volt_hopper',
          key: 'volt_idle',
          frames: 6,
          fps: 12,
          description: 'Static-charged crouch with twitchy ears.'
        },
        {
          atlas: 'volt_hopper',
          key: 'volt_jump',
          frames: 8,
          fps: 14,
          description: 'Rapid takeoff, mid-air tuck, and ground impact frames.'
        },
        {
          atlas: 'volt_hopper',
          key: 'volt_dash',
          frames: 4,
          fps: 20,
          description: 'Blurred dash smear with electric trail overlay.'
        },
        {
          atlas: 'volt_hopper',
          key: 'volt_shoot',
          frames: 6,
          fps: 15,
          description: 'Arm cannon aims upward while sparks gather.'
        }
      ]
    }
  },
  basalt_titan: {
    id: 'basalt_titan',
    codename: IDENTITY.WARDEN_NAMES.basalt_titan.toUpperCase(),
    element: 'Earth',
    arena: 'Faultline Forge',
    introCallout: `SEISMIC ${IDENTITY.WARDEN_TERM}`,
    theme: { primary: 0x9b6b4a, accent: 0xffd7a0, glow: 0xc48c5a, trail: 0x6a4127 },
    baseStats: {
      maxHp: 132,
      contactDamage: 10,
      moveSpeed: 50,
      dashSpeed: 80,
      jumpHeight: 120
    },
    movementProfile: {
      weight: 'heavy',
      preferredRange: 'close',
      mobilityNotes: 'Slow strides but armored dash punches that shake the arena.'
    },
    weaponReward: {
      id: 'QuakeKnuckle',
      element: 'Earth',
      displayName: 'Quake Knuckle',
      energyCost: 5,
      maxEnergy: 28,
      description: 'Ground punch that emits crawling shockwaves.',
      tutorial: 'Dash in then press fire to punch. Shockwaves travel along the floor.'
    },
    attacks: [
      {
        name: 'Fault Punch',
        state: 'dash',
        description: 'Armored shoulder rush that ends with a ground punch.',
        telegraph: { telegraphMs: 360, warningFx: 'glow', anchor: 'self' },
        executeMs: 280,
        cooldownMs: 820,
        movementCue: 'Applies forward burst speed with super armor.',
        spawns: ['ground_shockwave']
      },
      {
        name: 'Basalt Barrage',
        shortName: 'BARRAGE',
        state: 'summon',
        description: 'Raises stone pillars that erupt sequentially.',
        telegraph: { telegraphMs: 420, warningFx: 'reticle', anchor: 'target' },
        executeMs: 360,
        cooldownMs: 1200,
        spawns: ['stone_pillar']
      },
      {
        name: 'Crustquake',
        state: 'special',
        description: 'Leaps up and slams to create radial boulders.',
        telegraph: { telegraphMs: 400, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 480,
        cooldownMs: 1000,
        movementCue: 'Slow rise, heavy slam, spawn boulder projectiles.',
        spawns: ['boulder_radial']
      }
    ],
    phases: [
      {
        name: 'Mantle Guard',
        threshold: 1,
        enraged: false,
        description: 'Telegraphs long with manageable gaps between attacks.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Core Fracture',
        shortName: 'FRACTURE',
        threshold: 0.55,
        enraged: true,
        description: 'Shockwaves travel faster; Barrage adds falling debris.',
        newAttacks: ['Basalt Barrage'],
        retireAttacks: ['Crustquake'],
        retimeAttacks: { 'Fault Punch': { telegraphMs: 280, cooldownMs: 680 } },
        cadenceMultiplier: 1.2
      }
    ],
    desperation: {
      name: 'Magma Core',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Tectonic Rift.',
      cadenceMultiplier: 1.3,
      flashPalette: [0xffffff, 0xc48c5a, 0xffd7a0],
      attack: {
        name: 'Tectonic Rift',
        shortName: 'RIFT',
        state: 'special',
        description: 'Slams down: a shockwave runs the floor under a boulder spread.',
        telegraph: { telegraphMs: 460, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 480,
        cooldownMs: 1200,
        spawns: ['ground_shockwave', 'boulder_radial']
      }
    },
    spritePlan: {
      frame: PX(60, 56),
      origin: { x: 0.5, y: 0.92 },
      animations: [
        {
          atlas: 'basalt_titan',
          key: 'basalt_idle',
          frames: 6,
          fps: 6,
          description: 'Massive breathing with cracks glowing faintly.'
        },
        {
          atlas: 'basalt_titan',
          key: 'basalt_dash',
          frames: 6,
          fps: 10,
          description: 'Shoulder charge frames with dust kick-up.'
        },
        {
          atlas: 'basalt_titan',
          key: 'basalt_punch',
          frames: 8,
          fps: 12,
          description: 'Wind-up, slam, shockwave release frames.'
        },
        {
          atlas: 'basalt_titan',
          key: 'basalt_jump',
          frames: 6,
          fps: 10,
          description: 'Heavy crouch, rise, and slam with debris spray.'
        }
      ]
    }
  },
  ferro_blade: {
    id: 'ferro_blade',
    codename: IDENTITY.WARDEN_NAMES.ferro_blade.toUpperCase(),
    element: 'Metal',
    arena: 'Magnetized Foundry',
    introCallout: 'VECTOR DUELIST',
    theme: { primary: 0xc1d0ff, accent: 0xfff1b2, glow: 0xe0f0ff, trail: 0x8aa4ff },
    baseStats: {
      maxHp: 116,
      contactDamage: 8,
      moveSpeed: 100,
      dashSpeed: 150,
      jumpHeight: 170
    },
    movementProfile: {
      weight: 'medium',
      preferredRange: 'mid',
      mobilityNotes: 'Teleports along magnetic rails and redirects boomerang blades.'
    },
    weaponReward: {
      id: 'MagcutDisc',
      element: 'Metal',
      displayName: 'Magcut Disc',
      energyCost: 4,
      maxEnergy: 34,
      description: 'Boomerang blade with steerable return path using directional input.',
      tutorial: 'Throw with fire. Hold a direction while it returns to curve the blade.'
    },
    attacks: [
      {
        name: 'Vector Slice',
        state: 'dash',
        description: 'Teleport slash across the arena leaving a metal trail.',
        telegraph: { telegraphMs: 220, warningFx: 'reticle', anchor: 'target' },
        executeMs: 200,
        cooldownMs: 640,
        movementCue: 'Instantly move to mirrored side before striking.'
      },
      {
        name: 'Mag Disc',
        state: 'shoot',
        description: 'Throws a disc that can bounce off walls before returning.',
        telegraph: { telegraphMs: 260, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 300,
        cooldownMs: 700,
        spawns: ['mag_disc']
      },
      {
        name: 'Polar Snare',
        state: 'summon',
        description: 'Spawns magnetic nodes pulling the player slightly.',
        telegraph: { telegraphMs: 340, warningFx: 'glow', anchor: 'projectile' },
        executeMs: 260,
        cooldownMs: 960,
        spawns: ['magnet_node']
      }
    ],
    phases: [
      {
        name: 'Discipline Mode',
        shortName: 'DISCIPLINE',
        threshold: 1,
        enraged: false,
        description: 'Alternates between disc throws and short teleports.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Relentless Mode',
        shortName: 'RELENTLESS',
        threshold: 0.55,
        enraged: true,
        description: 'Adds Polar Snare and chains teleports twice in a row.',
        newAttacks: ['Polar Snare'],
        retireAttacks: ['Mag Disc'],
        retimeAttacks: { 'Vector Slice': { telegraphMs: 180, cooldownMs: 520 } },
        cadenceMultiplier: 1.35
      }
    ],
    desperation: {
      name: 'Overclock',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Disc Storm.',
      cadenceMultiplier: 1.45,
      flashPalette: [0xffffff, 0xe0f0ff, 0xfff1b2],
      attack: {
        name: 'Disc Storm',
        state: 'shoot',
        description: 'A mag disc out and back behind a three-shard fan.',
        telegraph: { telegraphMs: 360, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 300,
        cooldownMs: 980,
        spawns: ['mag_disc', 'arc_shards']
      }
    },
    spritePlan: {
      frame: PX(50, 48),
      origin: { x: 0.5, y: 0.86 },
      animations: [
        {
          atlas: 'ferro_blade',
          key: 'ferro_idle',
          frames: 8,
          fps: 10,
          description: 'Ready stance with cloak flutter.'
        },
        {
          atlas: 'ferro_blade',
          key: 'ferro_dash',
          frames: 6,
          fps: 16,
          description: 'Teleport smear with slash frame.'
        },
        {
          atlas: 'ferro_blade',
          key: 'ferro_throw',
          frames: 6,
          fps: 12,
          description: 'Wind-up throw with magnet glow.'
        },
        {
          atlas: 'ferro_blade',
          key: 'ferro_summon',
          frames: 6,
          fps: 10,
          description: 'Hand gesture summoning nodes.'
        }
      ]
    },
    overlaySprites: [
      {
        frame: PX(32, 32),
        origin: { x: 0.5, y: 0.5 },
        animations: [
          {
            atlas: 'ferro_blade_fx',
            key: 'mag_trail',
            frames: 6,
            fps: 18,
            description: 'Magnetic particle loops trailing movement.'
          }
        ]
      }
    ]
  },
  mire_wraith: {
    id: 'mire_wraith',
    codename: IDENTITY.WARDEN_NAMES.mire_wraith.toUpperCase(),
    element: 'Toxic',
    arena: 'Biohazard Labyrinth',
    introCallout: 'NEBULOUS CORRUPTOR',
    theme: { primary: 0x83d483, accent: 0xfff59d, glow: 0xb4f3b4, trail: 0x4f8c4f },
    baseStats: {
      maxHp: 116,
      contactDamage: 8,
      moveSpeed: 80,
      dashSpeed: 110,
      jumpHeight: 150
    },
    movementProfile: {
      weight: 'light',
      preferredRange: 'long',
      mobilityNotes: 'Phase-shifting slides and hovering gas clouds create zoning traps.'
    },
    weaponReward: {
      id: 'AcidGlob',
      element: 'Toxic',
      displayName: 'Acid Glob',
      energyCost: 4,
      maxEnergy: 32,
      description: 'Arcing lob that creates lingering acid pools.',
      tutorial: 'Aim with up/down before release. Acid puddles damage over time.'
    },
    attacks: [
      {
        name: 'Toxic Slide',
        state: 'dash',
        description: 'Slides into mist form, phasing through the player.',
        telegraph: { telegraphMs: 240, warningFx: 'glow', anchor: 'self' },
        executeMs: 200,
        cooldownMs: 680,
        movementCue: 'Temporarily disables collisions and leaves poison trail.',
        spawns: ['acid_trail']
      },
      {
        name: 'Glob Lob',
        state: 'shoot',
        description: 'Throws acidic globs that stick to surfaces.',
        telegraph: { telegraphMs: 280, warningFx: 'reticle', anchor: 'projectile' },
        executeMs: 240,
        cooldownMs: 720,
        spawns: ['acid_glob']
      },
      {
        name: 'Toxic Bloom',
        state: 'summon',
        description: 'Summons vapor pods that detonate after a delay.',
        telegraph: { telegraphMs: 360, warningFx: 'fan-lines', anchor: 'target' },
        executeMs: 300,
        cooldownMs: 900,
        spawns: ['vapor_pod']
      }
    ],
    phases: [
      {
        name: 'Seeping Fog',
        threshold: 1,
        enraged: false,
        description: 'Focuses on glob toss with long recharge windows.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Toxic Bloom',
        threshold: 0.55,
        enraged: true,
        description: 'Slide leaves longer trails; vapor pods release homing motes.',
        newAttacks: ['Toxic Bloom'],
        retireAttacks: ['Toxic Slide'],
        retimeAttacks: { 'Glob Lob': { telegraphMs: 220, cooldownMs: 580 } },
        cadenceMultiplier: 1.25
      }
    ],
    desperation: {
      name: 'Corrosion',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Miasma Flood.',
      cadenceMultiplier: 1.35,
      flashPalette: [0xffffff, 0xb4f3b4, 0xfff59d],
      attack: {
        name: 'Miasma Flood',
        state: 'special',
        description: 'Floods the floor ahead with acid and lobs a glob over it.',
        telegraph: { telegraphMs: 420, warningFx: 'wave', anchor: 'self' },
        executeMs: 380,
        cooldownMs: 1100,
        spawns: ['acid_trail', 'acid_glob']
      }
    },
    spritePlan: {
      frame: PX(48, 48),
      origin: { x: 0.5, y: 0.84 },
      animations: [
        {
          atlas: 'mire_wraith',
          key: 'mire_idle',
          frames: 8,
          fps: 8,
          description: 'Ethereal hover with tendrils waving.'
        },
        {
          atlas: 'mire_wraith',
          key: 'mire_slide',
          frames: 6,
          fps: 14,
          description: 'Mist-form smear frames for dash.'
        },
        {
          atlas: 'mire_wraith',
          key: 'mire_throw',
          frames: 6,
          fps: 12,
          description: 'Glob toss with arm elongation.'
        },
        {
          atlas: 'mire_wraith',
          key: 'mire_summon',
          frames: 6,
          fps: 10,
          description: 'Claw raise summoning pods.'
        }
      ]
    }
  },
  gale_vixen: {
    id: 'gale_vixen',
    codename: IDENTITY.WARDEN_NAMES.gale_vixen.toUpperCase(),
    element: 'Wind',
    arena: 'Aerial Skybridge',
    introCallout: 'SONIC SABOTEUR',
    theme: { primary: 0xa5f4ff, accent: 0xfff6c7, glow: 0xc3f9ff, trail: 0x6bd9ff },
    baseStats: {
      maxHp: 112,
      contactDamage: 8,
      moveSpeed: 110,
      dashSpeed: 160,
      jumpHeight: 190
    },
    movementProfile: {
      weight: 'light',
      preferredRange: 'mid',
      mobilityNotes: 'Can wall-ride gusts and double-dash mid-air with tornado lifts.'
    },
    weaponReward: {
      id: 'AeroDarts',
      element: 'Wind',
      displayName: 'Aero Darts',
      energyCost: 3,
      maxEnergy: 38,
      description: 'Fan of darts that bounce on walls and floors.',
      tutorial: 'Tap for a short cone. Hold the button to fan wider with more energy.'
    },
    attacks: [
      {
        name: 'Turbine Slice',
        shortName: 'TURBINE',
        state: 'dash',
        description: 'Spins into a horizontal cyclone that travels across the arena.',
        telegraph: { telegraphMs: 240, warningFx: 'wave', anchor: 'self' },
        executeMs: 260,
        cooldownMs: 700,
        movementCue: 'Applies forward dash, lifts slightly off ground.',
        spawns: ['wind_hitbox']
      },
      {
        name: 'Aero Volley',
        state: 'shoot',
        description: 'Fires three dart spreads angled up, straight, and down.',
        telegraph: { telegraphMs: 260, warningFx: 'fan-lines', anchor: 'target' },
        executeMs: 200,
        cooldownMs: 560,
        spawns: ['dart_spread']
      },
      {
        name: 'Cyclone Lift',
        state: 'special',
        description: 'Summons a vertical gust that lifts her into aerial combos.',
        telegraph: { telegraphMs: 320, warningFx: 'reticle', anchor: 'self' },
        executeMs: 300,
        cooldownMs: 860,
        movementCue: 'Switch to aerial state; enables follow-up dash mid-air.',
        spawns: ['tornado_pillar']
      }
    ],
    phases: [
      {
        name: 'Sky Duel',
        threshold: 1,
        enraged: false,
        description: 'Grounded spins and dart volleys with generous spacing.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Squall Rush',
        threshold: 0.55,
        enraged: true,
        description: 'Cyclone Lift occurs more often and adds aerial follow-up darts.',
        newAttacks: ['Cyclone Lift'],
        retireAttacks: ['Aero Volley'],
        retimeAttacks: { 'Turbine Slice': { telegraphMs: 190, cooldownMs: 560 } },
        cadenceMultiplier: 1.35
      }
    ],
    desperation: {
      name: 'Eye of Storm',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Tempest.',
      cadenceMultiplier: 1.45,
      flashPalette: [0xffffff, 0xc3f9ff, 0xfff6c7],
      attack: {
        name: 'Tempest',
        state: 'shoot',
        description: 'Hovers high, fans darts at the hero and sheds a wind blade.',
        telegraph: { telegraphMs: 380, warningFx: 'fan-lines', anchor: 'target' },
        executeMs: 260,
        cooldownMs: 900,
        spawns: ['dart_spread', 'wind_hitbox']
      }
    },
    spritePlan: {
      frame: PX(46, 46),
      origin: { x: 0.5, y: 0.84 },
      animations: [
        {
          atlas: 'gale_vixen',
          key: 'gale_idle',
          frames: 8,
          fps: 12,
          description: 'Cloak billows gently while tail swishes.'
        },
        {
          atlas: 'gale_vixen',
          key: 'gale_dash',
          frames: 6,
          fps: 16,
          description: 'Spinning blur with gust trails.'
        },
        {
          atlas: 'gale_vixen',
          key: 'gale_shoot',
          frames: 6,
          fps: 12,
          description: 'Arm fans darts with swirling particles.'
        },
        {
          atlas: 'gale_vixen',
          key: 'gale_lift',
          frames: 6,
          fps: 14,
          description: 'Wind-up to vertical launch with hair flare.'
        }
      ]
    }
  },
  glacier_ronin: {
    id: 'glacier_ronin',
    codename: IDENTITY.WARDEN_NAMES.glacier_ronin.toUpperCase(),
    element: 'Ice',
    arena: 'Frozen Bastion',
    introCallout: 'CRYO SWORDMASTER',
    theme: { primary: 0xb0e4ff, accent: 0xfff3d1, glow: 0xd0f6ff, trail: 0x7ac8ff },
    baseStats: {
      maxHp: 120,
      contactDamage: 8,
      moveSpeed: 90,
      dashSpeed: 130,
      jumpHeight: 160
    },
    movementProfile: {
      weight: 'medium',
      preferredRange: 'close',
      mobilityNotes: 'Slides on ice paths and counterattacks with precise strikes.'
    },
    weaponReward: {
      id: 'FrostShatter',
      element: 'Ice',
      displayName: 'Frost Shatter',
      energyCost: 5,
      maxEnergy: 30,
      description: 'Freezing cone that can lock foes if damage threshold is reached.',
      tutorial: 'Fire at close range to fill the freeze meter and stop fast enemies.'
    },
    attacks: [
      {
        name: 'Glacier Slide',
        shortName: 'ICE SLIDE',
        state: 'dash',
        description: 'Slides across the floor leaving icy residue.',
        telegraph: { telegraphMs: 280, warningFx: 'wave', anchor: 'self' },
        executeMs: 220,
        cooldownMs: 620,
        movementCue: 'Applies frictionless velocity with slight deceleration.'
      },
      {
        name: 'Frost Draw',
        state: 'shoot',
        description: 'Draws katana to emit a freezing cone.',
        telegraph: { telegraphMs: 320, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 260,
        cooldownMs: 720,
        spawns: ['freeze_cone'],
        piercesIFrames: true
      },
      {
        name: 'Shard Rain',
        state: 'summon',
        description: 'Summons icicle rain from ceiling zones.',
        telegraph: { telegraphMs: 360, warningFx: 'reticle', anchor: 'target' },
        executeMs: 320,
        cooldownMs: 960,
        spawns: ['icicle_fall']
      }
    ],
    phases: [
      {
        name: 'Calm Resolve',
        threshold: 1,
        enraged: false,
        description: 'Measured slides and Frost Draw counters.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Breaking Point',
        shortName: 'BREAKPOINT',
        threshold: 0.55,
        enraged: true,
        description: 'Slides extend longer, icicle rain overlaps zones.',
        newAttacks: ['Shard Rain'],
        retireAttacks: ['Glacier Slide'],
        retimeAttacks: { 'Frost Draw': { telegraphMs: 250, cooldownMs: 580 } },
        cadenceMultiplier: 1.3
      }
    ],
    desperation: {
      name: 'Whiteout',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Absolute Zero.',
      cadenceMultiplier: 1.4,
      flashPalette: [0xffffff, 0xd0f6ff, 0xfff3d1],
      attack: {
        name: 'Absolute Zero',
        shortName: 'ZERO',
        state: 'summon',
        description: 'Icicles fall on the marked column behind a freezing cone.',
        telegraph: { telegraphMs: 440, warningFx: 'reticle', anchor: 'target' },
        executeMs: 360,
        cooldownMs: 1150,
        spawns: ['icicle_fall', 'freeze_cone']
      }
    },
    spritePlan: {
      frame: PX(50, 48),
      origin: { x: 0.5, y: 0.86 },
      animations: [
        {
          atlas: 'glacier_ronin',
          key: 'ronin_idle',
          frames: 8,
          fps: 8,
          description: 'Calm breathing with scarf flutter.'
        },
        {
          atlas: 'glacier_ronin',
          key: 'ronin_dash',
          frames: 6,
          fps: 14,
          description: 'Low slide with ice spray.'
        },
        {
          atlas: 'glacier_ronin',
          key: 'ronin_slash',
          frames: 6,
          fps: 12,
          description: 'Katana draw and cone emission.'
        },
        {
          atlas: 'glacier_ronin',
          key: 'ronin_summon',
          frames: 6,
          fps: 10,
          description: 'Sword plant, sky glimmer cue for icicles.'
        }
      ]
    }
  },
  omega_core: {
    id: 'omega_core',
    codename: IDENTITY.ANTAGONIST_NAME,
    element: 'Normal',
    arena: 'Omega Citadel Command Vault',
    // Omega's weakness rotates with its phases: Lightning, then Metal, then Ice (desperation keeps Ice); prompt 07 phase 7.3.
    damageProfile: { phaseWeaknesses: ['Lightning', 'Metal', 'Ice'] },
    introCallout: 'CENTRAL DIRECTIVE',
    theme: { primary: 0x142d52, accent: 0x42e7ff, glow: 0x70f4ff, trail: 0xff8a32 },
    baseStats: {
      maxHp: 140,
      contactDamage: 10,
      moveSpeed: 82,
      dashSpeed: 176,
      jumpHeight: 0
    },
    movementProfile: {
      weight: 'heavy',
      preferredRange: 'mid',
      mobilityNotes: 'Hovers with deliberate range corrections, then commits to high-speed armored rams.'
    },
    attacks: [
      {
        name: 'Directive Volley',
        shortName: 'DIRECTIVE',
        state: 'shoot',
        description: 'Fires a disciplined reactor-bolt spread that closes the safest lane.',
        telegraph: { telegraphMs: 360, warningFx: 'fan-lines', anchor: 'self' },
        executeMs: 220,
        cooldownMs: 760,
        spawns: ['arc_shards']
      },
      {
        name: 'Lockdown Pulse',
        shortName: 'LOCKDOWN',
        state: 'special',
        description: 'Pulses three floor sectors in sequence to force a reposition.',
        telegraph: { telegraphMs: 460, warningFx: 'reticle', anchor: 'target' },
        executeMs: 360,
        cooldownMs: 1160,
        spawns: ['ground_slam_hazard']
      },
      {
        name: 'Core Ram',
        state: 'dash',
        description: 'Seals its armor and rams through the player lane while shedding static orbs.',
        telegraph: { telegraphMs: 280, warningFx: 'glow', anchor: 'self' },
        executeMs: 260,
        cooldownMs: 940,
        spawns: ['static_orb']
      },
      {
        name: 'Override Cascade',
        shortName: 'CASCADE',
        state: 'summon',
        description: 'Combines falling command shards with persistent denial zones.',
        telegraph: { telegraphMs: 520, warningFx: 'wave', anchor: 'target' },
        executeMs: 420,
        cooldownMs: 1320,
        spawns: ['icicle_fall', 'vapor_pod']
      }
    ],
    phases: [
      {
        name: 'Compliance Protocol',
        shortName: 'COMPLIANCE',
        threshold: 1,
        enraged: false,
        description: 'Tests movement discipline with volleys and floor lockdowns.',
        newAttacks: [],
        cadenceMultiplier: 1
      },
      {
        name: 'Enforcement Protocol',
        shortName: 'ENFORCEMENT',
        threshold: 0.62,
        enraged: true,
        description: 'Adds armored rams between shortened projectile cycles.',
        newAttacks: ['Core Ram'],
        retireAttacks: ['Lockdown Pulse'],
        retimeAttacks: { 'Directive Volley': { telegraphMs: 290, cooldownMs: 620 } },
        cadenceMultiplier: 1.22
      },
      {
        name: 'Absolute Override',
        shortName: 'ABSOLUTE',
        threshold: 0.3,
        enraged: true,
        description: 'Overlaps the learned hazard families in a final command cascade.',
        newAttacks: ['Override Cascade'],
        cadenceMultiplier: 1.42
      }
    ],
    desperation: {
      name: 'Final Order',
      threshold: 0.2,
      description: 'Desperation at 20% HP: Final Directive.',
      cadenceMultiplier: 1.55,
      flashPalette: [0xffffff, 0x70f4ff, 0x42e7ff],
      attack: {
        name: 'Final Directive',
        shortName: 'DIRECTIVE',
        state: 'special',
        description: 'Marks the hero: shards, a static orb and falling ice at once.',
        telegraph: { telegraphMs: 520, warningFx: 'reticle', anchor: 'target' },
        executeMs: 420,
        cooldownMs: 1300,
        spawns: ['arc_shards', 'static_orb', 'icicle_fall']
      }
    },
    spritePlan: {
      frame: PX(64, 64),
      origin: { x: 0.5, y: 0.78 },
      animations: [
        {
          atlas: 'omega_core',
          key: 'omega_idle',
          frames: 4,
          fps: 6,
          description: 'Heavy hover cycle with reactor pulse.'
        },
        {
          atlas: 'omega_core',
          key: 'omega_move',
          frames: 4,
          fps: 10,
          description: 'Armored hover translation with energy-fin compensation.'
        },
        {
          atlas: 'omega_core',
          key: 'omega_shoot',
          frames: 4,
          fps: 12,
          description: 'Reactor and gauntlet charge followed by a cyan muzzle flare.'
        }
      ]
    }
  }
}

export interface BossRosterEntry {
  id: BossId
  blueprint: BossBlueprint
  weakTo: keyof typeof WeaknessTable
  strongAgainst: keyof typeof WeaknessTable
}

export const ORDERED_BOSSES: BossRosterEntry[] = Object.values(BOSS_ROSTER).map((blueprint) => {
  const weakTo = WeaknessTable[blueprint.element]
  const strongAgainst = (Object.entries(WeaknessTable).find(([, beats]) => beats === blueprint.element) ?? [
    blueprint.element,
    blueprint.element
  ])[0] as keyof typeof WeaknessTable

  return {
    id: blueprint.id as BossId,
    blueprint,
    weakTo,
    strongAgainst
  }
})

export function getBossList(): BossBlueprint[] {
  return ORDERED_BOSSES.map((entry) => entry.blueprint)
}

export function getBossById(id: BossId): BossBlueprint {
  return BOSS_ROSTER[id]
}
