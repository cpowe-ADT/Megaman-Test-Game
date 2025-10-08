import { Element, V2 } from '../types';

export class Projectile {
  constructor(
    public pos: V2,
    public vel: V2,
    public radius: number,
    public lifeMs: number,
    public damage: number,
    public from: 'player' | 'boss',
    public element: Element
  ) {}

  update(dt: number) {
    this.lifeMs -= dt;
    this.pos = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt };
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.from === 'player' ? '#8dfaff' : '#ff8a6d';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
