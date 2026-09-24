import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerCombat, type CombatMotionFacts } from '../src/player/PlayerCombat'
import { FEEL_FRAME_MS, PLAYER_GAMEPLAY_CONFIG, type SwordConfig } from '../src/player/config'
import { DEFAULT_PLAYER_FEATURE_FLAGS } from '../src/player/featureFlags'
import { resolveSwordHitboxOrigin, swordHitboxIntersectsTarget } from '../src/player/swordCollision'
import type { CombatSnapshot, PlayerIntent, PlayerRuntimeEvent, ResolvedHitbox } from '../src/player/types'

const COMBO = PLAYER_GAMEPLAY_CONFIG.sword.combo

function intent(overrides: Partial<PlayerIntent> = {}): PlayerIntent {
  return {
    moveAxis: 0, jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: false, dashHeld: false,
    dashReleased: false, shootPressed: false, shootHeld: false, shootReleased: false, slashPressed: false,
    crouchHeld: false, aim: { x: 0, y: 0 }, ...overrides
  }
}

function rig(sword: SwordConfig = PLAYER_GAMEPLAY_CONFIG.sword) {
  const player = { setFlipX: () => {} } as any
  const combat = new PlayerCombat(player, { ...DEFAULT_PLAYER_FEATURE_FLAGS, enableChargeShot: false }, PLAYER_GAMEPLAY_CONFIG.blaster, sword, PLAYER_GAMEPLAY_CONFIG.damage, {
    onDamageAccepted: () => {},
    onKnockback: () => {}
  })
  let frame = 0
  const tick = (o: { press?: boolean; facing?: 1 | -1; grounded?: boolean; dashing?: boolean; motion?: CombatMotionFacts } = {}) => {
    const result = combat.update(intent({ slashPressed: Boolean(o.press) }), frame * FEEL_FRAME_MS, FEEL_FRAME_MS, o.facing ?? 1, o.grounded ?? true, o.dashing ?? false, false, o.motion ?? {})
    frame += 1
    return result
  }
  return { combat, tick }
}

const hitboxes = (events: PlayerRuntimeEvent[]): ResolvedHitbox[] =>
  events.flatMap((event) => (event.type === 'hitbox' ? [event.request] : []))

function phases(tick: ReturnType<typeof rig>['tick'], count: number, first: { press?: boolean } = {}): (CombatSnapshot['slashPhase'])[] {
  return Array.from({ length: count }, (_, index) => tick(index === 0 ? first : {}).snapshot.slashPhase)
}

test('combo hit 1 shows 5 startup, 4 active and 6 recovery frames, then clears', () => {
  const { tick } = rig()
  const seen = phases(tick, 16, { press: true })
  assert.deepEqual(seen, [
    ...Array(5).fill('startup'), ...Array(4).fill('active'), ...Array(6).fill('recovery'), undefined
  ])
})

test('mashing lands hits 1, 2, 3 in order with damage 2, 2, 4, rising hit-stop and a bigger finisher knockback', () => {
  const { tick } = rig()
  const events: PlayerRuntimeEvent[] = []
  for (let i = 0; i < 70; i += 1) events.push(...tick({ press: true }).events)
  const hits = hitboxes(events).slice(0, 4)
  assert.deepEqual(hits.map((hit) => hit.move), ['combo1', 'combo2', 'combo3', 'combo1'])
  assert.deepEqual(hits.slice(0, 3).map((hit) => hit.damage), [2, 2, 4])
  assert.deepEqual(hits.slice(0, 3).map((hit) => hit.hitstopFrames), [4, 5, 8])
  assert.ok(hits[2].knockback!.x > hits[1].knockback!.x && hits[1].knockback!.x >= hits[0].knockback!.x)
  assert.equal(new Set(hits.map((hit) => hit.swingId)).size, 4, 'each hit is a new swing')
})

test('a press buffered in active or recovery starts the next hit on the frame recovery ends', () => {
  const { tick } = rig()
  const seen: (string | undefined)[] = []
  for (let i = 0; i < 17; i += 1) {
    const snap = tick({ press: i === 0 || i === 6 }).snapshot
    seen.push(snap.slashMove)
  }
  // Hit 1 fills frames 0-14; hit 2 starts on frame 15.
  assert.equal(seen[14], 'combo1')
  assert.equal(seen[15], 'combo2')
})

test('a press during startup is not buffered', () => {
  const { tick } = rig()
  const seen = Array.from({ length: 16 }, (_, i) => tick({ press: i === 0 || i === 2 }).snapshot.slashPhase)
  assert.equal(seen[15], undefined)
})

test('the link window: a press up to 10 frames after recovery advances the chain, the 11th resets it', () => {
  for (const [wait, expected] of [[1, 'combo2'], [10, 'combo2'], [11, 'combo1']] as const) {
    const { tick } = rig()
    for (let i = 0; i < 15; i += 1) tick({ press: i === 0 }) // hit 1: frames 0-14; recovery ends on frame 15
    let snap = tick().snapshot // frame 15: idle, link window open
    assert.equal(snap.slashPhase, undefined)
    for (let i = 1; i < wait; i += 1) tick()
    snap = tick({ press: true }).snapshot
    assert.equal(snap.slashMove, expected, `press ${wait} frame(s) after recovery`)
  }
})

test('a dash or a jump cancels recovery and drops the chain; neither cancels startup or active', () => {
  for (const cancel of [{ dashing: true }, { motion: { justJumped: true } }]) {
    const { tick } = rig()
    const seen = Array.from({ length: 7 }, (_, i) => tick({ press: i === 0, ...(i === 2 || i === 6 ? cancel : {}) }).snapshot.slashPhase)
    assert.equal(seen[2], 'startup', 'startup is not cancelled')
    assert.equal(seen[6], 'active', 'active is not cancelled')
    const { tick: tick2 } = rig()
    for (let i = 0; i < 11; i += 1) tick2({ press: i === 0 || i === 7 }) // frame 10 is recovery, with a buffered press
    const cancelled = tick2(cancel).snapshot
    assert.equal(cancelled.slashPhase, undefined, 'recovery is cancelled')
    const after = Array.from({ length: 8 }, () => tick2().snapshot.slashPhase)
    assert.ok(after.every((phase) => phase === undefined), 'the buffered hit 2 is dropped')
    assert.equal(tick2({ press: true }).snapshot.slashMove, 'combo1')
  }
})

test('one air spin per airborne phase; landing resets it', () => {
  const { tick } = rig()
  const first = tick({ press: true, grounded: false }).snapshot
  assert.equal(first.slashMove, 'air_spin')
  for (let i = 0; i < 20; i += 1) tick({ grounded: false })
  assert.equal(tick({ press: true, grounded: false }).snapshot.slashPhase, undefined, 'second air slash is refused')
  tick({ grounded: true })
  assert.equal(tick({ press: true, grounded: false }).snapshot.slashMove, 'air_spin')
})

test('the box is reported on every active frame and each target is hit once per combo hit', () => {
  const { combat, tick } = rig()
  const player = { x: 100, y: 100 }
  const hitsBy = new Map<string, number>()
  const targets = {
    walksIn: (activeFrame: number) => ({ x: activeFrame >= 3 ? 122 : 200, y: 94, width: 16, height: 16 }),
    inside: () => ({ x: 122, y: 94, width: 16, height: 16 })
  }
  let activeFrame = 0
  let lastSwing = -1
  for (let i = 0; i < 40; i += 1) {
    const snap = tick({ press: i === 0 || i === 6 }).snapshot
    const box = snap.swordHitbox
    if (!box) continue
    if (box.swingId !== lastSwing) { activeFrame = 0; lastSwing = box.swingId! }
    activeFrame += 1
    const origin = resolveSwordHitboxOrigin(player.x, player.y, 1, box)
    for (const [name, place] of Object.entries(targets)) {
      if (swordHitboxIntersectsTarget(origin, box, place(activeFrame)) && combat.claimSwordHit(name)) {
        hitsBy.set(name, (hitsBy.get(name) ?? 0) + 1)
      }
    }
  }
  // Two combo hits (1 and 2): each target once per hit, including one that only enters on active frame 3.
  assert.equal(hitsBy.get('walksIn'), 2)
  assert.equal(hitsBy.get('inside'), 2)
  assert.equal(combat.claimSwordHit('late'), false, 'no claims outside active frames')
})

test('west swings mirror the box and the knockback', () => {
  const { tick } = rig()
  const events: PlayerRuntimeEvent[] = []
  for (let i = 0; i < 8; i += 1) events.push(...tick({ press: i === 0, facing: -1 }).events)
  const [hit] = hitboxes(events)
  assert.equal(hit.direction, 'w')
  assert.equal(hit.shape.offsetX, -COMBO.ground[0].hitbox.offsetX)
  assert.equal(hit.knockback!.x, -COMBO.ground[0].knockback.x)
})

test('comboEnabled false keeps the legacy single slash (windows timing, damage 2)', () => {
  const { tick } = rig({ ...PLAYER_GAMEPLAY_CONFIG.sword, comboEnabled: false })
  const events: PlayerRuntimeEvent[] = []
  for (let i = 0; i < 40; i += 1) events.push(...tick({ press: true }).events)
  const hits = hitboxes(events)
  assert.ok(hits.length >= 2)
  assert.ok(hits.every((hit) => hit.move === 'combo1' && hit.damage === 2))
  assert.equal(hits[0].hitstopFrames, PLAYER_GAMEPLAY_CONFIG.sword.windows.ground.e.hitstopFrames)
})
