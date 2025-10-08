import { BossId, SaveState, WeaponId } from '../types';

const STORAGE_KEY = 'aegis-x-save';

const defaultSave: SaveState = {
  defeated: {
    Rook: true,
    PyroMaw: false,
    TideReaver: false,
    VoltHopper: false,
    BasaltTitan: false,
    FerroBlade: false,
    MireWraith: false,
    GaleVixen: false,
    GlacierRonin: false
  },
  unlockedWeapons: ['Buster', 'ArcSlash'],
  equippedWeapon: 'Buster',
  options: {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    screenShake: true,
    colorblindMode: 'none',
    bindings: {}
  }
};

export class SaveSystem {
  private state: SaveState;

  constructor() {
    this.state = this.read() ?? defaultSave;
  }

  read(): SaveState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SaveState;
    } catch (err) {
      console.warn('Failed to read save', err);
      return null;
    }
  }

  write(state: SaveState) {
    this.state = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to write save', err);
    }
  }

  getState() {
    return this.state;
  }

  markBossDefeated(id: BossId, weapon: WeaponId) {
    const next: SaveState = {
      ...this.state,
      defeated: { ...this.state.defeated, [id]: true },
      unlockedWeapons: Array.from(new Set([...this.state.unlockedWeapons, weapon])),
      equippedWeapon: weapon
    };
    this.write(next);
  }
}

export function saveProgress(save: SaveSystem, state: SaveState) {
  save.write(state);
}

export function loadProgress(save: SaveSystem): SaveState | null {
  return save.read();
}
