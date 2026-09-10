import assert from 'node:assert/strict'

export function assertPelletHitEvidence(evidence) {
  const { baseline, result, shot, shotsFired, acceptedEnemyHits, hits } = evidence
  assert.ok(baseline.id, 'Expected an identified mine bot before the shot.')
  assert.equal(baseline.hp, 5, 'Expected the standard mine bot to begin at 5 HP.')
  assert.equal(result.id, baseline.id, 'Expected the same mine bot after the shot, not a despawn.')
  assert.equal(result.active, true, 'Expected the damaged mine bot to remain active.')
  assert.equal(result.bodyEnabled, true, 'Expected the damaged mine bot body to remain enabled.')
  assert.equal(result.hp, 4, 'Expected exactly one uncharged Buster damage: 5 -> 4 HP.')
  assert.equal(shot?.projectileId, 'player_weapon_Buster', 'Expected an ordinary Buster projectile.')
  assert.equal(shot?.weaponId, 'Buster')
  assert.equal(shot?.chargeLevel, 0, 'Expected an uncharged shot.')
  assert.equal(shot?.damage, 1)
  assert.equal(shotsFired, 1, 'Expected exactly one shot during the isolated encounter.')
  assert.equal(acceptedEnemyHits, 1, 'Expected exactly one accepted enemy hit.')
  assert.ok(hits.some((hit) => hit.source === 'player' && hit.target === 'enemy' &&
    hit.kind === 'bullet' && hit.accepted === true && hit.amount === 1),
  'Expected attributable one-damage player bullet contact.')
}
