import { BossId, Element, Theme, WeaponId } from '../types';
import { getAllBossDefinitions } from './Bosses';

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

const bossDefinitions = getAllBossDefinitions();

export const BossThemes: Record<BossId, Theme> = bossDefinitions.reduce((map, definition) => {
  map[definition.id] = definition.theme;
  return map;
}, {} as Record<BossId, Theme>);

export const BossWeaponRewards: Record<BossId, WeaponId> = bossDefinitions.reduce((map, definition) => {
  map[definition.id] = definition.weaponReward;
  return map;
}, {} as Record<BossId, WeaponId>);

export function computeMultiplier(weapon: Element, boss: Element): number {
  if (WeaknessTable[boss] === weapon) return 1.5;
  if (WeaknessTable[weapon] === boss) return 0.75;
  return 1.0;
}
