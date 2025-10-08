import { Element, V2, WeaponId } from '../types';
import { Projectile } from '../entities/Projectile';
import { Weapon, WeaponState } from './Weapon';

export class ElementalShot implements Weapon {
  constructor(
    public readonly id: WeaponId,
    public readonly type: Element,
    public readonly energyCost: number,
    public readonly maxEnergy: number,
    private readonly speed: number,
    private readonly damage: number
  ) {}

  canFire(state: WeaponState): boolean {
    return state.energy >= this.energyCost;
  }

  fire(state: WeaponState, aim: V2) {
    const projectile = new Projectile(
      { x: state.position.x + 16, y: state.position.y + 16 },
      { x: aim.x * this.speed, y: aim.y * this.speed },
      5,
      1200,
      this.damage,
      'player',
      this.type
    );
    return [projectile];
  }
}
