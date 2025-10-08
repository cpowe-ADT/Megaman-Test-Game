import { BaseScene } from './BaseScene';
import { BossId, Env } from '../types';
import { BossWeaponRewards } from '../data/WeaknessTable';
import { SceneSelect } from './SceneSelect';
import { SceneEnd } from './SceneEnd';
import { Game } from '../Game';

export class SceneWin extends BaseScene {
  private timer = 2400;
  private acknowledged = false;

  constructor(game: Game, env: Env, private bossId: BossId) {
    super(game, env);
  }

  enter(): void {
    this.env.audio.play('music_select', { loop: true, volume: 0.6 });
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.env.input.pressedAction('Jump') || this.env.input.pressedAction('Blaster')) {
      this.acknowledged = true;
    }

    if ((this.timer <= 0 || this.acknowledged) && !this.allBossesDefeated()) {
      this.game.setScene(new SceneSelect(this.game, this.env));
    }

    if ((this.timer <= 0 || this.acknowledged) && this.allBossesDefeated()) {
      this.game.setScene(new SceneEnd(this.game, this.env));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const weapon = BossWeaponRewards[this.bossId];
    ctx.save();
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, 0, this.env.canvas.width, this.env.canvas.height);
    ctx.fillStyle = '#6df8ff';
    ctx.font = '24px "Rajdhani", sans-serif';
    ctx.fillText('Victory!', 250, 120);
    ctx.font = '18px "Rajdhani", sans-serif';
    ctx.fillText(`Weapon acquired: ${weapon}`, 180, 180);
    ctx.fillText('Press confirm to continue.', 200, 220);
    ctx.restore();
  }

  exit(): void {
    this.env.audio.stop('music_select');
  }

  private allBossesDefeated() {
    const save = this.env.save.getState();
    return Object.values(save.defeated).every(Boolean);
  }
}
