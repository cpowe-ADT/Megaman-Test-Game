import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { BOSS_ROSTER } from '../src/bosses/roster'
import { bossPhaseIndex, damageMultiplier, resolveBossElementHit, WeaknessTable, type BossId, type Element } from '../src/bosses/types'
import { clampWeaponEnergy, clampWeaponEnergySnapshot, getChargedFormConfig, getWeaponConfig, SPECIAL_WEAPON_ORDER, WEAPON_TUNING } from '../src/content/weapons'
import { createCoreProjectileDefinitions } from '../src/projectiles/definitions/coreProjectiles'
import { ProjectileCollisionRouter } from '../src/projectiles/collision/ProjectileCollisionRouter'
import { resolvePlayerShot } from '../src/projectiles/playerShot'
import { firePlayerShot } from '../src/projectiles/firePlayerShot'
import { bossDamageScale } from '../src/scenes/game/combatRules'
import {
  HUD_ICONS_ATLAS,
  WEAPON_ART_FRAME_SIZE,
  WEAPON_ART_GROUPS,
  WEAPONS_ATLAS,
  WEAPONS_CHARGED_ATLAS,
  weaponArtFrame,
  weaponHudIconFrame
} from '../src/projectiles/weaponArt'
import {
  bounceVelocity,
  BURN_PUDDLE_PROJECTILE_ID,
  classifyImpact,
  landsOnFreezeBlock,
  magnetPullVelocity,
  QUAKE_WAVE_PROJECTILE_ID,
  resolveChainTargets,
  resolveImpactFollowUp,
  shotAngleDeg,
  streamShouldFire
} from '../src/projectiles/weaponEffects'
import { GAME_SCENE_ATLASES } from '../src/scenes/game/stageBackgroundLoading'
import { generateClassicWorld } from '../src/progression/seed'

/**
 * One hold or charge behaviour and one on-hit tag per warden weapon (prompt 07 phase 7.3), and its energy
 * tier and range (13d, EVAL-P13-007, docs/design/weapons.md): light 1, medium 2 or heavy 4 of a 28-unit
 * bar; `lifetimeMs` is the generous view-edge backstop for a straight shot (`standard`) or its own motion's
 * timer for a lob, boomerang or stream.
 */
const IDENTITIES = {
  FlameSerpent: { behavior: 'hold_stream', onHitTag: 'burn', group: 'flame_serpent', energyCost: 2, lifetimeMs: 520 },
  HydroLance: { behavior: 'aim', onHitTag: 'pierce', group: 'hydro_lance', energyCost: 2, lifetimeMs: 2000 },
  ThunderSpike: { behavior: 'charge', onHitTag: 'chain', group: 'thunder_spike', energyCost: 4, lifetimeMs: 2000 },
  QuakeKnuckle: { behavior: 'lob', onHitTag: 'quake', group: 'quake_knuckle', energyCost: 4, lifetimeMs: 1400 },
  MagcutDisc: { behavior: 'boomerang', onHitTag: 'magnet', group: 'magcut_disc', energyCost: 1, lifetimeMs: 1400 },
  AcidGlob: { behavior: 'lob', onHitTag: 'corrode', group: 'acid_glob', energyCost: 2, lifetimeMs: 1200 },
  AeroDarts: { behavior: 'fan', onHitTag: 'bounce', group: 'aero_darts', energyCost: 1, lifetimeMs: 2000 },
  FrostShatter: { behavior: 'straight', onHitTag: 'freeze', group: 'frost_shatter', energyCost: 4, lifetimeMs: 2000 }
} as const

/** Each weapon's charged form (13d, EVAL-P13-008): its own move, costing twice and dealing triple on a boss. */
const CHARGED_IDENTITIES = {
  FlameSerpent: { group: 'flame_serpent_charged', onHitTag: 'burn', damage: 6, forceCharge: true },
  HydroLance: { group: 'hydro_lance_charged', onHitTag: 'pierce', damage: 5 },
  ThunderSpike: { group: 'thunder_spike_charged', onHitTag: 'chain', damage: 6 },
  QuakeKnuckle: { group: 'quake_knuckle_charged', onHitTag: 'quake', damage: 6 },
  MagcutDisc: { group: 'magcut_disc_charged', onHitTag: 'magnet', damage: 5 },
  AcidGlob: { group: 'acid_glob_charged', onHitTag: 'corrode', damage: 5 },
  AeroDarts: { group: 'aero_darts_charged', onHitTag: 'bounce', damage: 3 },
  FrostShatter: { group: 'frost_shatter_charged', onHitTag: 'freeze', damage: 6 }
} as const

const atlas = JSON.parse(fs.readFileSync(WEAPONS_ATLAS.data, 'utf8')) as { frames: Record<string, { frame: { w: number; h: number } }> }
const chargedAtlas = JSON.parse(fs.readFileSync(WEAPONS_CHARGED_ATLAS.data, 'utf8')) as { frames: Record<string, { frame: { w: number; h: number } }> }
const iconAtlas = JSON.parse(fs.readFileSync(HUD_ICONS_ATLAS.data, 'utf8')) as { frames: Record<string, unknown> }
const definitions = new Map(createCoreProjectileDefinitions().map((definition) => [definition.id, definition]))
const shoot = (weaponId: string, intent: Partial<Parameters<typeof resolvePlayerShot>[0]['intent']> = {}) =>
  resolvePlayerShot({ weaponId, intent: { chargeLevel: 0, facing: 1, ...intent }, x: 100, y: 80 })

for (const [weaponId, identity] of Object.entries(IDENTITIES)) {
  test(`${weaponId}: identity, energy tier, range and resolvePlayerShot metadata`, () => {
    const weapon = getWeaponConfig(weaponId)
    assert.equal(weapon.behavior, identity.behavior)
    assert.equal(weapon.onHitTag, identity.onHitTag)
    assert.equal(weapon.artGroup, identity.group)
    assert.equal((WEAPON_ART_GROUPS as Record<string, string>)[weaponId], identity.group)
    // 13d (EVAL-P13-007): every special's bar is 28, at 1 (light), 2 (medium) or 4 (heavy) a shot.
    assert.equal(weapon.maxEnergy, 28)
    assert.equal(weapon.energyCost, identity.energyCost)
    assert.ok([1, 2, 4].includes(identity.energyCost), `${weaponId} cost is a light/medium/heavy tier`)
    assert.equal(Math.floor(weapon.maxEnergy / identity.energyCost), 28 / identity.energyCost, `${weaponId} shots per bar`)
    assert.equal(weapon.projectile.lifetimeMs, identity.lifetimeMs)
    const shot = shoot(weaponId)
    assert.equal(shot.projectileId, `player_weapon_${weaponId}`)
    assert.equal(shot.onHitTag, identity.onHitTag)
    assert.equal(shot.spawnRequest.metadata?.onHitTag, identity.onHitTag)
    assert.equal(shot.spawnRequest.metadata?.behavior, identity.behavior)
    assert.equal(shot.energyCost, identity.energyCost)
    const definition = definitions.get(shot.projectileId)!
    assert.equal(definition.visual.textureKey, WEAPONS_ATLAS.key, 'draws weapons_v1, not the tinted core pellet')
    assert.equal(definition.visual.tint, undefined)
    assert.deepEqual(definition.visual.animationFrames, [0, 1, 2, 3].map((index) => weaponArtFrame(identity.group, index)))
    assert.equal(definition.visual.flipXWithDirection, true)
    const art = atlas.frames[weaponArtFrame(identity.group, 0)].frame
    assert.deepEqual(WEAPON_ART_FRAME_SIZE[identity.group], { width: art.w, height: art.h })
    assert.equal(definition.hitbox?.width, art.w, 'body as wide as the art')
    assert.ok((definition.hitbox?.height ?? 0) >= art.h)
    assert.ok(iconAtlas.frames[weaponHudIconFrame(weaponId)], `${weaponId} has a HUD icon`)
    // A standard shot leaves on camera exit (ProjectileSystem), so collidesWithWorldBounds stays false for
    // it too; a lob, wave or boomerang keeps colliding with the world as it always has.
    assert.equal(definition.hitPolicy.collidesWithWorldBounds, weapon.projectile.style !== 'standard')
  })

  test(`${weaponId}: charged form is its own move -- double cost, triple boss damage, its own art`, () => {
    const weapon = getWeaponConfig(weaponId)
    const charged = CHARGED_IDENTITIES[weaponId as keyof typeof CHARGED_IDENTITIES]
    const chargedForm = getChargedFormConfig(weaponId)!
    assert.ok(chargedForm, `${weaponId} has a charged form`)
    assert.equal(chargedForm.onHitTag, charged.onHitTag)
    assert.equal(chargedForm.artGroup, charged.group)
    assert.equal(chargedForm.damage, charged.damage)
    assert.notEqual(chargedForm.artGroup, weapon.artGroup, 'its own art, not the plain shot rescaled')
    // Craig, 2026-09-30: "charge the boss weapons ... different animation comes out": the charged
    // projectile id, art and (for most) behaviour all differ from the plain shot's.
    const plain = shoot(weaponId)
    const chargedShot = shoot(weaponId, { chargeLevel: 4, forceCharge: charged.forceCharge })
    assert.notEqual(chargedShot.projectileId, plain.projectileId)
    assert.equal(chargedShot.projectileId, `player_weapon_${weaponId}_charged`)
    assert.equal(chargedShot.onHitTag, charged.onHitTag)
    assert.equal(chargedShot.energyCost, identity.energyCost * 2, 'costs twice a plain shot')
    assert.equal(bossDamageScale(weaponId, chargedShot.chargeLevel), 3, 'triple on a boss (a plain special is double)')
    assert.equal(bossDamageScale(weaponId, plain.chargeLevel), 2, 'a plain special stays double')
    const definition = definitions.get(chargedShot.projectileId)!
    assert.equal(definition.damage, charged.damage)
    assert.equal(definition.visual.textureKey, WEAPONS_CHARGED_ATLAS.key, 'draws its own charged atlas')
    assert.deepEqual(definition.visual.animationFrames, [0, 1, 2, 3].map((index) => weaponArtFrame(charged.group, index)))
    const art = chargedAtlas.frames[weaponArtFrame(charged.group, 0)].frame
    assert.deepEqual(WEAPON_ART_FRAME_SIZE[charged.group], { width: art.w, height: art.h })
  })
}

test('a save holding old (pre-28) energy loads clamped to the new max; an unknown id passes through', () => {
  assert.equal(clampWeaponEnergy('FlameSerpent', 38), 28, 'old FlameSerpent max was 40; clamps to 28')
  assert.equal(clampWeaponEnergy('AeroDarts', 12), 12, 'already inside the new max is untouched')
  assert.equal(clampWeaponEnergy('Buster', 999), 28)
  assert.equal(clampWeaponEnergy('Buster', Number.NaN), 28, 'a non-finite value loads full')
  assert.equal(clampWeaponEnergy('not_a_real_weapon', 999), 999, 'an id outside the roster passes through')
  assert.deepEqual(clampWeaponEnergySnapshot({ FlameSerpent: 38, AeroDarts: 12, ThunderSpike: -5 }), { FlameSerpent: 28, AeroDarts: 12, ThunderSpike: 0 })
})

test('charged release needs the top charge level; levels 1 to 3 still fire the plain shot (aura shows, no payoff yet)', () => {
  for (const level of [0, 1, 2, 3] as const) {
    const shot = shoot('FrostShatter', { chargeLevel: level })
    assert.equal(shot.projectileId, 'player_weapon_FrostShatter', `level ${level} is still the plain shot`)
    assert.equal(shot.energyCost, getWeaponConfig('FrostShatter').energyCost)
  }
  assert.equal(shoot('FrostShatter', { chargeLevel: 4 }).projectileId, 'player_weapon_FrostShatter_charged')
  assert.equal(shoot('Buster', { chargeLevel: 2 }).projectileId, 'player_buster_charge_lv2', "the Buster's own four levels are unaffected")
})

test('SPECIAL_WEAPON_ORDER covers the eight identities; the Buster and ArcSlash keep theirs', () => {
  assert.deepEqual([...SPECIAL_WEAPON_ORDER].sort(), Object.keys(IDENTITIES).sort())
  assert.equal(getWeaponConfig('Buster').behavior, 'charge')
  assert.equal(getWeaponConfig('Buster').onHitTag, 'none')
  assert.equal(getWeaponConfig('ArcSlash').behavior, 'saber_release')
  assert.equal(definitions.get('player_weapon_ArcSlash')?.visual.textureKey, WEAPONS_ATLAS.key)
  assert.equal(weaponHudIconFrame('Buster'), 'hud_icons_v1/buster/000')
})

test('HydroLance tilts up or down with aim; level without', () => {
  const up = shoot('HydroLance', { aim: -1 }).spawnRequest.velocity!
  const down = shoot('HydroLance', { aim: 1, facing: -1 }).spawnRequest.velocity!
  assert.ok(up.x > 0 && up.y < 0)
  assert.ok(down.x < 0 && down.y > 0)
  assert.equal(shoot('HydroLance').spawnRequest.velocity, undefined)
  assert.equal(shotAngleDeg(up, 1) < 0, true)
  assert.equal(shotAngleDeg(down, -1) < 0, true, 'flipped art mirrors the tilt')
})

test('AeroDarts fires a three-dart fan for one energy cost, centre dart first', () => {
  const shot = shoot('AeroDarts')
  assert.equal(shot.spawnRequests.length, 3)
  assert.equal(shot.spawnRequest.velocity?.y, 0)
  assert.deepEqual(shot.spawnRequests.map((request) => Math.sign(request.velocity!.y)).sort(), [-1, 0, 1])
  assert.equal(shot.spawnRequests.every((request) => request.metadata?.bouncesLeft === 1), true)
  const spawned: unknown[] = []
  const fired = firePlayerShot({
    request: { type: 'pellet', chargeLevel: 0, facing: 1 }, equippedWeaponId: 'AeroDarts', availableEnergy: 10, x: 0, y: 0, activeBusterCount: 3,
    modifiers: { specialEnergyDiscount: 0 } as any, spawn: (request) => (spawned.push(request), { request })
  })
  assert.equal(spawned.length, 3)
  assert.equal(fired?.remainingEnergy, 10 - getWeaponConfig('AeroDarts').energyCost)
})

test('ThunderSpike: a plain hit chains once; Storm Burst (the charged release) chains up to five, farther', () => {
  assert.equal(getWeaponConfig('ThunderSpike').allowCharge, true)
  assert.equal(shoot('ThunderSpike').spawnRequest.metadata?.chainJumps, WEAPON_TUNING.chain.maxJumps)
  assert.equal(WEAPON_TUNING.chain.maxJumps, 1)
  const charged = shoot('ThunderSpike', { chargeLevel: 4 })
  assert.equal(charged.spawnRequest.metadata?.chainJumps, 5)
  assert.ok((charged.spawnRequest.metadata?.chainRadius as number) > WEAPON_TUNING.chain.radiusPx)
})

test("Quake Knuckle's charged Fault Line lands both ways; Aero Darts' charged Cyclone Volley fans five darts", () => {
  const fault = shoot('QuakeKnuckle', { chargeLevel: 4 })
  assert.equal(fault.spawnRequests.length, 2, 'forward and back')
  assert.equal(fault.spawnRequests[0].direction, 1)
  assert.equal(fault.spawnRequests[1].direction, -1)
  assert.equal(Math.sign(fault.spawnRequests[0].velocity!.x), 1)
  assert.equal(Math.sign(fault.spawnRequests[1].velocity!.x), -1)
  const cyclone = shoot('AeroDarts', { chargeLevel: 4 })
  assert.equal(cyclone.spawnRequests.length, 5)
  assert.equal(cyclone.spawnRequests.every((request) => request.metadata?.bouncesLeft === 2), true, 'two bounces, one more than the plain fan')
})

test('FlameSerpent streams while held: sustain flames cost the sustain cost, on the interval', () => {
  assert.equal(shoot('FlameSerpent', { sustain: true }).energyCost, WEAPON_TUNING.flameStream.sustainCost)
  assert.equal(shoot('HydroLance', { sustain: true }).energyCost, getWeaponConfig('HydroLance').energyCost, 'only a stream weapon sustains')
  const { startFrames, intervalFrames } = WEAPON_TUNING.flameStream
  const fired = Array.from({ length: 40 }, (_, frame) => frame + 1).filter((heldFrames) => streamShouldFire({ held: true, anchored: true, heldFrames }))
  assert.deepEqual(fired, [startFrames, startFrames + intervalFrames, startFrames + 2 * intervalFrames, startFrames + 3 * intervalFrames].filter((frame) => frame <= 40))
  assert.equal(streamShouldFire({ held: true, anchored: true, heldFrames: 3 }), false, 'a three-frame tap never streams')
  assert.equal(streamShouldFire({ held: true, anchored: false, heldFrames: startFrames }), false, 'a hold that began with no shot never streams')
  assert.equal(streamShouldFire({ held: false, anchored: true, heldFrames: startFrames }), false)
})

test('impact follow-ups: burn puddles, a quake on landing, one bounce', () => {
  assert.equal(classifyImpact('enemy', { down: true }), 'target')
  assert.equal(classifyImpact(null, { down: true }), 'floor')
  assert.equal(classifyImpact(null, { right: true }), 'wall')
  assert.equal(classifyImpact(null, {}), 'none')
  assert.deepEqual(resolveImpactFollowUp('burn', 'target'), { kind: 'burn_puddle', projectileId: BURN_PUDDLE_PROJECTILE_ID })
  assert.deepEqual(resolveImpactFollowUp('burn', 'floor'), { kind: 'burn_puddle', projectileId: BURN_PUDDLE_PROJECTILE_ID })
  assert.equal(resolveImpactFollowUp('burn', 'none'), null, 'a flame that fades mid-air leaves nothing')
  assert.deepEqual(resolveImpactFollowUp('quake', 'floor'), { kind: 'quake', projectileId: QUAKE_WAVE_PROJECTILE_ID })
  assert.equal(resolveImpactFollowUp('quake', 'target'), null)
  assert.deepEqual(resolveImpactFollowUp('bounce', 'wall', 1), { kind: 'bounce' })
  assert.equal(resolveImpactFollowUp('bounce', 'wall', 0), null, 'bounces once')
  assert.equal(resolveImpactFollowUp('bounce', 'target', 1), null)
  assert.deepEqual(bounceVelocity({ x: 300, y: 80 }, 'floor'), { x: 300, y: -80 })
  assert.deepEqual(bounceVelocity({ x: 300, y: 80 }, 'wall'), { x: -300, y: 80 })
  for (const id of [BURN_PUDDLE_PROJECTILE_ID, QUAKE_WAVE_PROJECTILE_ID]) {
    const definition = definitions.get(id)!
    assert.equal(definition.owner, 'player')
    assert.equal(definition.speed, 0)
    assert.ok(definition.hitPolicy.pierce > 0)
  }
})

test('magnet pulls drops within reach toward the disc; the freeze block is one-way', () => {
  const pull = magnetPullVelocity({ x: 0, y: 0 }, { x: 40, y: 0 })!
  assert.ok(pull.x > 0 && pull.y === 0)
  assert.equal(magnetPullVelocity({ x: 0, y: 0 }, { x: 400, y: 0 }), null)
  assert.equal(landsOnFreezeBlock(100, 120, 98), true)
  assert.equal(landsOnFreezeBlock(130, 120, 98), false, 'walking into the side does not land')
  assert.equal(landsOnFreezeBlock(100, -200, 98), false, 'jumping up through it does not land')
})

test('resolveChainTargets jumps nearest first, within the radius, never back', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 60, y: 0 }
  const c = { x: 120, y: 0 }
  const far = { x: 600, y: 0 }
  assert.deepEqual(resolveChainTargets(a, [a, c, b, far], 3), [b, c])
  assert.deepEqual(resolveChainTargets(a, [b, c], 1), [b])
  assert.deepEqual(resolveChainTargets(a, [b, c], 0), [])
})

function createData(seed: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(seed))
  return { get: (key: string) => store.get(key), set: (key: string, value: unknown) => void store.set(key, value) }
}

function sprite(seed: Record<string, unknown> = {}, x = 20, y = 12) {
  return { x, y, active: true, visible: true, data: createData(seed), body: { enable: true, bottom: y + 10, velocity: { x: 0, y: 0 } }, setDataEnabled() {}, setPosition() {}, setVelocity() {}, setTexture() {} }
}

function routerFor(bullet: object, extras: { enemies?: object[]; hits?: Array<{ target: unknown; damage: number; extras?: unknown }>; scheduled?: Array<() => void>; recycled?: unknown[] } = {}) {
  return new ProjectileCollisionRouter({
    playerBullets: { contains: (value: unknown) => value === bullet } as any,
    enemyBullets: { contains: () => false } as any,
    getPlayer: () => undefined,
    getNow: () => 100,
    getFacing: () => 1,
    getEnemies: () => extras.enemies as any,
    schedule: (_delay, fn) => extras.scheduled?.push(fn),
    damageBoss: () => {},
    damagePlayer: () => ({ accepted: true }),
    damageEnemy: (target, damage, hitExtras) => {
      extras.hits?.push({ target, damage, extras: hitExtras })
      return { accepted: true, defeated: false, recycleBullet: true }
    },
    recycleBullet: (value) => extras.recycled?.push(value),
    recordCombatHit: () => {}
  })
}

test('collision router: ThunderSpike chains to enemies in reach, one per charge level', () => {
  const bullet = sprite({ owner: 'player', damage: 4, pierceRemaining: 0, onHitTag: 'chain', chainJumps: 2, weaponId: 'ThunderSpike' })
  const hit = sprite({}, 20)
  const near = sprite({}, 80)
  const next = sprite({}, 140)
  const far = sprite({}, 900)
  const hits: Array<{ target: unknown; damage: number }> = []
  const router = routerFor(bullet, { enemies: [hit, near, next, far], hits })
  router.handlePlayerBulletHitsEnemy(bullet as any, hit as any)
  assert.deepEqual(hits.map((entry) => entry.target), [hit, near, next])
  assert.equal(router.lastOnHit?.applied, 'chain:2')
})

test('collision router: AcidGlob sticks and ticks three times', () => {
  const bullet = sprite({ owner: 'player', damage: 3, pierceRemaining: 0, onHitTag: 'corrode', weaponId: 'AcidGlob' })
  const enemy = sprite()
  const hits: Array<{ target: unknown; damage: number }> = []
  const scheduled: Array<() => void> = []
  const router = routerFor(bullet, { hits, scheduled })
  router.handlePlayerBulletHitsEnemy(bullet as any, enemy as any)
  assert.equal(scheduled.length, WEAPON_TUNING.corrode.ticks)
  scheduled.forEach((tick) => tick())
  assert.deepEqual(hits.map((entry) => entry.damage), [3, 1, 1, 1])
  assert.equal(router.lastOnHit?.applied, 'corrode:3')
})

test('collision router: FrostShatter freezes (1.5s hitstun, no knockback)', () => {
  const bullet = sprite({ owner: 'player', damage: 4, pierceRemaining: 0, onHitTag: 'freeze', weaponId: 'FrostShatter' })
  const hits: Array<{ target: unknown; damage: number; extras?: unknown }> = []
  const router = routerFor(bullet, { hits })
  router.handlePlayerBulletHitsEnemy(bullet as any, sprite() as any)
  assert.deepEqual(hits[0].extras, { hitstunMs: 1500, knockback: undefined })
  assert.equal(router.lastOnHit?.applied, 'freeze:1500')
})

test('collision router: HydroLance pierces; a flame marks its hit for the burn puddle', () => {
  const lance = sprite({ owner: 'player', damage: 3, pierceRemaining: 2, onHitTag: 'pierce', weaponId: 'HydroLance', baseSpeedX: 320 })
  const recycled: unknown[] = []
  routerFor(lance, { recycled }).handlePlayerBulletHitsEnemy(lance as any, sprite() as any)
  assert.equal(recycled.length, 0, 'the lance flies on')
  assert.equal(lance.data.get('pierceRemaining'), 1)
  const flame = sprite({ owner: 'player', damage: 3, pierceRemaining: 0, onHitTag: 'burn', weaponId: 'FlameSerpent' })
  const enemy = sprite({}, 40, 60)
  const router = routerFor(flame, { recycled })
  router.handlePlayerBulletHitsEnemy(flame as any, enemy as any)
  assert.deepEqual(recycled, [flame])
  assert.equal(flame.data.get('hitTarget'), 'enemy')
  assert.equal(flame.data.get('hitFloorY'), 70, 'the puddle sits at the enemy feet')
  assert.equal(router.lastOnHit?.tag, 'burn')
})

test('weakness ring: 2.5 weakness, 1 neutral, 0.75 resist; Normal outside the ring', () => {
  const elements = Object.keys(WeaknessTable).filter((element) => element !== 'Normal') as Element[]
  for (const boss of elements) {
    for (const weapon of elements) {
      const expected = WeaknessTable[boss] === weapon ? 2.5 : WeaknessTable[weapon] === boss ? 0.75 : 1
      assert.equal(damageMultiplier(weapon, boss), expected, `${weapon} vs ${boss}`)
    }
    assert.equal(damageMultiplier('Normal', boss), 1)
    assert.equal(damageMultiplier(boss, 'Normal'), 1)
  }
})

test('Classic weakness table: every warden takes its classic weakness at 2.5 and no weapon is blocked', () => {
  const world = generateClassicWorld()
  for (const [bossId, profile] of Object.entries(world.weaknessProfiles)) {
    const boss = BOSS_ROSTER[bossId as BossId]
    for (const weaponId of ['Buster', 'ArcSlash', ...SPECIAL_WEAPON_ORDER]) {
      const weapon = getWeaponConfig(weaponId)
      const hit = resolveBossElementHit({ bossElement: boss.element, weaponId: weapon.id, weaponElement: weapon.element, profile: boss.damageProfile })
      assert.ok(hit.multiplier > 0, `${weaponId} vs ${bossId} is never blocked`)
      if (profile.weaknessWeaponIds.includes(weapon.id as any)) assert.equal(hit.outcome, 'weakness', `${weaponId} is ${bossId}'s weakness`)
    }
  }
  const resisted = resolveBossElementHit({ bossElement: 'Water', weaponId: 'FlameSerpent', weaponElement: 'Fire' })
  assert.deepEqual([resisted.multiplier, resisted.outcome], [0.75, 'resisted'])
})

test('Rook takes the Buster only; Omega rotates its weakness by phase', () => {
  const rook = BOSS_ROSTER.sentinel_rook
  const rookHit = (weaponId: string) =>
    resolveBossElementHit({ bossElement: rook.element, weaponId, weaponElement: getWeaponConfig(weaponId).element, profile: rook.damageProfile })
  assert.equal(rookHit('Buster').multiplier, 1)
  assert.equal(rookHit('FlameSerpent').outcome, 'immune')
  assert.equal(rookHit('ArcSlash').multiplier, 0)
  const omega = BOSS_ROSTER.omega_core
  const omegaHit = (weaponId: string, phaseName: string) =>
    resolveBossElementHit({ bossElement: omega.element, weaponId, weaponElement: getWeaponConfig(weaponId).element, profile: omega.damageProfile, phaseIndex: bossPhaseIndex(omega, phaseName) }).multiplier
  const [first, second, third] = omega.phases.map((phase) => phase.name)
  assert.equal(omegaHit('ThunderSpike', first), 2.5)
  assert.equal(omegaHit('ThunderSpike', second), 1)
  assert.equal(omegaHit('MagcutDisc', second), 2.5)
  assert.equal(omegaHit('FrostShatter', third), 2.5)
  assert.equal(omegaHit('FrostShatter', omega.desperation!.name), 2.5, 'desperation keeps the last weakness')
  assert.equal(omegaHit('Buster', first), 1)
})

test('hud_icons_v1 is a Game-scene resident atlas with a ready manifest entry', () => {
  assert.ok(GAME_SCENE_ATLASES.some((entry) => entry.key === HUD_ICONS_ATLAS.key))
  const manifest = JSON.parse(fs.readFileSync('assets/sprites/manifest.v1.json', 'utf8')) as { atlases?: Array<Record<string, unknown>>; entries?: Array<Record<string, unknown>> }
  const entries = (Object.values(manifest).find(Array.isArray) ?? []) as Array<Record<string, unknown>>
  const entry = entries.find((candidate) => candidate.atlasKey === HUD_ICONS_ATLAS.key)
  assert.equal(entry?.loadScope, 'game')
  assert.equal(entry?.status, 'ready')
})
