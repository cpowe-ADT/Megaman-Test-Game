import { Boss } from '../Boss';
import { Projectile } from '../Projectile';
import { FXSystem } from '../../fx/FXSystem';
import { BossDefinition } from '../../data/Bosses';

const DEFAULT_PHASE_THRESHOLD = 0.55;

/**
 * Generic boss implementation driven entirely by data definitions. The class retains simple
 * movement and projectile logic while allowing per-boss tuning via {@link BossDefinition.stats}.
 */
export class SimpleBoss extends Boss {
  private projectiles: Projectile[] = [];
  private cooldown = 0;

  constructor(private readonly definition: BossDefinition, private readonly fx: FXSystem) {
    super(definition.id, definition.element, definition.codename);
    this.hp = this.hpMax = definition.stats.hp;
  }

  onEnterArena(): void {
    this.cooldown = this.definition.stats.fireRateMs;
  }

  update(dt: number, playerPos: { x: number; y: number }): void {
    this.invMs = Math.max(0, this.invMs - dt);
    const speed = this.definition.stats.moveSpeed;
    const direction = playerPos.x > this.rect.x ? 1 : -1;
    this.rect.x += direction * speed * dt;

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.fireAt(playerPos);
      const multiplier = this.phase === 1 ? 1 : this.definition.stats.fireRatePhase2Multiplier;
      this.cooldown = this.definition.stats.fireRateMs * multiplier;
    }

    this.projectiles.forEach((projectile) => projectile.update(dt));
    this.projectiles = this.projectiles.filter((projectile) => projectile.lifeMs > 0);

    if (this.hp < this.hpMax * DEFAULT_PHASE_THRESHOLD && this.phase === 1) {
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

  onDefeated() {
    return this.definition.weaponReward;
  }

  private fireAt(playerPos: { x: number; y: number }) {
    const dir = {
      x: Math.sign(playerPos.x - this.rect.x) || 1,
      y: (playerPos.y - this.rect.y) / 120
    };
    const length = Math.hypot(dir.x, dir.y) || 1;
    dir.x /= length;
    dir.y /= length;

    const speed =
      this.phase === 1
        ? this.definition.stats.projectileSpeed.phase1
        : this.definition.stats.projectileSpeed.phase2;
    const damage =
      this.phase === 1
        ? this.definition.stats.projectileDamage.phase1
        : this.definition.stats.projectileDamage.phase2;

    const projectile = new Projectile(
      { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 },
      { x: dir.x * speed, y: dir.y * speed },
      6,
      2400,
      damage,
      'boss',
      this.definition.element
    );
    this.projectiles.push(projectile);
  }
}
