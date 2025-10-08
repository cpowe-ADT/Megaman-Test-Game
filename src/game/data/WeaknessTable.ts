import { BossId, Element, Theme, WeaponId } from '../types';

export const WeaknessTable: Record<Element, Element> = {
  Water: 'Lightning',
  Fire: 'Water',
  Ice: 'Fire',
  Wind: 'Ice',
  Toxic: 'Wind',
  Metal: 'Toxic',
  Earth: 'Metal',
  Lightning: 'Earth',
  Normal: 'Normal'
};

export const BossThemes: Record<BossId, Theme> = {
  PyroMaw: { primaryBG: '#180A0A', accent: '#ff8030', glow: '#ff9a4a', nameplate: 'rgba(0,0,0,0.85)' },
  TideReaver: { primaryBG: '#0a1120', accent: '#4ac3ff', glow: '#77ddff', nameplate: 'rgba(0,0,0,0.85)' },
  VoltHopper: { primaryBG: '#0b1020', accent: '#ffd966', glow: '#ffd966', nameplate: 'rgba(0,0,0,0.85)' },
  BasaltTitan: { primaryBG: '#10100a', accent: '#c5a56a', glow: '#f0d28a', nameplate: 'rgba(0,0,0,0.85)' },
  FerroBlade: { primaryBG: '#080b10', accent: '#a9c0d3', glow: '#d6e8f6', nameplate: 'rgba(0,0,0,0.85)' },
  MireWraith: { primaryBG: '#0b0f08', accent: '#9adf62', glow: '#c6ff9e', nameplate: 'rgba(0,0,0,0.85)' },
  GaleVixen: { primaryBG: '#0a0f15', accent: '#9fe1ff', glow: '#c9f3ff', nameplate: 'rgba(0,0,0,0.85)' },
  GlacierRonin: { primaryBG: '#0a0f13', accent: '#a7e4ff', glow: '#e2f7ff', nameplate: 'rgba(0,0,0,0.85)' },
  Rook: { primaryBG: '#0b1020', accent: '#9aa4b2', glow: '#c8d0da', nameplate: 'rgba(0,0,0,0.85)' }
};

export const BossWeaponRewards: Record<BossId, WeaponId> = {
  Rook: 'ArcSlash',
  PyroMaw: 'FlameSerpent',
  TideReaver: 'HydroLance',
  VoltHopper: 'ThunderSpike',
  BasaltTitan: 'QuakeKnuckle',
  FerroBlade: 'MagcutDisc',
  MireWraith: 'AcidGlob',
  GaleVixen: 'AeroDarts',
  GlacierRonin: 'FrostShatter'
};

export function computeMultiplier(weapon: Element, boss: Element): number {
  if (WeaknessTable[boss] === weapon) return 1.5;
  if (WeaknessTable[weapon] === boss) return 0.75;
  return 1.0;
}
