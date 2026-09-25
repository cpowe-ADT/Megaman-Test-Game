import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerCombat } from '../src/player/PlayerCombat'
import { FEEL_FRAME_MS, PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'
import { DEFAULT_PLAYER_FEATURE_FLAGS } from '../src/player/featureFlags'
import type { PlayerIntent, PlayerRuntimeEvent } from '../src/player/types'

// Part 12h (EVAL-P12-004): each combo hit and the air spin plays its own saber sound.

function intent(slashPressed: boolean): PlayerIntent {
  return {
    moveAxis: 0,
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    dashPressed: false,
    dashHeld: false,
    dashReleased: false,
    shootPressed: false,
    shootHeld: false,
    shootReleased: false,
    slashPressed,
    crouchHeld: false,
    aim: { x: 1, y: 0 }
  }
}

function saberSounds(grounded: boolean, pressEveryFrames: number, frames: number): string[] {
  const player = { scene: { time: { now: 0 }, events: { emit: () => {} } }, setFlipX: () => {} } as any
  const combat = new PlayerCombat(
    player,
    { ...DEFAULT_PLAYER_FEATURE_FLAGS, enableChargeShot: false },
    PLAYER_GAMEPLAY_CONFIG.blaster,
    PLAYER_GAMEPLAY_CONFIG.sword,
    PLAYER_GAMEPLAY_CONFIG.damage,
    { onDamageAccepted: () => {}, onKnockback: () => {} }
  )
  const events: PlayerRuntimeEvent[] = []
  for (let frame = 0; frame < frames; frame += 1) {
    const press = frame % pressEveryFrames === 0
    events.push(...combat.update(intent(press), frame * FEEL_FRAME_MS, FEEL_FRAME_MS, 1, grounded, false).events)
  }
  return events.flatMap((event) => (event.type === 'sfx' && /^(saber_|sword_)/.test(event.key) ? [event.key] : []))
}

test('the ground combo plays saber_combo_1, _2 and _3 in order, one per hit', () => {
  assert.ok(PLAYER_GAMEPLAY_CONFIG.sword.comboEnabled, 'the combo is on in the shipped config')
  assert.deepEqual(saberSounds(true, 6, 90).slice(0, 3), ['saber_combo_1', 'saber_combo_2', 'saber_combo_3'])
})

test('a single ground slash plays hit 1; an air slash plays the air spin; the old swing key is gone', () => {
  assert.deepEqual(saberSounds(true, 1000, 40), ['saber_combo_1'])
  assert.deepEqual(saberSounds(false, 1000, 40), ['saber_air_spin'])
})
