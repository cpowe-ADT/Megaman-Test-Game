import type Phaser from 'phaser'
import { WEAPONS_ATLAS, weaponArtFrame } from '../weaponArt'
import { freezeBlockRect, landsOnFreezeBlock } from '../weaponEffects'

type SceneLike = Phaser.Scene & { add?: Phaser.GameObjects.GameObjectFactory; physics?: Phaser.Physics.Arcade.ArcadePhysics }
type Point = { x: number; y: number }

function sceneOf(sprite: unknown): SceneLike | undefined {
  const scene = (sprite as { scene?: SceneLike } | undefined)?.scene
  return scene?.add && scene.time ? scene : undefined
}

/**
 * The drawn half of the on-hit tags the collision router applies (prompt 07 phase 7.3): the chain's arcs, the acid
 * glob stuck to an enemy, and FrostShatter's ice block. The rules live in `weaponEffects.ts`; with no scene (unit
 * tests) every call is a no-op.
 */
export const weaponOnHitEffects = {
  chainArc(from: Point & { scene?: unknown }, to: Point, durationMs: number): void {
    const scene = sceneOf(from)
    const g = scene?.add.graphics()
    if (!scene || !g) return
    g.setDepth(3)
    g.lineStyle(2, 0xfff066, 1)
    g.beginPath()
    g.moveTo(from.x, from.y)
    const steps = 4
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps
      g.lineTo(from.x + (to.x - from.x) * t + (i % 2 ? -4 : 4), from.y + (to.y - from.y) * t + (i % 2 ? 4 : -4))
    }
    g.lineTo(to.x, to.y)
    g.strokePath()
    scene.time.delayedCall(durationMs, () => g.destroy())
  },

  /** An acid glob drawn on the enemy until its last tick. */
  stickGlob(enemy: Phaser.Physics.Arcade.Sprite, durationMs: number): void {
    const scene = sceneOf(enemy)
    if (!scene) return
    const glob = scene.add.sprite(enemy.x, enemy.y, WEAPONS_ATLAS.key, weaponArtFrame('acid_glob', 0)).setScale(0.45).setDepth(3).setAlpha(0.9)
    const follow = () => {
      if (!glob.active) return
      glob.setPosition(enemy.x, enemy.y)
      glob.setVisible(enemy.active)
    }
    scene.events.on('postupdate', follow)
    scene.time.delayedCall(durationMs, () => {
      scene.events.off('postupdate', follow)
      glob.destroy()
    })
  },

  /**
   * FrostShatter: the enemy is tinted ice-blue and cased in an ice block the player can land on (one way, from above)
   * until the freeze ends. The block follows the enemy, so a heavy enemy that shrugs the stun carries it along.
   */
  freeze(enemy: Phaser.Physics.Arcade.Sprite, player: Phaser.Physics.Arcade.Sprite | undefined, durationMs: number): void {
    const scene = sceneOf(enemy)
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body | undefined
    if (!scene?.physics || !enemyBody) return
    enemy.setTint?.(0x9fe8ff)
    enemy.data?.set?.('frozenUntil', scene.time.now + durationMs)
    const rect = freezeBlockRect({ x: enemyBody.x, y: enemyBody.y, width: enemyBody.width, height: enemyBody.height })
    const block = scene.add.rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height, 0x9fe8ff, 0.35).setDepth(3)
    block.setStrokeStyle(1, 0xe8fbff, 0.9)
    scene.physics.add.existing(block)
    const blockBody = block.body as Phaser.Physics.Arcade.Body
    blockBody.setAllowGravity(false)
    blockBody.setImmovable(true)
    const collider = player
      ? scene.physics.add.collider(player, block, undefined, () => {
          const body = player.body as Phaser.Physics.Arcade.Body | undefined
          return Boolean(body && landsOnFreezeBlock(body.bottom, body.velocity.y, blockBody.top))
        })
      : undefined
    const follow = () => {
      const body = enemy.body as Phaser.Physics.Arcade.Body | undefined
      if (!enemy.active || !body) return
      const next = freezeBlockRect({ x: body.x, y: body.y, width: body.width, height: body.height })
      blockBody.reset(next.x + next.width / 2, next.y + next.height / 2)
    }
    scene.events.on('postupdate', follow)
    scene.time.delayedCall(durationMs, () => {
      scene.events.off('postupdate', follow)
      collider?.destroy()
      block.destroy()
      if (enemy.active) enemy.clearTint?.()
    })
  }
}
