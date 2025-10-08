import { BaseScene } from './BaseScene';
import { SceneTitle } from './SceneTitle';
import { AudioManifest } from '../audio/AudioManager';

const BOOT_MANIFEST: AudioManifest = [
  { id: 'ui_select', url: '/audio/ui_select.ogg' },
  { id: 'music_title', url: '/audio/music_title.ogg', loop: true },
  { id: 'music_select', url: '/audio/music_select.ogg', loop: true }
];

export class SceneBoot extends BaseScene {
  enter(): void {
    void this.env.audio.load(BOOT_MANIFEST).then(() => {
      this.game.setScene(new SceneTitle(this.game, this.env));
    });
  }

  update(): void {}

  draw(): void {
    const { ctx } = this.env;
    ctx.save();
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, this.env.canvas.width, this.env.canvas.height);
    ctx.fillStyle = '#4ad0ff';
    ctx.font = '24px "Rajdhani", sans-serif';
    ctx.fillText('Booting Aegis-X Systems...', 120, 180);
    ctx.restore();
  }

  exit(): void {}
}
