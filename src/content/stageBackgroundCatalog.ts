import type { StageBackgroundDefinition } from './stageArenaLayout'

export type StageBackgroundAsset = {
  key: string
  path: string
  license: string
  sourceUrl: string
  credit: string
}

const INDUSTRIAL_SOURCE_URL = 'https://opengameart.org/content/industrial-parallax-background'
const ADMURIN_SOURCE_URL = 'https://opengameart.org/content/parallax-backgrounds'

export const STAGE_BACKGROUND_ASSETS: StageBackgroundAsset[] = [
  // Relay biome (the tutorial's Drill Hangar), original art for phase 6.P: Higgsfield gpt_image_2 layers cut to one
  // seamless period by scripts/sprites/cut_background_layer.py (provenance: assets/backgrounds/source/relay/).
  {
    key: 'bg_relay_far',
    path: 'assets/backgrounds/relay/relay_far.png',
    license: 'original-generated',
    sourceUrl: 'generated',
    credit: 'Original art generated with Higgsfield (gpt_image_2) for this project'
  },
  {
    key: 'bg_relay_mid',
    path: 'assets/backgrounds/relay/relay_mid.png',
    license: 'original-generated',
    sourceUrl: 'generated',
    credit: 'Original art generated with Higgsfield (gpt_image_2) for this project'
  },
  {
    key: 'bg_industrial_bg',
    path: 'assets/backgrounds/opengameart/industrial/industrial_0003_bg.png',
    license: 'CC0',
    sourceUrl: INDUSTRIAL_SOURCE_URL,
    credit: 'ansimuz / OpenGameArt'
  },
  {
    key: 'bg_industrial_far',
    path: 'assets/backgrounds/opengameart/industrial/industrial_0002_far-buildings.png',
    license: 'CC0',
    sourceUrl: INDUSTRIAL_SOURCE_URL,
    credit: 'ansimuz / OpenGameArt'
  },
  {
    key: 'bg_industrial_buildings',
    path: 'assets/backgrounds/opengameart/industrial/industrial_0001_buildings.png',
    license: 'CC0',
    sourceUrl: INDUSTRIAL_SOURCE_URL,
    credit: 'ansimuz / OpenGameArt'
  },
  {
    key: 'bg_industrial_foreground',
    path: 'assets/backgrounds/opengameart/industrial/industrial_0000_foreground.png',
    license: 'CC0',
    sourceUrl: INDUSTRIAL_SOURCE_URL,
    credit: 'ansimuz / OpenGameArt'
  },
  {
    key: 'bg_cave_0',
    path: 'assets/backgrounds/opengameart/admurin_cave/0.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_cave_1',
    path: 'assets/backgrounds/opengameart/admurin_cave/1.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_cave_2',
    path: 'assets/backgrounds/opengameart/admurin_cave/2.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_cave_3',
    path: 'assets/backgrounds/opengameart/admurin_cave/3.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_cave_4',
    path: 'assets/backgrounds/opengameart/admurin_cave/4.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dead_forest_0',
    path: 'assets/backgrounds/opengameart/admurin_dead_forest/0.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dead_forest_1',
    path: 'assets/backgrounds/opengameart/admurin_dead_forest/1.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dead_forest_2',
    path: 'assets/backgrounds/opengameart/admurin_dead_forest/2.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dead_forest_3',
    path: 'assets/backgrounds/opengameart/admurin_dead_forest/3.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dead_forest_4',
    path: 'assets/backgrounds/opengameart/admurin_dead_forest/4.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dock_0',
    path: 'assets/backgrounds/opengameart/admurin_dock/0.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dock_1',
    path: 'assets/backgrounds/opengameart/admurin_dock/1.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dock_2',
    path: 'assets/backgrounds/opengameart/admurin_dock/2.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dock_3',
    path: 'assets/backgrounds/opengameart/admurin_dock/3.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dock_4',
    path: 'assets/backgrounds/opengameart/admurin_dock/4.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dock_5',
    path: 'assets/backgrounds/opengameart/admurin_dock/5.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_dock_7',
    path: 'assets/backgrounds/opengameart/admurin_dock/7.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_plains_0',
    path: 'assets/backgrounds/opengameart/admurin_plains/0.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_plains_2',
    path: 'assets/backgrounds/opengameart/admurin_plains/2.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_plains_4',
    path: 'assets/backgrounds/opengameart/admurin_plains/4.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_plains_6',
    path: 'assets/backgrounds/opengameart/admurin_plains/6.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_plains_8',
    path: 'assets/backgrounds/opengameart/admurin_plains/8.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_snow_0',
    path: 'assets/backgrounds/opengameart/admurin_snow/0.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_snow_1',
    path: 'assets/backgrounds/opengameart/admurin_snow/1.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_snow_2',
    path: 'assets/backgrounds/opengameart/admurin_snow/2.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  },
  {
    key: 'bg_snow_3',
    path: 'assets/backgrounds/opengameart/admurin_snow/3.png',
    license: 'CC-BY 4.0',
    sourceUrl: ADMURIN_SOURCE_URL,
    credit: 'Admurin / OpenGameArt'
  }
]

export function getStageBackgroundAssetEntries(): StageBackgroundAsset[] {
  return STAGE_BACKGROUND_ASSETS
}

function industrialBackground(baseColor: string, buildingTint: number, foregroundTint: number): StageBackgroundDefinition {
  return {
    baseColor,
    layers: [
      { key: 'bg_industrial_bg', scrollFactorX: 0.02, y: 92 },
      { key: 'bg_industrial_far', scrollFactorX: 0.08, y: 110, tint: buildingTint, alpha: 0.78 },
      { key: 'bg_industrial_buildings', scrollFactorX: 0.16, y: 102, tint: buildingTint },
      { key: 'bg_industrial_foreground', scrollFactorX: 0.28, y: 148, tint: foregroundTint, alpha: 0.94 }
    ]
  }
}

function caveBackground(baseColor: string, tint: number): StageBackgroundDefinition {
  return {
    baseColor,
    layers: [
      { key: 'bg_cave_0', scrollFactorX: 0.02, y: 36 },
      { key: 'bg_cave_1', scrollFactorX: 0.05, y: 36 },
      { key: 'bg_cave_2', scrollFactorX: 0.1, y: 36, tint, alpha: 0.95 },
      { key: 'bg_cave_3', scrollFactorX: 0.16, y: 36, tint, alpha: 0.86 },
      { key: 'bg_cave_4', scrollFactorX: 0.24, y: 36 }
    ]
  }
}

function dockBackground(baseColor: string, tint: number, accentTint?: number): StageBackgroundDefinition {
  return {
    baseColor,
    layers: [
      { key: 'bg_dock_0', scrollFactorX: 0.01, y: 36, tint },
      { key: 'bg_dock_1', scrollFactorX: 0.04, y: 36, tint },
      { key: 'bg_dock_2', scrollFactorX: 0.1, y: 36, tint: accentTint ?? tint, alpha: 0.85 },
      { key: 'bg_dock_4', scrollFactorX: 0.16, y: 36, tint: accentTint ?? tint },
      { key: 'bg_dock_7', scrollFactorX: 0.24, y: 36 }
    ]
  }
}

function deadForestBackground(baseColor: string, tint: number): StageBackgroundDefinition {
  return {
    baseColor,
    layers: [
      { key: 'bg_dead_forest_0', scrollFactorX: 0.01, y: 36, tint },
      { key: 'bg_dead_forest_1', scrollFactorX: 0.05, y: 36, tint, alpha: 0.92 },
      { key: 'bg_dead_forest_2', scrollFactorX: 0.1, y: 36, tint, alpha: 0.84 },
      { key: 'bg_dead_forest_3', scrollFactorX: 0.18, y: 36, tint: 0x6ddc86, alpha: 0.72 },
      { key: 'bg_dead_forest_4', scrollFactorX: 0.24, y: 36 }
    ]
  }
}

function plainsBackground(baseColor: string, tint: number): StageBackgroundDefinition {
  return {
    baseColor,
    layers: [
      { key: 'bg_plains_0', scrollFactorX: 0.01, y: 36, tint },
      { key: 'bg_plains_2', scrollFactorX: 0.06, y: 36, tint },
      { key: 'bg_plains_4', scrollFactorX: 0.12, y: 36, tint: 0xa4c9ff, alpha: 0.9 },
      { key: 'bg_plains_6', scrollFactorX: 0.18, y: 36 },
      { key: 'bg_plains_8', scrollFactorX: 0.26, y: 36 }
    ]
  }
}

function snowBackground(baseColor: string, tint: number): StageBackgroundDefinition {
  return {
    baseColor,
    layers: [
      { key: 'bg_snow_0', scrollFactorX: 0.01, y: 36, tint },
      { key: 'bg_snow_1', scrollFactorX: 0.05, y: 36, tint: 0xcfe0ff },
      { key: 'bg_snow_2', scrollFactorX: 0.1, y: 36, tint, alpha: 0.9 },
      { key: 'bg_snow_3', scrollFactorX: 0.18, y: 36 }
    ]
  }
}

export function getStageBackgroundDefinition(stageId: string): StageBackgroundDefinition {
  switch (stageId) {
    case 'tutorial_sentinel':
      // Drill Hangar (6.P): far skyline 192px tall and drill rigs 144px tall, both bottom-aligned on the 252px
      // frame and tinted down to the style sheet's shadow and base so the hero reads in front of them.
      return {
        baseColor: '#0E1622',
        layers: [
          { key: 'bg_relay_far', scrollFactorX: 0.08, y: 60, tint: 0x9aa8c4 },
          { key: 'bg_relay_mid', scrollFactorX: 0.28, y: 108, tint: 0x7a86a6 }
        ]
      }
    case 'pyro_maw':
      return industrialBackground('#22100d', 0xff7f4f, 0xffb066)
    case 'tide_reaver':
      return dockBackground('#07192a', 0x76c8ff, 0x9fe3ff)
    case 'volt_hopper':
      return dockBackground('#0b1126', 0x85a0ff, 0xa2bdff)
    case 'basalt_titan':
      return caveBackground('#140f0b', 0xc49a6c)
    case 'ferro_blade':
      return industrialBackground('#111620', 0x7d95bb, 0x9db4d4)
    case 'mire_wraith':
      return deadForestBackground('#0a130f', 0x5ea871)
    case 'gale_vixen':
      return plainsBackground('#0c1725', 0x9ac4ff)
    case 'glacier_ronin':
      return snowBackground('#0c1526', 0xb2d0ff)
    case 'omega_fortress':
      return {
        baseColor: '#140d1f',
        layers: [
          { key: 'bg_dock_0', scrollFactorX: 0.01, y: 36, tint: 0xa37dff },
          { key: 'bg_dock_2', scrollFactorX: 0.08, y: 36, tint: 0xc4a6ff, alpha: 0.84 },
          { key: 'bg_industrial_far', scrollFactorX: 0.14, y: 110, tint: 0x8c7bff, alpha: 0.72 },
          { key: 'bg_industrial_buildings', scrollFactorX: 0.2, y: 102, tint: 0xb89cff, alpha: 0.9 },
          { key: 'bg_dock_7', scrollFactorX: 0.28, y: 36, tint: 0x6a5fc9, alpha: 0.96 }
        ]
      }
    default:
      return dockBackground('#0d1a2b', 0x7dafff)
  }
}
