import { V2 } from '../types';

type Particle = {
  pos: V2;
  vel: V2;
  life: number;
  maxLife: number;
  color: string;
};

export class FXSystem {
  private particles: Particle[] = [];
  private shakeAmount = 0;
  private shakeDecay = 0;
  private shakeOffset: V2 = { x: 0, y: 0 };

  emit(type: 'spark' | 'ember' | 'droplet' | 'smoke', pos: V2, params?: Partial<Particle>) {
    const colors: Record<'spark' | 'ember' | 'droplet' | 'smoke', string> = {
      spark: '#6df8ff',
      ember: '#ff8a40',
      droplet: '#67b7ff',
      smoke: '#88ff9a'
    } as const;
    const color = colors[type];
    this.particles.push({
      pos: { ...pos },
      vel: params?.vel ?? { x: (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.2 },
      life: params?.life ?? 400,
      maxLife: params?.life ?? 400,
      color
    });
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.shakeAmount > 0) {
      this.shakeAmount = Math.max(0, this.shakeAmount - this.shakeDecay * dt);
      this.shakeOffset = {
        x: (Math.random() - 0.5) * this.shakeAmount,
        y: (Math.random() - 0.5) * this.shakeAmount
      };
    } else {
      this.shakeOffset = { x: 0, y: 0 };
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = this.applyAlpha(p.color, alpha);
      ctx.fillRect(p.pos.x, p.pos.y, 2, 2);
    }
    ctx.restore();
  }

  shake(amount: number, decay: number = 0.003) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeDecay = decay;
  }

  private applyAlpha(color: string, alpha: number) {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const bigint = parseInt(hex, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    }
    return color;
  }
}

export function spawnParticles(fx: FXSystem, kind: string, at: V2, n: number) {
  for (let i = 0; i < n; i++) {
    fx.emit(kind as any, at);
  }
}

export function setShake(fx: FXSystem, amount: number, decayPerFrame: number) {
  fx.shake(amount, decayPerFrame);
}
