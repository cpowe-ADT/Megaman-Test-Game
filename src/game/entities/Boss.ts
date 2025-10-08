import { BossId, Element, Rect, V2, WeaponId } from '../types';
import { Projectile } from './Projectile';

export abstract class Boss {
  rect: Rect = { x: 440, y: 240, w: 48, h: 60 };
  vel: V2 = { x: 0, y: 0 };
  hp = 240;
  hpMax = 240;
  phase: 1 | 2 = 1;
  invMs = 0;

  constructor(public readonly id: BossId, public readonly type: Element, public readonly name: string) {}

  abstract update(dt: number, playerPos: V2): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;
  abstract getProjectiles(): Projectile[];
  abstract onEnterArena(): void;
  abstract onDefeated(): WeaponId;
}
