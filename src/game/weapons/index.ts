import { WeaponId, Element } from '../types';
import { Weapon } from './Weapon';
import { Buster } from './Buster';
import { ElementalShot } from './ElementalShot';

const weaponConfig: Record<WeaponId, { type: Element; energy: number; max: number; speed: number; damage: number }> = {
  Buster: { type: 'Normal', energy: 0, max: 0, speed: 0.8, damage: 8 },
  ArcSlash: { type: 'Normal', energy: 2, max: 24, speed: 0.9, damage: 12 },
  FlameSerpent: { type: 'Fire', energy: 4, max: 32, speed: 0.7, damage: 16 },
  HydroLance: { type: 'Water', energy: 4, max: 32, speed: 1.1, damage: 14 },
  ThunderSpike: { type: 'Lightning', energy: 5, max: 32, speed: 1.3, damage: 18 },
  QuakeKnuckle: { type: 'Earth', energy: 6, max: 24, speed: 0.6, damage: 20 },
  MagcutDisc: { type: 'Metal', energy: 3, max: 28, speed: 0.9, damage: 15 },
  AcidGlob: { type: 'Toxic', energy: 3, max: 28, speed: 0.7, damage: 14 },
  AeroDarts: { type: 'Wind', energy: 2, max: 28, speed: 1.2, damage: 10 },
  FrostShatter: { type: 'Ice', energy: 4, max: 28, speed: 0.85, damage: 16 }
};

export function createWeapon(id: WeaponId): Weapon {
  if (id === 'Buster') {
    return new Buster();
  }
  const cfg = weaponConfig[id];
  return new ElementalShot(id, cfg.type, cfg.energy, cfg.max, cfg.speed, cfg.damage);
}
