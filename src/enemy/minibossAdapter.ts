import Phaser from 'phaser'
import AudioService from '../audio'
import type { SfxAssetKey } from '../audio/sfxLibrary'
import type { SolidRect } from './floorProbe'

/**
 * Phaser helpers the 12c mini-boss brains share (relay turret nest, sentry twins, drill serpent): the
 * small health bar a mini-boss carries over itself (the HUD's boss bar belongs to the stage boss), the
 * stage's solid rectangles for the floor probes, and brain-owned animations cut from a family's atlas.
 */
export const MINIBOSS_BAR = { width: 36, height: 3, back: 0x140806 } as const

export type MinibossSound = 'tell' | 'shot' | 'bolt' | 'mortar' | 'impact' | 'dash' | 'burst' | 'stomp' | 'shockwave'

/** Mini-boss sounds: the custodian's stomp and its shockwave have their own (12h); the rest reuse the SFX set (12c). */
export const MINIBOSS_SFX: Record<MinibossSound, SfxAssetKey> = {
  tell: 'charge_start',
  shot: 'shot_basic',
  bolt: 'shot_charge_lv1',
  mortar: 'shot_charge_lv2',
  impact: 'land',
  dash: 'dash',
  burst: 'sword_hit',
  stomp: 'miniboss_stomp',
  shockwave: 'miniboss_shockwave'
}

export function playMinibossSfx(sound: MinibossSound): void {
  AudioService.playSfx(MINIBOSS_SFX[sound])
}

export class MinibossHealthBar {
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly color: number
  private drawnHp = -1

  constructor(scene: Phaser.Scene, color: number) {
    this.color = color
    this.graphics = scene.add.graphics().setDepth(4).setVisible(false)
  }

  get visible(): boolean {
    return this.graphics.visible
  }

  /** Centred over (`x`, `top`); redraws only when the hp changed. */
  draw(x: number, top: number, hp: number, maxHp: number, visible: boolean): void {
    this.graphics.setVisible(visible)
    if (!visible) {
      return
    }
    this.graphics.setPosition(Math.round(x - MINIBOSS_BAR.width / 2), Math.round(top - 8))
    if (hp === this.drawnHp) {
      return
    }
    this.drawnHp = hp
    const fill = Math.round((MINIBOSS_BAR.width - 2) * Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1))
    this.graphics.clear()
    this.graphics.fillStyle(MINIBOSS_BAR.back, 1).fillRect(0, 0, MINIBOSS_BAR.width, MINIBOSS_BAR.height + 2)
    this.graphics.fillStyle(this.color, 1).fillRect(1, 1, fill, MINIBOSS_BAR.height)
  }

  hide(): void {
    this.graphics.setVisible(false)
  }

  destroy(): void {
    this.graphics.destroy()
  }
}

/** The stage's solid rectangles (ground, blocks, walls), read once from the static group. */
export function readSolidRects(group: Phaser.Physics.Arcade.StaticGroup | undefined): SolidRect[] {
  const rects: SolidRect[] = []
  group?.getChildren().forEach((child) => {
    const body = (child as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody }).body
    if (body) {
      rects.push({ left: body.x, right: body.x + body.width, top: body.y, bottom: body.y + body.height })
    }
  })
  return rects
}

/** The solid top under `x` at or below `fromY` (the floor a flyer's dash must clear), or `fallback`. */
export function floorTopUnder(solids: readonly SolidRect[], x: number, fromY: number, fallback: number): number {
  const tops = solids.filter((rect) => x >= rect.left && x <= rect.right && rect.top >= fromY).map((rect) => rect.top)
  return tops.length > 0 ? Math.min(...tops) : fallback
}

/**
 * Creates `key` from the named frames of `atlas_<typeKey>` once per game (frames that do not exist are
 * skipped; nothing is created if none do). Returns whether the animation exists.
 */
export function ensureAtlasAnimation(
  scene: Phaser.Scene,
  typeKey: string,
  key: string,
  frames: readonly string[],
  frameRate: number,
  repeat: number
): boolean {
  if (scene.anims.exists(key)) {
    return true
  }
  const atlasKey = `atlas_${typeKey}`
  if (!scene.textures.exists(atlasKey)) {
    return false
  }
  const texture = scene.textures.get(atlasKey)
  const resolved = frames.map((frame) => `${typeKey}/${frame}`).filter((frame) => texture.has(frame))
  if (resolved.length === 0) {
    return false
  }
  scene.anims.create({ key, frames: resolved.map((frame) => ({ key: atlasKey, frame })), frameRate, repeat })
  return true
}
