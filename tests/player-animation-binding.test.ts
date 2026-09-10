import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePlayerAtlasBinding } from '../src/player/PlayerAtlasBindings'

test('player slash bindings resolve to sword-specific atlas groups', () => {
  assert.deepEqual(resolvePlayerAtlasBinding('player_slash_ground_e'), {
    prefixes: ['player_main/slash_ground_e/'],
    start: 0,
    end: 3
  })
  assert.deepEqual(resolvePlayerAtlasBinding('player_slash_ground_n'), {
    prefixes: ['player_main/slash_ground_n/'],
    start: 0,
    end: 3
  })
  assert.deepEqual(resolvePlayerAtlasBinding('player_slash_air_se'), {
    prefixes: ['player_main/slash_air_se/'],
    start: 0,
    end: 3
  })
})

test('player slash bindings intentionally mirror west-facing poses to east-side atlas groups', () => {
  assert.deepEqual(resolvePlayerAtlasBinding('player_slash_ground_w'), {
    prefixes: ['player_main/slash_ground_e/'],
    start: 0,
    end: 3
  })
  assert.deepEqual(resolvePlayerAtlasBinding('player_slash_ground_nw'), {
    prefixes: ['player_main/slash_ground_ne/'],
    start: 0,
    end: 3
  })
  assert.deepEqual(resolvePlayerAtlasBinding('player_slash_air_sw'), {
    prefixes: ['player_main/slash_air_se/'],
    start: 0,
    end: 3
  })
})

test('wall locomotion bindings resolve to dedicated wall atlas groups', () => {
  assert.deepEqual(resolvePlayerAtlasBinding('player_wall_slide'), {
    prefixes: ['player_main/wall_slide/'],
    start: 0,
    end: 0
  })
  assert.deepEqual(resolvePlayerAtlasBinding('player_wall_jump'), {
    prefixes: ['player_main/wall_jump/'],
    start: 0,
    end: 0
  })
})
