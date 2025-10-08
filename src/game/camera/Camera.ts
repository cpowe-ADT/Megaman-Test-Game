import { V2 } from '../types';

export class Camera {
  position: V2 = { x: 0, y: 0 };
  target: V2 = { x: 0, y: 0 };

  update(dt: number) {
    this.position.x += (this.target.x - this.position.x) * Math.min(1, dt * 0.01);
    this.position.y += (this.target.y - this.position.y) * Math.min(1, dt * 0.01);
  }

  focus(point: V2) {
    this.target = point;
  }
}
