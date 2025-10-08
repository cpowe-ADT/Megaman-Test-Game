import { Scene, Env } from './types';
import { InputManager } from './input/InputManager';
import { AudioManager } from './audio/AudioManager';
import { FXSystem } from './fx/FXSystem';
import { SaveSystem } from './save/SaveSystem';
import { HUD } from './hud/HUD';
import { Camera } from './camera/Camera';
import { SceneBoot } from './scenes/SceneBoot';

export class Game {
  private ctx: CanvasRenderingContext2D;
  private activeScene: Scene;
  private lastTime = 0;
  private rafId: number | null = null;
  private env: Env;
  private sceneStack: Scene[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    const input = new InputManager(canvas);
    const audio = new AudioManager();
    const fx = new FXSystem();
    const save = new SaveSystem();
    const hud = new HUD();
    const camera = new Camera();

    this.env = { canvas, ctx, input, audio, fx, save, hud, camera };
    this.activeScene = new SceneBoot(this, this.env);
  }

  start() {
    this.activeScene.enter();
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const dt = time - this.lastTime;
      this.lastTime = time;
      this.update(dt);
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  dispose() {
    this.rafId && cancelAnimationFrame(this.rafId);
    this.activeScene.exit();
    this.env.input.dispose();
  }

  update(dt: number) {
    this.env.input.update();
    this.activeScene.update(dt);
    this.env.fx.update(dt);
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.activeScene.draw(this.ctx);
    this.env.hud.draw(this.ctx);
    this.env.fx.draw(this.ctx);
  }

  setScene(scene: Scene) {
    this.activeScene.exit();
    this.activeScene = scene;
    this.activeScene.enter();
  }

  pushScene(scene: Scene) {
    this.sceneStack.push(this.activeScene);
    this.activeScene = scene;
    this.activeScene.enter();
  }

  popScene() {
    this.activeScene.exit();
    const previous = this.sceneStack.pop();
    if (!previous) throw new Error('No previous scene to pop to');
    this.activeScene = previous;
  }

  getEnv(): Env {
    return this.env;
  }
}
