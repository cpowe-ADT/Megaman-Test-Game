import { BaseScene } from './BaseScene';
import { SceneTitle } from './SceneTitle';

export class SceneEnd extends BaseScene {
  private timer = 4000;

  enter(): void {
    this.env.audio.play('music_title', { loop: true, volume: 0.6 });
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0 || this.env.input.pressedAction('Jump')) {
      this.game.setScene(new SceneTitle(this.game, this.env));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#020409';
    ctx.fillRect(0, 0, this.env.canvas.width, this.env.canvas.height);
    ctx.fillStyle = '#8dfaff';
    ctx.font = '24px "Rajdhani", sans-serif';
    ctx.fillText('Boss Rush Complete!', 200, 160);
    ctx.font = '16px "Rajdhani", sans-serif';
    ctx.fillText('Thank you for playing.', 240, 220);
    ctx.restore();
  }

  exit(): void {
    this.env.audio.stop('music_title');
  }
}
