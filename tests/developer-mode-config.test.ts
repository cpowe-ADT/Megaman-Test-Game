import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAutomationConfig } from '../src/config/automation'
import { resolveDeveloperModeConfig } from '../src/config/developerMode'
import { resolveEnemyFeatureFlags } from '../src/enemy/featureFlags'
import { resolvePlayerFeatureFlags } from '../src/player/featureFlags'

test('developer mode defaults all optional combat visuals off', () => {
  const config = resolveDeveloperModeConfig({})

  assert.equal(config.enabled, false)
  assert.equal(config.showCombatDebugVisuals, false)
  assert.equal(config.showFrameData, false)
  assert.equal(config.showUiDebug, false)
})

test('combat debug visuals stay off unless developer mode is enabled', () => {
  const playerFlagsWithoutDev = resolvePlayerFeatureFlags({
    VITE_ENABLE_DEBUG_HITBOXES: 'true',
    VITE_SHOW_COMBAT_DEBUG_VISUALS: 'true'
  })
  const enemyFlagsWithoutDev = resolveEnemyFeatureFlags({
    VITE_ENABLE_ENEMY_DEBUG: 'true',
    VITE_SHOW_COMBAT_DEBUG_VISUALS: 'true'
  })

  assert.equal(playerFlagsWithoutDev.enableDebugHitboxes, false)
  assert.equal(enemyFlagsWithoutDev.enableEnemyDebug, false)
})

test('developer mode can re-enable combat visuals explicitly', () => {
  const playerFlags = resolvePlayerFeatureFlags({
    VITE_DEVELOPER_MODE: 'true',
    VITE_SHOW_COMBAT_DEBUG_VISUALS: 'true',
    VITE_ENABLE_DEBUG_HITBOXES: 'true'
  })
  const enemyFlags = resolveEnemyFeatureFlags({
    VITE_DEVELOPER_MODE: 'true',
    VITE_SHOW_COMBAT_DEBUG_VISUALS: 'true',
    VITE_ENABLE_ENEMY_DEBUG: 'true'
  })

  assert.equal(playerFlags.enableDebugHitboxes, true)
  assert.equal(enemyFlags.enableEnemyDebug, true)
})

test('automation controls are opt-in through query or automation env flags', () => {
  assert.equal(resolveAutomationConfig({}, '').enabled, false)
  assert.equal(resolveAutomationConfig({}, '?automation=1').enabled, true)
  assert.equal(resolveAutomationConfig({ VITE_AUTOMATION: '1' }, '').enabled, true)
  assert.equal(resolveAutomationConfig({ VITE_SMOKE: '1' }, '').enabled, true)
})
