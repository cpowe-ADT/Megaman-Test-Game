import test from 'node:test'
import assert from 'node:assert/strict'
import { assertPelletHitEvidence } from '../scripts/smoke/assert-pellet-hit.mjs'

function validEvidence() {
  return {
    baseline: { id: 'mine-1', hp: 5 },
    result: { id: 'mine-1', hp: 4, active: true, bodyEnabled: true },
    shot: { projectileId: 'player_weapon_Buster', weaponId: 'Buster', chargeLevel: 0, damage: 1 },
    shotsFired: 1,
    acceptedEnemyHits: 1,
    hits: [{ source: 'player', target: 'enemy', kind: 'bullet', accepted: true, amount: 1 }]
  }
}

test('pellet evidence accepts one ordinary Buster hit on the retained live mine bot', () => {
  assert.doesNotThrow(() => assertPelletHitEvidence(validEvidence()))
})

test('pellet evidence rejects a missing target instead of treating missing HP as a kill', () => {
  const evidence = validEvidence()
  evidence.result = { id: null, hp: 0, active: false, bodyEnabled: false } as any
  assert.throws(() => assertPelletHitEvidence(evidence))
})

test('pellet evidence rejects charged-shot damage', () => {
  const evidence = validEvidence()
  evidence.shot = { projectileId: 'player_buster_charge_lv1', weaponId: 'Buster', chargeLevel: 1, damage: 2 }
  evidence.result.hp = 3
  assert.throws(() => assertPelletHitEvidence(evidence))
})

test('pellet evidence rejects unrelated damage without an accepted player bullet hit', () => {
  const evidence = validEvidence()
  evidence.hits = [{ source: 'system', target: 'enemy', kind: 'hazard', accepted: true, amount: 1 }]
  assert.throws(() => assertPelletHitEvidence(evidence))
})

test('pellet evidence rejects multiple shots or damage on another enemy', () => {
  const repeated = validEvidence()
  repeated.shotsFired = 2
  assert.throws(() => assertPelletHitEvidence(repeated))
  const replaced = validEvidence()
  replaced.result.id = 'mine-2'
  assert.throws(() => assertPelletHitEvidence(replaced))
})
