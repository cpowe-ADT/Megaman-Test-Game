import { Boss } from '../Boss';
import { BossId, Element, V2, WeaponId } from '../../types';
import { Projectile } from '../Projectile';
import { FXSystem } from '../../fx/FXSystem';
import { BossWeaponRewards } from '../../data/WeaknessTable';

const BOSS_FIRE_RATES: Partial<Record<BossId, number>> = {
  VoltHopper: 800,
  PyroMaw: 650,
  TideReaver: 900,
  BasaltTitan: 1100,
  FerroBlade: 720,
  MireWraith: 680,
  GaleVixen: 620,
  GlacierRonin: 900,
  Rook: 1200
};

const BOSS_SPEED: Partial<Record<BossId, number>> = {
  VoltHopper: 0.22,
  PyroMaw: 0.18,
  TideReaver: 0.16,
  BasaltTitan: 0.14,
  FerroBlade: 0.2,
  MireWraith: 0.17,
  GaleVixen: 0.24,
  GlacierRonin: 0.19,
  Rook: 0.15
};

export class SimpleBoss extends Boss {
  private projectiles: Projectile[] = [];
  private cooldown = 0;

  constructor(id: BossId, type: Element, name: string, private fx: FXSystem) {
    super(id, type, name);
  }

  onEnterArena(): void {
    this.cooldown = 1200;
  }

  update(dt: number, playerPos: V2): void {
    this.invMs = Math.max(0, this.invMs - dt);
    const speed = BOSS_SPEED[this.id] ?? 0.18;
    const direction = playerPos.x > this.rect.x ? 1 : -1;
    this.rect.x += direction * speed * dt;

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.fireAt(playerPos);
      this.cooldown = (BOSS_FIRE_RATES[this.id] ?? 900) * (this.phase === 1 ? 1 : 0.7);
    }

    this.projectiles.forEach((p) => p.update(dt));
    this.projectiles = this.projectiles.filter((p) => p.lifeMs > 0);

    if (this.hp < this.hpMax * 0.55 && this.phase === 1) {
      this.phase = 2;
      this.fx.shake(6, 0.01);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = this.phase === 1 ? '#ff4a64' : '#ffb347';
    ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    ctx.restore();
    for (const projectile of this.projectiles) {
      projectile.draw(ctx);
    }
  }

  getProjectiles(): Projectile[] {
    return this.projectiles;
  }

  onDefeated(): WeaponId {
    return BossWeaponRewards[this.id];
  }

  private fireAt(playerPos: V2) {
    const dir: V2 = {
      x: Math.sign(playerPos.x - this.rect.x) || 1,
      y: (playerPos.y - this.rect.y) / 120
    };
    const length = Math.hypot(dir.x, dir.y) || 1;
    dir.x /= length;
    dir.y /= length;
    const speed = this.phase === 1 ? 0.34 : 0.44;
    const projectile = new Projectile(
      { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 },
      { x: dir.x * speed, y: dir.y * speed },
      6,
      2400,
      this.phase === 1 ? 12 : 18,
      'boss',
      this.type
    );
    this.projectiles.push(projectile);
  }
}
