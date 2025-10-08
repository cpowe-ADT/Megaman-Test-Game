import { BaseScene } from './BaseScene';
import { iterateGrid } from '../stage/StageGrid';
import { BossThemes } from '../data/WeaknessTable';
import { BossId, Element, SaveState } from '../types';
import { SceneFight } from './SceneFight';

const WEAKNESS_HINTS: Record<BossId, string> = {
  PyroMaw: 'Rumor: Water quenches raging fire.',
  TideReaver: 'Rumor: Lightning can ionize torrents.',
  VoltHopper: 'Rumor: Earth can ground stray voltage.',
  BasaltTitan: 'Rumor: Metal drills through stone.',
  FerroBlade: 'Rumor: Corrosive toxins eat alloys.',
  MireWraith: 'Rumor: Wind scatters toxic mists.',
  GaleVixen: 'Rumor: Ice can stall furious gales.',
  GlacierRonin: 'Rumor: Fire melts ancient ice.',
  Rook: 'Sentinel cleared. Training complete.'
};

export class SceneSelect extends BaseScene {
  private cursor = { col: 1, row: 1 };

  enter(): void {
    this.env.audio.play('music_select', { loop: true, volume: 0.6 });
  }

  update(): void {
    if (this.env.input.pressedAction('MoveLeft')) this.cursor.col = (this.cursor.col + 2) % 3;
    if (this.env.input.pressedAction('MoveRight')) this.cursor.col = (this.cursor.col + 1) % 3;
    if (this.env.input.pressedAction('MoveUp')) this.cursor.row = (this.cursor.row + 2) % 3;
    if (this.env.input.pressedAction('MoveDown')) this.cursor.row = (this.cursor.row + 1) % 3;

    if (this.env.input.pressedAction('Jump') || this.env.input.pressedAction('Blaster')) {
      const id = this.currentBoss();
      this.game.setScene(new SceneFight(this.game, this.env, id));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const save = this.env.save.getState();
    ctx.save();
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, this.env.canvas.width, this.env.canvas.height);

    ctx.font = '18px "Rajdhani", sans-serif';
    ctx.fillStyle = '#89a6ff';
    ctx.fillText('Select Target', 24, 40);

    for (const node of iterateGrid()) {
      const theme = BossThemes[node.id];
      const x = 120 + node.col * 140;
      const y = 100 + node.row * 80;
      const cleared = save.defeated[node.id];
      ctx.fillStyle = theme.primaryBG;
      ctx.fillRect(x, y, 96, 64);
      ctx.strokeStyle = node.col === this.cursor.col && node.row === this.cursor.row ? theme.accent : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 96, 64);
      ctx.fillStyle = theme.glow;
      ctx.font = '16px "Rajdhani", sans-serif';
      ctx.fillText(node.id, x + 8, y + 32);
      if (cleared) {
        ctx.fillStyle = '#ffd966';
        ctx.fillText('CLEARED', x + 8, y + 52);
      }
    }

    const active = this.currentBoss();
    const hint = this.buildHint(active);
    ctx.fillStyle = 'rgba(12, 18, 32, 0.85)';
    ctx.fillRect(24, 280, 592, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px "Rajdhani", sans-serif';
    ctx.fillText(active, 40, 308);
    ctx.font = '14px "Rajdhani", sans-serif';
    ctx.fillText(hint, 40, 332);
    ctx.restore();
  }

  exit(): void {
    this.env.audio.stop('music_select');
  }

  private currentBoss(): BossId {
    return iterateGrid().find((node) => node.col === this.cursor.col && node.row === this.cursor.row)!.id;
  }

  private buildHint(id: BossId) {
    const save = this.env.save.getState();
    const discovered = save.unlockedWeapons.length > 2;
    if (!discovered) return 'Intel locked. Defeat more bosses to learn weaknesses.';
    const weaponElement = this.resolveWeaponElement(save.unlockedWeapons[save.unlockedWeapons.length - 1]);
    const hint = WEAKNESS_HINTS[id];
    return `${hint} (Last acquired element: ${weaponElement})`;
  }

  private resolveWeaponElement(weapon: string): Element {
    const mapping: Record<string, Element> = {
      Buster: 'Normal',
      ArcSlash: 'Normal',
      FlameSerpent: 'Fire',
      HydroLance: 'Water',
      ThunderSpike: 'Lightning',
      QuakeKnuckle: 'Earth',
      MagcutDisc: 'Metal',
      AcidGlob: 'Toxic',
      AeroDarts: 'Wind',
      FrostShatter: 'Ice'
    };
    return mapping[weapon] ?? 'Normal';
  }
}

export function isBossCleared(id: BossId, save: SaveState) {
  return save.defeated[id];
}

export function weaknessHintFor(id: BossId) {
  return WEAKNESS_HINTS[id];
}
