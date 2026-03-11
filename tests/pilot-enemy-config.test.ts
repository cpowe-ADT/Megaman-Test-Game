import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePilotEnemyConfig } from '../src/content/enemies/validatePilotEnemyConfig'
import { applyPilotEnemyOverride } from '../src/enemy/EnemyDefinitionAdapters'

const pilotConfigFixture = {
  schemaVersion: '1',
  id: 'enemy_gunner_bot',
  displayName: 'Gunner Bot',
  hp: 5,
  traits: ['grounded', 'ranged'],
  movement: {
    profile: 'ground_patrol',
    params: {
      speed: 70
    }
  },
  combat: {
    contactDamage: 2,
    iFrameMs: 80,
    hitstunLightMs: 130,
    hitstunHeavyMs: 240,
    knockbackResist: 0.25
  },
  attack: {
    type: 'projectile',
    cooldownMs: 850,
    windupMs: 160,
    activeMs: 120,
    recoveryMs: 220,
    range: 180,
    projectileKey: 'enemy_shot_basic'
  },
  animationKeys: {
    idle: 'enemy_gunner_bot_idle',
    move: 'enemy_gunner_bot_move',
    attackWindup: 'enemy_gunner_bot_attack_windup',
    attackActive: 'enemy_gunner_bot_attack_active',
    hurt: 'enemy_gunner_bot_hurt',
    death: 'enemy_gunner_bot_death'
  }
}

test('pilot enemy config validator accepts valid fixture', () => {
  const result = validatePilotEnemyConfig(pilotConfigFixture)
  assert.equal(result.valid, true)
  if (result.valid) {
    assert.equal(result.data.id, 'enemy_gunner_bot')
  }
})

test('pilot enemy adapter preserves shape and overrides key combat fields', () => {
  const result = validatePilotEnemyConfig(pilotConfigFixture)
  assert.equal(result.valid, true)
  if (!result.valid) {
    return
  }

  const adapted = applyPilotEnemyOverride('enemy_gunner_bot', result.data)
  assert.ok(adapted)
  assert.equal(adapted?.typeKey, 'enemy_gunner_bot')
  assert.equal(adapted?.stats.hp, result.data.hp)
  assert.equal(adapted?.stats.speed, result.data.movement.params?.speed)
  assert.equal(adapted?.attack.cooldownMs, result.data.attack.cooldownMs)
  assert.equal(adapted?.animations.idle, result.data.animationKeys.idle)
})
