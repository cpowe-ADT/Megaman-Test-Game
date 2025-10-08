import { Env, Scene } from '../types';
import { Game } from '../Game';

export abstract class BaseScene implements Scene {
  protected constructor(protected game: Game, protected env: Env) {}
  abstract enter(args?: any): void;
  abstract update(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;
  abstract exit(): void;
}
