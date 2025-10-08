import { Weapon } from '../weapons/Weapon';

export class HUD {
  private playerHP = { current: 100, max: 100 };
  private bossHP = { current: 100, max: 100, visible: false };
  private weapon: Weapon | null = null;
  private energy = { value: 0, max: 0 };

  setWeapon(weapon: Weapon | null) {
    this.weapon = weapon;
  }

  setPlayerHP(hp: number, max: number) {
    this.playerHP = { current: hp, max };
  }

  setBossHP(hp: number, max: number, visible: boolean) {
    this.bossHP = { current: hp, max, visible };
  }

  setEnergy(value: number, max: number) {
    this.energy = { value, max };
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = '14px "Rajdhani", sans-serif';
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(16, 16, 200, 16);
    ctx.fillRect(424, 16, 200, 16);

    const playerRatio = this.playerHP.current / this.playerHP.max;
    ctx.fillStyle = '#4ad0ff';
    ctx.fillRect(16, 16, 200 * playerRatio, 16);

    if (this.bossHP.visible) {
      const bossRatio = this.bossHP.current / this.bossHP.max;
      ctx.fillStyle = '#ff6a6a';
      ctx.fillRect(424, 16, 200 * bossRatio, 16);
    }

    if (this.weapon) {
      ctx.fillStyle = '#fff';
      ctx.fillText(this.weapon.id, 16, 48);
      ctx.fillStyle = '#89ffbc';
      const ratio = this.energy.max > 0 ? this.energy.value / this.energy.max : 0;
      ctx.fillRect(16, 56, 200 * ratio, 6);
    }
    ctx.restore();
  }
}
