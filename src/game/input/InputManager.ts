const DEFAULT_BINDINGS: Record<string, string[]> = {
  MoveLeft: ['ArrowLeft', 'KeyA'],
  MoveRight: ['ArrowRight', 'KeyD'],
  MoveUp: ['ArrowUp', 'KeyW'],
  MoveDown: ['ArrowDown', 'KeyS'],
  Jump: ['KeyZ', 'KeyK', 'Space'],
  Dash: ['KeyX', 'KeyJ'],
  Blaster: ['KeyC', 'KeyL'],
  Sword: ['KeyV', 'KeyI'],
  WeaponPrev: ['KeyQ'],
  WeaponNext: ['KeyE'],
  Pause: ['KeyP'],
  Reset: ['KeyR']
};

export class InputManager {
  private pressed: Set<string> = new Set();
  private down: Set<string> = new Set();
  private bindings: Record<string, string[]> = { ...DEFAULT_BINDINGS };
  private framePressed: Set<string> = new Set();
  private pendingPressed: Set<string> = new Set();
  private listener?: (e: KeyboardEvent) => void;
  private keyUpListener?: (e: KeyboardEvent) => void;

  constructor(private element: HTMLElement) {
    this.listener = this.onKeyDown.bind(this);
    this.keyUpListener = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.listener);
    window.addEventListener('keyup', this.keyUpListener);
    element.tabIndex = 0;
    element.addEventListener('click', () => element.focus());
  }

  update() {
    this.framePressed = new Set(this.pendingPressed);
    this.pendingPressed.clear();
  }

  isDown(action: string): boolean {
    const keys = this.bindings[action] ?? [];
    return keys.some((key) => this.down.has(key));
  }

  pressedAction(action: string): boolean {
    const keys = this.bindings[action] ?? [];
    return keys.some((key) => this.framePressed.has(key));
  }

  bind(map: Record<string, string[]>) {
    this.bindings = { ...this.bindings, ...map };
  }

  rebind(action: string, keys: string[]) {
    this.bindings[action] = [...keys];
  }

  getBindings() {
    return { ...this.bindings };
  }

  dispose() {
    this.listener && window.removeEventListener('keydown', this.listener);
    this.keyUpListener && window.removeEventListener('keyup', this.keyUpListener);
  }

  private onKeyDown(e: KeyboardEvent) {
    this.down.add(e.code);
    if (!this.pressed.has(e.code)) {
      this.pendingPressed.add(e.code);
      this.pressed.add(e.code);
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.down.delete(e.code);
    this.pressed.delete(e.code);
  }
}

export function bindDefaultKeys(input: InputManager) {
  input.bind(DEFAULT_BINDINGS);
}

export function updateInputFrame(input: InputManager) {
  input.update();
}
