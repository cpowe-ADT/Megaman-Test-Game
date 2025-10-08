import { BaseScene } from './BaseScene';
import { SceneSelect } from './SceneSelect';

const MENU_OPTIONS = ['Begin Game', 'Options', 'Credits'] as const;

type Option = (typeof MENU_OPTIONS)[number];

export class SceneTitle extends BaseScene {
  private selected = 0;

  enter(): void {
    this.env.audio.play('music_title', { loop: true, volume: 0.6 });
  }

  update(): void {
    if (this.env.input.pressedAction('MoveDown')) {
      this.selected = (this.selected + 1) % MENU_OPTIONS.length;
    }
    if (this.env.input.pressedAction('MoveUp')) {
      this.selected = (this.selected - 1 + MENU_OPTIONS.length) % MENU_OPTIONS.length;
    }
    if (this.env.input.pressedAction('Jump') || this.env.input.pressedAction('Blaster')) {
      this.onSelect(MENU_OPTIONS[this.selected]);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, this.env.canvas.width, this.env.canvas.height);
    ctx.fillStyle = '#4ad0ff';
    ctx.font = '48px "Rajdhani", sans-serif';
    ctx.fillText('Aegis-X', 220, 120);
    ctx.font = '20px "Rajdhani", sans-serif';

    MENU_OPTIONS.forEach((option, index) => {
      const y = 200 + index * 32;
      const selected = index === this.selected;
      ctx.fillStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.65)';
      ctx.fillText(option, 260, y);
      if (selected) {
        ctx.fillRect(240, y - 20, 6, 24);
      }
    });
    ctx.restore();
  }

  exit(): void {
    this.env.audio.stop('music_title');
  }

  private onSelect(option: Option) {
    switch (option) {
      case 'Begin Game':
        this.game.setScene(new SceneSelect(this.game, this.env));
        break;
      case 'Options':
        // TODO: push options scene
        break;
      case 'Credits':
        // TODO: push credits scene
        break;
    }
  }
}
