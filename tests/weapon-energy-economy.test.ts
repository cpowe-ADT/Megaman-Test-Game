import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getHolsteredWeaponRechargeTargets,
  rechargeWeaponEnergyValue,
  resolveBalancedWeaponEnergyCost
} from '../src/content/weaponEnergyEconomy'

test('special weapon costs are compressed into a sustainable one-to-three energy range', () => {
  assert.equal(resolveBalancedWeaponEnergyCost(0), 0)
  assert.equal(resolveBalancedWeaponEnergyCost(2), 1)
  assert.equal(resolveBalancedWeaponEnergyCost(4), 2)
  assert.equal(resolveBalancedWeaponEnergyCost(5), 3)
  assert.equal(resolveBalancedWeaponEnergyCost(9), 3)
})

test('weapon recharge clamps to capacity and reports the restored amount', () => {
  assert.deepEqual(rechargeWeaponEnergyValue(0, 24, 2), { next: 2, restored: 2 })
  assert.deepEqual(rechargeWeaponEnergyValue(23, 24, 2), { next: 24, restored: 1 })
  assert.deepEqual(rechargeWeaponEnergyValue(24, 24, 2), { next: 24, restored: 0 })
})

test('passive recharge targets holstered specials and excludes Buster and the selected weapon', () => {
  assert.deepEqual(
    getHolsteredWeaponRechargeTargets(['Buster', 'FlameSerpent', 'HydroLance'], 'FlameSerpent'),
    ['HydroLance']
  )
  assert.deepEqual(
    getHolsteredWeaponRechargeTargets(['Buster', 'FlameSerpent', 'HydroLance'], 'Buster'),
    ['FlameSerpent', 'HydroLance']
  )
})
