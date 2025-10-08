export type V2 = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type Element =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Lightning'
  | 'Earth'
  | 'Metal'
  | 'Toxic'
  | 'Wind'
  | 'Ice';

export type WeaponId =
  | 'Buster'
  | 'ArcSlash'
  | 'FlameSerpent'
  | 'HydroLance'
  | 'ThunderSpike'
  | 'QuakeKnuckle'
  | 'MagcutDisc'
  | 'AcidGlob'
  | 'AeroDarts'
  | 'FrostShatter';

export type BossId =
  | 'Rook'
  | 'PyroMaw'
  | 'TideReaver'
  | 'VoltHopper'
  | 'BasaltTitan'
  | 'FerroBlade'
  | 'MireWraith'
  | 'GaleVixen'
  | 'GlacierRonin';

export type Theme = {
  primaryBG: string;
  accent: string;
  glow: string;
  nameplate: string;
};

export interface SaveState {
  defeated: Record<BossId, boolean>;
  unlockedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  options: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    screenShake: boolean;
    colorblindMode: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
    bindings: Record<string, string[]>;
  };
}

export interface Scene {
  enter(args?: any): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  exit(): void;
}

export interface Env {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: import('./input/InputManager').InputManager;
  audio: import('./audio/AudioManager').AudioManager;
  fx: import('./fx/FXSystem').FXSystem;
  save: import('./save/SaveSystem').SaveSystem;
  hud: import('./hud/HUD').HUD;
  camera: import('./camera/Camera').Camera;
}
