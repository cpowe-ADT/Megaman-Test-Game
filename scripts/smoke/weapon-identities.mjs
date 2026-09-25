// Smoke 12 extension (prompt 07 phase 7.3, EVAL-P7-004): one shot per warden weapon, its art, HUD icon and
// on-hit tag, each tag seen acting in the running Game scene. Targets are plain physics dummies in the enemies
// group (legacy hp path), placed in the shot's path; nothing here changes game rules.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const IDENTITIES = {
  FlameSerpent: { behavior: 'hold_stream', onHitTag: 'burn', group: 'flame_serpent' },
  HydroLance: { behavior: 'aim', onHitTag: 'pierce', group: 'hydro_lance' },
  ThunderSpike: { behavior: 'charge', onHitTag: 'chain', group: 'thunder_spike' },
  QuakeKnuckle: { behavior: 'lob', onHitTag: 'quake', group: 'quake_knuckle' },
  MagcutDisc: { behavior: 'boomerang', onHitTag: 'magnet', group: 'magcut_disc' },
  AcidGlob: { behavior: 'lob', onHitTag: 'corrode', group: 'acid_glob' },
  AeroDarts: { behavior: 'fan', onHitTag: 'bounce', group: 'aero_darts' },
  FrostShatter: { behavior: 'straight', onHitTag: 'freeze', group: 'frost_shatter' }
}

function installHelpers() {
  const scene = () => window.__phaserGame.scene.getScene('Game')
  window.__w12 = {
    scene,
    equip(id) {
      const s = scene()
      const index = s.weapons.indexOf(id)
      if (index < 0) return null
      s.currentWeaponIndex = index
      s.weaponRuntime.updateLabel()
      window.stageDebug.setWeaponEnergy(id, 999)
      return { weapon: s.weaponRuntime.getCurrentWeaponId(), icon: s.hud?.getWeaponIconState?.() ?? null }
    },
    fire(chargeLevel = 0) {
      const s = scene()
      return s.weaponRuntime.fire({ type: chargeLevel ? 'charge' : 'pellet', chargeLevel, facing: s.facing ?? 1 })
    },
    latest(projectileId) {
      const s = scene()
      return s.playerBullets.getChildren().filter((b) => b.active && b.data?.get('projectileId') === projectileId).sort((a, b) => b.data.get('spawnedAt') - a.data.get('spawnedAt'))[0] ?? null
    },
    dummies: [],
    dummy(x, y) {
      const s = scene()
      const d = s.physics.add.sprite(x, y, 'atlas_weapons_v1', 'weapons_v1/boss_orb/000')
      d.setDataEnabled()
      d.data.set('hp', 40)
      d.data.set('maxHp', 40)
      d.setAlpha(0.55)
      s.enemies.add(d)
      d.body.setAllowGravity(false)
      d.body.setImmovable(true)
      d.body.setVelocity(0, 0)
      this.dummies.push(d)
      return d
    },
    clear() {
      this.dummies.forEach((d) => d.destroy())
      this.dummies = []
    },
    counts() {
      const s = scene()
      return { onHit: { ...s.projectileCollisionRouter.onHitCounts }, impact: { ...s.projectileSystem.impactCounts }, lastOnHit: s.projectileCollisionRouter.lastOnHit, lastImpact: s.projectileSystem.lastImpact }
    }
  }
}

async function until(page, advanceFrames, predicate, arg, maxFrames = 90) {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const value = await page.evaluate(predicate, arg)
    if (value) return value
    await advanceFrames(page, 1)
  }
  return page.evaluate(predicate, arg)
}

export async function runWeaponIdentityMatrix(page, scenarioDir, { advanceFrames }) {
  await page.evaluate(installHelpers)
  const evidence = {}
  for (const [weaponId, identity] of Object.entries(IDENTITIES)) {
    const equipped = await page.evaluate((id) => window.__w12.equip(id), weaponId)
    assert.equal(equipped?.weapon, weaponId, `${weaponId} equips`)
    assert.equal(equipped.icon?.frame, `hud_icons_v1/${identity.group}/000`, `${weaponId} HUD icon`)
    await advanceFrames(page, 2)
    let aimed = null
    if (weaponId === 'HydroLance') {
      await page.keyboard.down('ArrowUp')
      await advanceFrames(page, 1)
      aimed = await page.evaluate(() => window.__w12.fire(0))
      await page.keyboard.up('ArrowUp')
      assert.equal(aimed?.aim, -1, 'HydroLance aims up with up held')
      assert.ok(aimed.velocityY < 0 && aimed.angle < 0, `HydroLance flies and tilts up (${JSON.stringify(aimed)})`)
      await advanceFrames(page, 20)
    }
    const magnetDrop = weaponId === 'MagcutDisc' ? await page.evaluate(() => window.stageDebug.spawnPickup('ammo', 56)) : null
    const receipt = await page.evaluate((charge) => window.__w12.fire(charge), weaponId === 'ThunderSpike' ? 2 : 0)
    assert.equal(receipt?.weaponId, weaponId)
    assert.equal(receipt.behavior, identity.behavior)
    assert.equal(receipt.onHitTag, identity.onHitTag)
    assert.equal(receipt.textureKey, 'atlas_weapons_v1', `${weaponId} draws weapons_v1`)
    assert.ok(String(receipt.frame).startsWith(`weapons_v1/${identity.group}/`), `${weaponId} frame ${receipt.frame}`)
    assert.ok(receipt.bodyWidth > 0 && receipt.displayWidth > 0)
    if (weaponId === 'AeroDarts') assert.equal(receipt.projectileCount, 3, 'AeroDarts fans three darts')
    if (weaponId === 'ThunderSpike') assert.equal(receipt.chainJumps, 2, 'a level-2 charge chains twice')
    // Targets in the shot's path (the chain's next links sit above it, out of the spike's flight).
    await page.evaluate(({ weaponId, projectileId }) => {
      const w = window.__w12
      const shot = w.latest(projectileId)
      if (!shot) return
      if (weaponId === 'FlameSerpent' || weaponId === 'HydroLance' || weaponId === 'FrostShatter') w.dummy(shot.x + 40, shot.y)
      if (weaponId === 'ThunderSpike') {
        const a = w.dummy(shot.x + 40, shot.y)
        w.dummy(a.x + 30, a.y - 50)
        w.dummy(a.x + 60, a.y - 90)
      }
      if (weaponId === 'AcidGlob') w.dummy(shot.x + 40, shot.y - 16)
    }, { weaponId, projectileId: receipt.projectileId })
    await advanceFrames(page, 3)
    await page.screenshot({ path: path.join(scenarioDir, `weapon-${weaponId}.png`) })
    const tag = identity.onHitTag
    let applied
    if (tag === 'quake' || tag === 'bounce') {
      const kind = tag === 'quake' ? 'quake' : 'bounce'
      applied = await until(page, advanceFrames, (k) => ((window.__w12.counts().impact[k] ?? 0) > 0 ? window.__w12.counts() : null), kind, 120)
      assert.ok(applied?.impact?.[kind] > 0, `${weaponId}: ${kind} seen (${JSON.stringify(applied)})`)
    } else if (tag === 'magnet') {
      applied = await until(page, advanceFrames, () => {
        const s = window.__w12.scene()
        const pulled = s.drops?.getChildren().find((d) => d.data?.get('pulledBy') === 'MagcutDisc')
        return pulled ? { pulledBy: 'MagcutDisc', drop: { x: Math.round(pulled.x), y: Math.round(pulled.y) } } : null
      }, null, 40)
      assert.equal(applied?.pulledBy, 'MagcutDisc', `MagcutDisc pulls the drop (${JSON.stringify({ magnetDrop, applied })})`)
    } else {
      applied = await until(page, advanceFrames, (t) => ((window.__w12.counts().onHit[t] ?? 0) > 0 ? window.__w12.counts() : null), tag, 60)
      assert.ok(applied?.onHit?.[tag] > 0, `${weaponId}: on-hit ${tag} applied (${JSON.stringify(applied)})`)
      if (tag === 'burn') {
        const puddle = await until(page, advanceFrames, () => (window.__w12.counts().impact.burn_puddle ?? 0) > 0, null, 10)
        assert.ok(puddle, 'FlameSerpent leaves a burn puddle')
      }
      if (tag === 'chain') assert.equal(applied.lastOnHit.applied, 'chain:2')
      if (tag === 'freeze') {
        const frozen = await page.evaluate(() => {
          const s = window.__w12.scene()
          const d = window.__w12.dummies[0]
          return { frozenFor: Math.round((d.data.get('frozenUntil') ?? 0) - s.time.now), tinted: Boolean(d.isTinted) }
        })
        assert.ok(frozen.frozenFor > 1000 && frozen.tinted, `FrostShatter freezes (${JSON.stringify(frozen)})`)
        applied.frozen = frozen
      }
      if (tag === 'corrode') {
        await advanceFrames(page, 90)
        applied.dummyHpAfterTicks = await page.evaluate(() => window.__w12.dummies[0].data.get('hp'))
        assert.ok(applied.dummyHpAfterTicks <= 40 - 3 - 3, `AcidGlob ticks after its hit (${applied.dummyHpAfterTicks})`)
      }
    }
    evidence[weaponId] = { equipped, receipt, aimed, applied }
    await page.evaluate(() => window.__w12.clear())
    await advanceFrames(page, 30)
  }

  // FlameSerpent held: the first flame at the authored cost, then a sustain-cost flame per interval.
  await page.evaluate(() => window.__w12.equip('FlameSerpent'))
  const before = await page.evaluate(() => window.__w12.scene().weaponEnergyById.FlameSerpent)
  await page.keyboard.down('x')
  await advanceFrames(page, 40)
  await page.keyboard.up('x')
  const after = await page.evaluate(() => window.__w12.scene().weaponEnergyById.FlameSerpent)
  const spent = before - after
  evidence.flameStream = { before, after, spent, flames: spent > 0 ? spent - 4 : 0 }
  assert.ok(spent >= 5 + 2 && spent < 15, `a held FlameSerpent streams at the sustain cost (${JSON.stringify(evidence.flameStream)})`)
  fs.writeFileSync(path.join(scenarioDir, 'weapons-evidence.json'), JSON.stringify(evidence, null, 2))
  return evidence
}
