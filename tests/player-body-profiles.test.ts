import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAYER_BODY_PROFILES,
  getPlayerBodyProfileBottom,
  keepBodyUnscaled,
  resolvePlayerBodyProfileKey
} from '../src/player/PlayerBodyProfiles'

test('player grounded body profiles keep a shared floor-contact baseline', () => {
  const standBottom = getPlayerBodyProfileBottom('stand')
  const crouchBottom = getPlayerBodyProfileBottom('crouch')
  const dashBottom = getPlayerBodyProfileBottom('dash')

  assert.equal(standBottom, crouchBottom)
  assert.equal(standBottom, dashBottom)
})

test('player body profile resolver keeps crouch distinct from dash', () => {
  assert.equal(resolvePlayerBodyProfileKey({ locomotion: 'idle' }), 'stand')
  assert.equal(resolvePlayerBodyProfileKey({ locomotion: 'crouch' }), 'crouch')
  assert.equal(resolvePlayerBodyProfileKey({ locomotion: 'dash' }), 'dash')
  assert.equal(resolvePlayerBodyProfileKey({ locomotion: 'air_dash' }), 'dash')
  assert.equal(resolvePlayerBodyProfileKey({ locomotion: 'wall_slide' }), 'stand')
  assert.equal(resolvePlayerBodyProfileKey({ locomotion: 'wall_jump' }), 'stand')
})

test('crouch profile remains taller than dash so the pose does not collapse into a slide silhouette', () => {
  assert.equal(PLAYER_BODY_PROFILES.crouch.height > PLAYER_BODY_PROFILES.dash.height, true)
})

/** A stand-in for an Arcade body: `updateBounds` scales the size like Phaser's does, and the position
 * rule is Phaser's `updateFromGameObject` (sprite y + scaleY * (offset.y - displayOriginY)). */
function fakeBody(scaleX: number, scaleY: number) {
  const profile = PLAYER_BODY_PROFILES.stand
  const body = {
    sourceWidth: profile.width,
    sourceHeight: profile.height,
    width: profile.width,
    height: profile.height,
    halfWidth: profile.width / 2,
    halfHeight: profile.height / 2,
    offset: { x: profile.offsetX, y: profile.offsetY },
    transform: { scaleX, scaleY, displayOriginX: 24, displayOriginY: 24 },
    updateBounds() {
      body.width = body.sourceWidth * Math.abs(body.transform.scaleX)
      body.height = body.sourceHeight * Math.abs(body.transform.scaleY)
    },
    updateCenter() {}
  }
  const top = (spriteY: number) => spriteY + body.transform.scaleY * (body.offset.y - body.transform.displayOriginY)
  const left = (spriteX: number) => spriteX + body.transform.scaleX * (body.offset.x - body.transform.displayOriginX)
  return { body, top, left, profile }
}

test('a scaled hero sprite (beam-in, landing squash) keeps the standing body size and place', () => {
  for (const [sx, sy] of [[0.2, 1.8], [1.18, 0.78], [1, 1]]) {
    const { body, top, left, profile } = fakeBody(sx, sy)
    keepBodyUnscaled(body, profile)
    body.updateBounds()
    assert.equal(body.width, profile.width, `width at scale ${sx}x${sy}`)
    assert.equal(body.height, profile.height, `height at scale ${sx}x${sy}`)
    // Respawn line y 210: the body's feet stay 4px above the floor top (236) whatever the scale.
    assert.ok(Math.abs(top(210) + body.height - 232) < 1e-9, `feet at scale ${sx}x${sy}: ${top(210) + body.height}`)
    assert.ok(Math.abs(left(100) - (100 + profile.offsetX - 24)) < 1e-9, `left edge at scale ${sx}x${sy}`)
  }
})

test('without the lock the beam-in body reaches 14px into the floor (the respawn-loop bug)', () => {
  const { body, top } = fakeBody(0.2, 1.8)
  body.updateBounds()
  assert.ok(top(210) + body.height > 236 + 10)
})

test('the scale lock follows a later profile change', () => {
  const { body, top } = fakeBody(1, 0.78)
  keepBodyUnscaled(body, PLAYER_BODY_PROFILES.stand)
  body.sourceWidth = PLAYER_BODY_PROFILES.crouch.width
  body.sourceHeight = PLAYER_BODY_PROFILES.crouch.height
  keepBodyUnscaled(body, PLAYER_BODY_PROFILES.crouch)
  body.updateBounds()
  assert.equal(body.height, PLAYER_BODY_PROFILES.crouch.height)
  assert.ok(Math.abs(top(200) - (200 + PLAYER_BODY_PROFILES.crouch.offsetY - 24)) < 1e-9)
})
