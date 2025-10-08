import { Element, V2, WeaponId } from '../types';
import { Projectile } from '../entities/Projectile';

export interface Weapon {
  id: WeaponId;
  type: Element;
  energyCost: number;
  maxEnergy: number;
  canFire(state: WeaponState): boolean;
  fire(state: WeaponState, aim: V2): Projectile[] | void;
  onEquip?(state: WeaponState): void;
  onDrawOverlay?(ctx: CanvasRenderingContext2D, position: V2, facing: 1 | -1): void;
}

export interface WeaponState {
  energy: number;
  face: 1 | -1;
  position: V2;
}
