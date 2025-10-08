import { Scene, Env } from './types';
import { InputManager } from './input/InputManager';
import { AudioManager } from './audio/AudioManager';
import { FXSystem } from './fx/FXSystem';
import { SaveSystem } from './save/SaveSystem';
import { HUD } from './hud/HUD';
import { Camera } from './camera/Camera';
import { SceneBoot } from './scenes/SceneBoot';

/**
 * Root game façade responsible for wiring subsystems together, running the main loop,
 * and delegating to the active scene for update/draw duties.
 */
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

  /** Boots the scene state machine and begins the requestAnimationFrame loop. */
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

  /** Tears down the active scene and disposes owned managers. */
  dispose() {
    this.rafId && cancelAnimationFrame(this.rafId);
    this.activeScene.exit();
    this.env.input.dispose();
  }

  /**
   * Polls input, advances the active scene, and updates global FX state.
   * @param dt Elapsed time since the previous frame in milliseconds.
   */
  update(dt: number) {
    this.env.input.update();
    this.activeScene.update(dt);
    this.env.fx.update(dt);
  }

  /** Delegates rendering to the active scene, HUD, and VFX layers. */
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.activeScene.draw(this.ctx);
    this.env.hud.draw(this.ctx);
    this.env.fx.draw(this.ctx);
  }

  /** Replaces the current scene with a new instance. */
  setScene(scene: Scene) {
    this.activeScene.exit();
    this.activeScene = scene;
    this.activeScene.enter();
  }

  /** Pushes a new scene on the stack while preserving the previous one. */
  pushScene(scene: Scene) {
    this.sceneStack.push(this.activeScene);
    this.activeScene = scene;
    this.activeScene.enter();
  }

  /** Restores the previous scene from the stack. */
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
