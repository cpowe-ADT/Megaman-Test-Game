import { BossId, Element, Theme, WeaponId } from '../types';

export type BossAIBehavior =
  | 'rook'
  | 'pyro'
  | 'water'
  | 'hopper'
  | 'earth'
  | 'metal'
  | 'toxic'
  | 'wind'
  | 'ice';

export interface BossStats {
  /** Total hit points the boss starts with. */
  hp: number;
  /** Horizontal tracking speed toward the player (arena units per ms). */
  moveSpeed: number;
  /** Time between projectile volleys in milliseconds. */
  fireRateMs: number;
  /** Multiplier applied to the fire rate once phase 2 begins. */
  fireRatePhase2Multiplier: number;
  /** Projectile travel speed for each phase. */
  projectileSpeed: { phase1: number; phase2: number };
  /** Projectile damage dealt to the player for each phase. */
  projectileDamage: { phase1: number; phase2: number };
}

export interface BossDefinition {
  id: BossId;
  /** Stylized codename used on title cards and HUD readouts. */
  codename: string;
  element: Element;
  weaponReward: WeaponId;
  ai: BossAIBehavior;
  /** Stage select grid position. */
  stage: { col: number; row: number };
  /** Narrative hint surfaced on the stage select screen. */
  hint: string;
  /** Visual theme colors used for backgrounds and UI flourishes. */
  theme: Theme;
  stats: BossStats;
}

const DEFAULT_PROJECTILE_SPEED = { phase1: 0.34, phase2: 0.44 } as const;
const DEFAULT_PROJECTILE_DAMAGE = { phase1: 12, phase2: 18 } as const;

const createDefinition = (definition: Omit<BossDefinition, 'stats'> & { stats?: Partial<BossStats> }): BossDefinition => ({
  ...definition,
  stats: {
    hp: 220,
    moveSpeed: 0.18,
    fireRateMs: 900,
    fireRatePhase2Multiplier: 0.7,
    projectileSpeed: DEFAULT_PROJECTILE_SPEED,
    projectileDamage: DEFAULT_PROJECTILE_DAMAGE,
    ...definition.stats
  }
});

export const BOSS_DEFINITIONS: Record<BossId, BossDefinition> = {
  Rook: createDefinition({
    id: 'Rook',
    codename: 'SENTINEL ROOK',
    element: 'Normal',
    weaponReward: 'ArcSlash',
    ai: 'rook',
    stage: { col: 1, row: 1 },
    hint: 'Sentinel cleared. Training complete.',
    theme: { primaryBG: '#0b1020', accent: '#9aa4b2', glow: '#c8d0da', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { hp: 140, moveSpeed: 0.15, fireRateMs: 1200 }
  }),
  PyroMaw: createDefinition({
    id: 'PyroMaw',
    codename: 'PYRO MAW',
    element: 'Fire',
    weaponReward: 'FlameSerpent',
    ai: 'pyro',
    stage: { col: 0, row: 0 },
    hint: 'Rumor: Water quenches raging fire.',
    theme: { primaryBG: '#180A0A', accent: '#ff8030', glow: '#ff9a4a', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.18, fireRateMs: 650 }
  }),
  TideReaver: createDefinition({
    id: 'TideReaver',
    codename: 'TIDE REAVER',
    element: 'Water',
    weaponReward: 'HydroLance',
    ai: 'water',
    stage: { col: 1, row: 0 },
    hint: 'Rumor: Lightning can ionize torrents.',
    theme: { primaryBG: '#0a1120', accent: '#4ac3ff', glow: '#77ddff', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.16, fireRateMs: 900 }
  }),
  VoltHopper: createDefinition({
    id: 'VoltHopper',
    codename: 'VOLT HOPPER',
    element: 'Lightning',
    weaponReward: 'ThunderSpike',
    ai: 'hopper',
    stage: { col: 2, row: 0 },
    hint: 'Rumor: Earth can ground stray voltage.',
    theme: { primaryBG: '#0b1020', accent: '#ffd966', glow: '#ffd966', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.22, fireRateMs: 800 }
  }),
  BasaltTitan: createDefinition({
    id: 'BasaltTitan',
    codename: 'BASALT TITAN',
    element: 'Earth',
    weaponReward: 'QuakeKnuckle',
    ai: 'earth',
    stage: { col: 0, row: 1 },
    hint: 'Rumor: Metal drills through stone.',
    theme: { primaryBG: '#10100a', accent: '#c5a56a', glow: '#f0d28a', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.14, fireRateMs: 1100 }
  }),
  FerroBlade: createDefinition({
    id: 'FerroBlade',
    codename: 'FERRO BLADE',
    element: 'Metal',
    weaponReward: 'MagcutDisc',
    ai: 'metal',
    stage: { col: 2, row: 1 },
    hint: 'Rumor: Corrosive toxins eat alloys.',
    theme: { primaryBG: '#080b10', accent: '#a9c0d3', glow: '#d6e8f6', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.2, fireRateMs: 720 }
  }),
  MireWraith: createDefinition({
    id: 'MireWraith',
    codename: 'MIRE WRAITH',
    element: 'Toxic',
    weaponReward: 'AcidGlob',
    ai: 'toxic',
    stage: { col: 0, row: 2 },
    hint: 'Rumor: Wind scatters toxic mists.',
    theme: { primaryBG: '#0b0f08', accent: '#9adf62', glow: '#c6ff9e', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.17, fireRateMs: 680 }
  }),
  GaleVixen: createDefinition({
    id: 'GaleVixen',
    codename: 'GALE VIXEN',
    element: 'Wind',
    weaponReward: 'AeroDarts',
    ai: 'wind',
    stage: { col: 1, row: 2 },
    hint: 'Rumor: Ice can stall furious gales.',
    theme: { primaryBG: '#0a0f15', accent: '#9fe1ff', glow: '#c9f3ff', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.24, fireRateMs: 620 }
  }),
  GlacierRonin: createDefinition({
    id: 'GlacierRonin',
    codename: 'GLACIER RONIN',
    element: 'Ice',
    weaponReward: 'FrostShatter',
    ai: 'ice',
    stage: { col: 2, row: 2 },
    hint: 'Rumor: Fire melts ancient ice.',
    theme: { primaryBG: '#0a0f13', accent: '#a7e4ff', glow: '#e2f7ff', nameplate: 'rgba(0,0,0,0.85)' },
    stats: { moveSpeed: 0.19, fireRateMs: 900 }
  })
};

const GRID_KEY = (col: number, row: number) => `${col},${row}`;

const GRID_LOOKUP = new Map<string, BossId>();
for (const definition of Object.values(BOSS_DEFINITIONS)) {
  GRID_LOOKUP.set(GRID_KEY(definition.stage.col, definition.stage.row), definition.id);
}

export function getBossDefinition(id: BossId): BossDefinition {
  const definition = BOSS_DEFINITIONS[id];
  if (!definition) {
    throw new Error(`Unknown boss id: ${id}`);
  }
  return definition;
}

export function getAllBossDefinitions(): BossDefinition[] {
  return Object.values(BOSS_DEFINITIONS);
}

export function getBossAtGrid(col: number, row: number): BossDefinition | undefined {
  const id = GRID_LOOKUP.get(GRID_KEY(col, row));
  return id ? BOSS_DEFINITIONS[id] : undefined;
}

export function getBossTheme(id: BossId): Theme {
  return getBossDefinition(id).theme;
}

export function getBossWeaponReward(id: BossId): WeaponId {
  return getBossDefinition(id).weaponReward;
}

export function getBossHint(id: BossId): string {
  return getBossDefinition(id).hint;
}
