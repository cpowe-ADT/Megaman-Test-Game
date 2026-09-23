import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAYER_BODY_PROFILES,
  getPlayerBodyProfileBottom,
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
