import { BaseScene } from './BaseScene';
import { BossId, Env } from '../types';
import { createBoss } from '../entities/bosses';
import { createWeapon } from '../weapons';
import { Player } from '../entities/Player';
import { computeMultiplier } from '../data/WeaknessTable';
import { SceneWin } from './SceneWin';
import { Projectile } from '../entities/Projectile';
import { Game } from '../Game';

export class SceneFight extends BaseScene {
  private player: Player;
  private boss = createBoss(this.bossId, this.env.fx);
  private introTimer = 1600;
  private combatUnlocked = false;

  constructor(game: Game, env: Env, private bossId: BossId) {
    super(game, env);
    this.player = new Player(env.input, createWeapon('Buster'));
    const save = env.save.getState();
    for (const weaponId of save.unlockedWeapons) {
      if (weaponId !== 'Buster') {
        this.player.addWeapon(createWeapon(weaponId));
      }
    }
    this.player.switchWeapon(save.equippedWeapon);
    this.boss.onEnterArena();
  }

  enter(): void {
    this.env.hud.setBossHP(this.boss.hp, this.boss.hpMax, true);
  }

  update(dt: number): void {
    if (this.introTimer > 0) {
      this.introTimer -= dt;
      if (this.introTimer <= 0) {
        this.combatUnlocked = true;
      }
    }

    this.player.update(dt);
    this.env.hud.setPlayerHP(this.player.hp, this.player.hpMax);
    const weapon = this.player.getCurrentWeapon();
    if (weapon) {
      this.env.hud.setWeapon(weapon);
      const energy = this.player.getEnergy();
      this.env.hud.setEnergy(energy.value, energy.max);
    }

    this.boss.update(dt, { x: this.player.rect.x, y: this.player.rect.y });
    this.env.hud.setBossHP(this.boss.hp, this.boss.hpMax, true);

    if (this.combatUnlocked) {
      this.handleCombat();
    }

    if (this.boss.hp <= 0) {
      const weaponId = this.boss.onDefeated();
      this.env.save.markBossDefeated(this.bossId, weaponId);
      this.game.setScene(new SceneWin(this.game, this.env, this.bossId));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, this.env.canvas.width, this.env.canvas.height);
    this.player.draw(ctx);
    this.boss.draw(ctx);
    ctx.restore();
  }

  exit(): void {}

  private handleCombat() {
    const playerProjectiles = this.player.getProjectiles();
    for (const projectile of playerProjectiles) {
      if (this.intersect(projectile, this.boss.rect)) {
        this.boss.hp -= projectile.damage * computeMultiplier(projectile.element, this.boss.type);
        projectile.lifeMs = 0;
        this.env.fx.shake(3, 0.02);
      }
    }

    for (const projectile of this.boss.getProjectiles()) {
      if (this.intersect(projectile, this.player.rect)) {
        this.player.hurt(projectile.damage);
        projectile.lifeMs = 0;
      }
    }

    if (this.rectIntersect(this.player.rect, this.boss.rect)) {
      this.player.hurt(16);
    }
  }

  private intersect(projectile: Projectile, rect: { x: number; y: number; w: number; h: number }) {
    return (
      projectile.pos.x > rect.x &&
      projectile.pos.x < rect.x + rect.w &&
      projectile.pos.y > rect.y &&
      projectile.pos.y < rect.y + rect.h
    );
  }

  private rectIntersect(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }
}
