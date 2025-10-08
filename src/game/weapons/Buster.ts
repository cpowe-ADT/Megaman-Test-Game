import { Element, V2 } from '../types';
import { Projectile } from '../entities/Projectile';
import { Weapon, WeaponState } from './Weapon';

export class Buster implements Weapon {
  id = 'Buster' as const;
  type: Element = 'Normal';
  energyCost = 0;
  maxEnergy = 0;

  canFire(): boolean {
    return true;
  }

  fire(state: WeaponState, aim: V2) {
    const projectile = new Projectile(
      { x: state.position.x + 16, y: state.position.y + 16 },
      { x: aim.x * 0.8, y: aim.y * 0.8 },
      4,
      1400,
      8,
      'player',
      this.type
    );
    return [projectile];
  }
}
