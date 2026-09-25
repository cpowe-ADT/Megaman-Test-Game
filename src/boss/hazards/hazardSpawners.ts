import { rectsOverlap, type BossRect } from '../../bosses/bossBodies'

/**
 * Boss hazard spawners (prompt 07 phase 7.1 items 1 and 3, EVAL-P7-001; prompt 12 part 12f wave 4). Each authored
 * hazard id has its own body, art and timing instead of one floor-spike ring. Pure: a spawner turns the attack's
 * spec into a `BossHazard` whose `sample(elapsedMs, env)` says, for that moment, where each piece is, which frame
 * it shows, and the body it hurts with (null when it cannot hurt). `src/scenes/game/BossHazards.ts` draws the
 * pieces and moves one physics zone per hurting body, so a hazard hurts the hero only through its own body.
 * `sample` is called with increasing times; the mine (contact), the tornado (drift) and the disc (return) keep
 * state between calls.
 */

export const BOSS_HAZARD_IDS = [
  'icicle_fall',
  'charge_mine',
  'tornado_pillar',
  'splash_pillar',
  'burn_puddle',
  'acid_trail',
  'magnet_node',
  'stone_pillar',
  'vapor_pod',
  'short_quake',
  'ground_shockwave',
  'wind_hitbox',
  'mag_disc',
  'blaze_lob'
] as const

export type BossHazardId = (typeof BOSS_HAZARD_IDS)[number]

export type HazardSheet = 'hazards_v1' | 'mechanics_v2' | 'weapons_v1'

/** The art a spawner draws: an atlas group (`<sheet>/<group>/000..`). */
export interface HazardArt {
  sheet: HazardSheet
  group: string
  frames: number
}

export const BOSS_HAZARD_ART: Record<BossHazardId, HazardArt> = {
  icicle_fall: { sheet: 'mechanics_v2', group: 'icicle', frames: 2 },
  charge_mine: { sheet: 'hazards_v1', group: 'charge_mine', frames: 4 },
  tornado_pillar: { sheet: 'hazards_v1', group: 'tornado_pillar', frames: 4 },
  splash_pillar: { sheet: 'hazards_v1', group: 'splash_pillar', frames: 4 },
  burn_puddle: { sheet: 'hazards_v1', group: 'burn_puddle', frames: 4 },
  acid_trail: { sheet: 'hazards_v1', group: 'acid_trail', frames: 4 },
  magnet_node: { sheet: 'mechanics_v2', group: 'magnet_lift', frames: 4 },
  stone_pillar: { sheet: 'hazards_v1', group: 'stone_pillar', frames: 4 },
  vapor_pod: { sheet: 'hazards_v1', group: 'vapor_pod', frames: 4 },
  short_quake: { sheet: 'hazards_v1', group: 'ground_shockwave', frames: 4 },
  ground_shockwave: { sheet: 'hazards_v1', group: 'ground_shockwave', frames: 4 },
  wind_hitbox: { sheet: 'mechanics_v2', group: 'wind_gust', frames: 4 },
  mag_disc: { sheet: 'weapons_v1', group: 'magcut_disc', frames: 4 },
  blaze_lob: { sheet: 'weapons_v1', group: 'boss_orb', frames: 4 }
}

/** The spawner for an authored spawn id; `ground_slam_hazard` (an unauthored slam) quakes, `fire_orb` is the lob. */
export function resolveHazardSpawn(spawnId: string): BossHazardId | null {
  if (spawnId === 'ground_slam_hazard') return 'short_quake'
  if (spawnId === 'fire_orb') return 'blaze_lob'
  return (BOSS_HAZARD_IDS as readonly string[]).includes(spawnId) ? (spawnId as BossHazardId) : null
}

/** Attacks that place more pieces than their spawner's default (by runtime attack id). */
export const HAZARD_PIECES_BY_ATTACK: Readonly<Record<string, number>> = { tectonic_rift: 2, maelstrom: 3, absolute_zero: 5 }

export interface HazardSpec {
  id: BossHazardId
  /** The boss's feet x when the attack executes. */
  originX: number
  /** The arena floor line (the boss's ground y). */
  floorY: number
  /** The room's top edge: icicles hang from it. */
  ceilingY: number
  /** Where boss shots leave: the disc and the lob start here. */
  muzzleY: number
  /** Towards the hero when the attack started. */
  facing: 1 | -1
  heroX: number
  minX: number
  maxX: number
  damage: number
  /** The attack's dash or travel speed (px/s): puddle trails follow a dash at this speed. */
  speed?: number
  /** Pieces, for spawners that place several (icicles, pillars, pods, puddles, shockwaves). */
  count?: number
}

export interface HazardPiece {
  x: number
  y: number
  /** 'bottom': (x, y) is the art's and the body's bottom centre (floor hazards); 'center': their centre (flyers). */
  anchor: 'bottom' | 'center'
  visible: boolean
  frame: number
  alpha: number
  scale: number
  flipX: boolean
  /** The hurt body this frame, on the piece's anchor; null when the piece cannot hurt. */
  body: { width: number; height: number } | null
  /** A body the hero cannot walk through (a standing stone pillar), bottom-anchored. */
  solid?: { width: number; height: number } | null
  /** A floor warning under the piece (`telegraphs_v1` floor_marker). */
  marker?: boolean
}

export interface HazardFrame {
  phase: string
  pieces: HazardPiece[]
  /** Horizontal pull on the hero this frame, px/s (magnet_node). */
  pullX: number
  /** The pull field drawn round a live node. */
  field?: { x: number; y: number; radius: number } | null
  done: boolean
}

export interface HazardEnv {
  /** The hero's body rect, or null without a live hero. */
  hero: BossRect | null
  /** The boss's muzzle: a returning disc heads here. */
  boss: { x: number; y: number }
}

export interface BossHazard {
  readonly id: BossHazardId
  readonly damage: number
  sample(elapsedMs: number, env: HazardEnv): HazardFrame
}

type Spawner = (spec: HazardSpec) => Pick<BossHazard, 'sample'>

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const progress = (t: number, start: number, duration: number) => (duration <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / duration, 0, 1))
const loopFrame = (t: number, frameMs: number, count: number) => Math.floor(Math.max(0, t) / frameMs) % count
const laneX = (spec: HazardSpec, x: number, margin = 12) => clamp(x, spec.minX + margin, spec.maxX - margin)
const offsets = (count: number, gap: number) => Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * gap)

function piece(fields: Partial<HazardPiece> & { x: number; y: number }): HazardPiece {
  return { anchor: 'bottom', visible: true, frame: 0, alpha: 1, scale: 1, flipX: false, body: null, ...fields }
}

const floor = (spec: HazardSpec, x: number, fields: Partial<HazardPiece> = {}) => piece({ x, y: spec.floorY, ...fields })
const hidden = (x: number, y: number, anchor: HazardPiece['anchor'] = 'bottom') => piece({ x, y, anchor, visible: false })
const frameOf = (phase: string, pieces: HazardPiece[], done = false, pullX = 0): HazardFrame => ({ phase, pieces, pullX, done })

/** The world rect of a piece's hurt body (null when it cannot hurt). */
export function hazardBodyRect(entry: HazardPiece): BossRect | null {
  if (!entry.visible || !entry.body) return null
  const { width, height } = entry.body
  const top = entry.anchor === 'bottom' ? entry.y - height : entry.y - height / 2
  return { x: entry.x - width / 2, y: top, width, height }
}

/** The world rect of a piece's blocking body (bottom-anchored), or null. */
export function hazardSolidRect(entry: HazardPiece): BossRect | null {
  if (!entry.visible || !entry.solid) return null
  return { x: entry.x - entry.solid.width / 2, y: entry.y - entry.solid.height, width: entry.solid.width, height: entry.solid.height }
}

// ------------------------------------------------------------------------------------------ icicle_fall

/** Shadow, then fall: the spike hangs over its column (floor marker below) before it drops. */
export const ICICLE_FALL = { warnMs: 520, gravity: 1100, shatterMs: 140, staggerMs: 140, gap: 48, spikeHeight: 36, body: { width: 10, height: 20 } }

const icicleFall: Spawner = (spec) => {
  const count = clamp(Math.round(spec.count ?? 3), 1, 5)
  const order = [0, -1, 1, -2, 2]
  const columns = Array.from({ length: count }, (_, index) => laneX(spec, spec.heroX + order[index] * ICICLE_FALL.gap))
  const hangY = spec.ceilingY + ICICLE_FALL.spikeHeight
  const fallMs = Math.sqrt((2 * Math.max(8, spec.floorY - hangY)) / ICICLE_FALL.gravity) * 1000
  const endMs = (count - 1) * ICICLE_FALL.staggerMs + ICICLE_FALL.warnMs + fallMs + ICICLE_FALL.shatterMs
  return {
    sample(t) {
      const pieces = columns.map((x, index) => {
        const local = t - index * ICICLE_FALL.staggerMs
        if (local < 0) return hidden(x, hangY)
        if (local < ICICLE_FALL.warnMs) return piece({ x, y: hangY, alpha: 0.55 + 0.45 * (local / ICICLE_FALL.warnMs), marker: true })
        const fallT = (local - ICICLE_FALL.warnMs) / 1000
        if (fallT * 1000 < fallMs) {
          return piece({ x, y: Math.min(spec.floorY, hangY + 0.5 * ICICLE_FALL.gravity * fallT * fallT), body: ICICLE_FALL.body, marker: true })
        }
        const shatter = local - ICICLE_FALL.warnMs - fallMs
        return shatter < ICICLE_FALL.shatterMs ? floor(spec, x, { frame: 1, alpha: 1 - shatter / ICICLE_FALL.shatterMs }) : hidden(x, spec.floorY)
      })
      return frameOf(t < ICICLE_FALL.warnMs ? 'shadow' : 'fall', pieces, t >= endMs)
    }
  }
}

// ------------------------------------------------------------------------------------------ charge_mine

/** Placed on take-off; arms after 400ms; detonates when the hero touches it armed, or on its fuse. */
export const CHARGE_MINE = { armMs: 400, fuseMs: 2600, blinkMs: 120, blastMs: 220, trigger: { width: 16, height: 10 }, blast: { width: 40, height: 28 } }

const chargeMine: Spawner = (spec) => {
  const x = laneX(spec, spec.originX)
  let detonatedAt: number | null = null
  return {
    sample(t, env) {
      if (detonatedAt === null) {
        const armed = t >= CHARGE_MINE.armMs
        const trigger = { x: x - CHARGE_MINE.trigger.width / 2, y: spec.floorY - CHARGE_MINE.trigger.height, ...CHARGE_MINE.trigger }
        if ((armed && env.hero && rectsOverlap(env.hero, trigger)) || t >= CHARGE_MINE.fuseMs) {
          detonatedAt = t
        } else {
          return frameOf(armed ? 'armed' : 'arming', [floor(spec, x, { frame: armed ? 1 + loopFrame(t - CHARGE_MINE.armMs, CHARGE_MINE.blinkMs, 2) : 0 })])
        }
      }
      const since = t - detonatedAt
      if (since < CHARGE_MINE.blastMs) {
        return frameOf('blast', [floor(spec, x, { frame: 3, scale: 1.4, body: CHARGE_MINE.blast })])
      }
      return frameOf('spent', [hidden(x, spec.floorY)], true)
    }
  }
}

// --------------------------------------------------------------------------------------- tornado_pillar

/** Rises ahead of the boss, then drifts towards the hero. */
export const TORNADO_PILLAR = { ahead: 48, riseMs: 260, activeMs: 1700, fadeMs: 220, driftPxPerS: 38, frameMs: 70, body: { width: 18, height: 54 } }

const tornadoPillar: Spawner = (spec) => {
  let x = laneX(spec, spec.originX + spec.facing * TORNADO_PILLAR.ahead, 16)
  let lastT = 0
  const { riseMs, activeMs, fadeMs } = TORNADO_PILLAR
  return {
    sample(t, env) {
      const dt = Math.max(0, t - lastT) / 1000
      lastT = Math.max(lastT, t)
      const frame = loopFrame(t, TORNADO_PILLAR.frameMs, 4)
      if (t < riseMs) {
        const grown = progress(t, 0, riseMs)
        return frameOf('rise', [floor(spec, x, { frame, scale: 0.4 + 0.6 * grown, alpha: 0.5 + 0.5 * grown })])
      }
      if (t < riseMs + activeMs) {
        if (env.hero) {
          const heroX = env.hero.x + env.hero.width / 2
          const step = TORNADO_PILLAR.driftPxPerS * dt
          x = laneX(spec, x + clamp(heroX - x, -step, step), 16)
        }
        return frameOf('drift', [floor(spec, x, { frame, body: TORNADO_PILLAR.body })])
      }
      const fade = progress(t, riseMs + activeMs, fadeMs)
      return frameOf('fade', [floor(spec, x, { frame, alpha: 1 - fade, visible: fade < 1 })], fade >= 1)
    }
  }
}

// ---------------------------------------------------------------------------------------- splash_pillar

/** Ripple, rise, hold, fall: the art's frames 0-3 are the pillar growing from the floor. */
export const SPLASH_PILLAR = { warnMs: 260, riseMs: 140, holdMs: 520, fallMs: 160, staggerMs: 60, gap: 72, body: { width: 24, height: 58 } }

const splashPillar: Spawner = (spec) => {
  const count = clamp(Math.round(spec.count ?? 2), 1, 4)
  const xs = offsets(count, SPLASH_PILLAR.gap).map((dx) => laneX(spec, spec.originX + dx))
  const { warnMs, riseMs, holdMs, fallMs, staggerMs } = SPLASH_PILLAR
  const pillarMs = warnMs + riseMs + holdMs + fallMs
  return {
    sample(t) {
      const pieces = xs.map((x, index) => {
        const local = t - index * staggerMs
        if (local < 0 || local >= pillarMs) return hidden(x, spec.floorY)
        if (local < warnMs) return floor(spec, x, { alpha: 0.85, marker: true })
        if (local < warnMs + riseMs) {
          const grown = progress(local, warnMs, riseMs)
          return floor(spec, x, { frame: grown < 0.5 ? 1 : 2, body: grown < 0.5 ? null : { width: SPLASH_PILLAR.body.width, height: 40 } })
        }
        if (local < warnMs + riseMs + holdMs) return floor(spec, x, { frame: 3, body: SPLASH_PILLAR.body })
        return floor(spec, x, { frame: progress(local, warnMs + riseMs + holdMs, fallMs) < 0.5 ? 2 : 1, alpha: 0.8 })
      })
      const phase = t < warnMs ? 'ripple' : t < warnMs + riseMs ? 'rise' : 'hold'
      return frameOf(phase, pieces, t >= (count - 1) * staggerMs + pillarMs)
    }
  }
}

// ------------------------------------------------------------------------------ burn_puddle, acid_trail

interface TrailConfig {
  id: 'burn_puddle' | 'acid_trail'
  count: number
  spacing: number
  appearMs: number
  lingerMs: number
  fadeMs: number
  frameMs: number
  body: { width: number; height: number }
}

/** Ignition Dash leaves a puddle each 24px of its dash; they linger, low enough to jump. */
export const BURN_PUDDLE: TrailConfig = { id: 'burn_puddle', count: 4, spacing: 24, appearMs: 120, lingerMs: 2100, fadeMs: 300, frameMs: 110, body: { width: 26, height: 8 } }
/** Toxic Slide's poison trail: more, thinner, shorter-lived. */
export const ACID_TRAIL: TrailConfig = { id: 'acid_trail', count: 5, spacing: 26, appearMs: 100, lingerMs: 1700, fadeMs: 300, frameMs: 130, body: { width: 24, height: 6 } }

function lingeringTrail(spec: HazardSpec, config: TrailConfig): Pick<BossHazard, 'sample'> {
  const speed = Math.max(60, spec.speed ?? 240)
  const count = clamp(Math.round(spec.count ?? config.count), 1, 8)
  const xs = Array.from({ length: count }, (_, index) => laneX(spec, spec.originX + spec.facing * index * config.spacing, 10))
  const delays = xs.map((_, index) => ((index * config.spacing) / speed) * 1000)
  const pieceMs = config.appearMs + config.lingerMs + config.fadeMs
  return {
    sample(t) {
      const pieces = xs.map((x, index) => {
        const local = t - delays[index]
        const frame = loopFrame(local, config.frameMs, 4)
        if (local < 0 || local >= pieceMs) return hidden(x, spec.floorY)
        if (local < config.appearMs) return floor(spec, x, { frame, alpha: 0.4 + 0.6 * progress(local, 0, config.appearMs) })
        if (local < config.appearMs + config.lingerMs) return floor(spec, x, { frame, body: config.body })
        return floor(spec, x, { frame, alpha: 1 - progress(local, config.appearMs + config.lingerMs, config.fadeMs) })
      })
      return frameOf(t < delays[delays.length - 1] ? 'laying' : 'linger', pieces, t >= delays[delays.length - 1] + pieceMs)
    }
  }
}

// ------------------------------------------------------------------------------------------ magnet_node

/** A node beside the hero, on the boss's side; it pulls the hero 40px/s towards it within 96px. */
export const MAGNET_NODE = { offset: 64, lift: 26, appearMs: 200, activeMs: 2400, fadeMs: 200, pullPxPerS: 40, radius: 96, frameMs: 140, body: { width: 16, height: 16 } }

/** The pull a node at (x, y) puts on a hero centred at (heroX, heroY): 40px/s towards it within 96px, else 0. */
export function magnetPull(node: { x: number; y: number }, hero: { x: number; y: number }): number {
  const dx = node.x - hero.x
  return Math.hypot(dx, node.y - hero.y) <= MAGNET_NODE.radius && Math.abs(dx) > 1 ? Math.sign(dx) * MAGNET_NODE.pullPxPerS : 0
}

const magnetNode: Spawner = (spec) => {
  const x = laneX(spec, spec.heroX + (spec.originX >= spec.heroX ? 1 : -1) * MAGNET_NODE.offset, 16)
  const y = spec.floorY - MAGNET_NODE.lift
  const { appearMs, activeMs, fadeMs } = MAGNET_NODE
  return {
    sample(t, env) {
      const frame = loopFrame(t, MAGNET_NODE.frameMs, 4)
      if (t < appearMs) return frameOf('appear', [piece({ x, y, anchor: 'center', frame, scale: 0.8, alpha: progress(t, 0, appearMs) })])
      if (t < appearMs + activeMs) {
        const heroCentre = env.hero ? { x: env.hero.x + env.hero.width / 2, y: env.hero.y + env.hero.height / 2 } : null
        const pull = heroCentre ? magnetPull({ x, y }, heroCentre) : 0
        return { phase: 'pull', pieces: [piece({ x, y, anchor: 'center', frame, scale: 0.8, body: MAGNET_NODE.body })], pullX: pull, field: { x, y, radius: MAGNET_NODE.radius }, done: false }
      }
      const fade = progress(t, appearMs + activeMs, fadeMs)
      return frameOf('fade', [piece({ x, y, anchor: 'center', frame, scale: 0.8, alpha: 1 - fade, visible: fade < 1 })], fade >= 1)
    }
  }
}

// ----------------------------------------------------------------------------------------- stone_pillar

/** Rubble under the hero, then a pillar that hurts as it rises and blocks while it stands. */
export const STONE_PILLAR = { warnMs: 360, riseMs: 180, standMs: 1500, sinkMs: 200, staggerMs: 120, gap: 84, body: { width: 28, height: 44 }, solid: { width: 30, height: 46 } }

const stonePillar: Spawner = (spec) => {
  const count = clamp(Math.round(spec.count ?? 2), 1, 3)
  const xs = Array.from({ length: count }, (_, index) => laneX(spec, spec.heroX + spec.facing * index * STONE_PILLAR.gap, 16))
  const { warnMs, riseMs, standMs, sinkMs, staggerMs } = STONE_PILLAR
  const pillarMs = warnMs + riseMs + standMs + sinkMs
  return {
    sample(t) {
      const pieces = xs.map((x, index) => {
        const local = t - index * staggerMs
        if (local < 0 || local >= pillarMs) return hidden(x, spec.floorY)
        if (local < warnMs) return floor(spec, x, { marker: true })
        if (local < warnMs + riseMs) return floor(spec, x, { frame: 1 + Math.min(2, Math.floor(progress(local, warnMs, riseMs) * 3)), body: STONE_PILLAR.body })
        if (local < warnMs + riseMs + standMs) return floor(spec, x, { frame: 3, solid: STONE_PILLAR.solid })
        return floor(spec, x, { frame: progress(local, warnMs + riseMs + standMs, sinkMs) < 0.5 ? 2 : 1, alpha: 0.85 })
      })
      const phase = t < warnMs ? 'rubble' : t < warnMs + riseMs ? 'rise' : 'stand'
      return frameOf(phase, pieces, t >= (count - 1) * staggerMs + pillarMs)
    }
  }
}

// -------------------------------------------------------------------------------------------- vapor_pod

/** Pods beside the hero pulse faster and faster, then burst: only the burst hurts. */
export const VAPOR_POD = { appearMs: 150, fuseMs: 1100, burstMs: 280, staggerMs: 90, gap: 80, pulseMs: 160, body: { width: 40, height: 34 } }

const vaporPod: Spawner = (spec) => {
  const count = clamp(Math.round(spec.count ?? 2), 1, 3)
  const xs = offsets(count, VAPOR_POD.gap).map((dx) => laneX(spec, spec.heroX + dx))
  const { appearMs, fuseMs, burstMs, staggerMs } = VAPOR_POD
  const podMs = appearMs + fuseMs + burstMs
  return {
    sample(t) {
      const pieces = xs.map((x, index) => {
        const local = t - index * staggerMs
        if (local < 0 || local >= podMs) return hidden(x, spec.floorY)
        if (local < appearMs) return floor(spec, x, { alpha: progress(local, 0, appearMs) })
        if (local < appearMs + fuseMs) {
          const fuse = progress(local, appearMs, fuseMs)
          return floor(spec, x, { frame: loopFrame(local - appearMs, Math.max(60, VAPOR_POD.pulseMs * (1 - 0.6 * fuse)), 3) })
        }
        return floor(spec, x, { frame: 3, scale: 1.3, body: VAPOR_POD.body })
      })
      return frameOf(t < appearMs + fuseMs ? 'fuse' : 'burst', pieces, t >= (count - 1) * staggerMs + podMs)
    }
  }
}

// ------------------------------------------------------------------------------ short_quake, ground_shockwave

/** Rook's stomp: two small ripples run both ways a short distance. Low: a jump clears them. */
export const SHORT_QUAKE = { speedPxPerS: 150, travelPx: 96, start: 12, scale: 0.75, frameMs: 70, body: { width: 14, height: 8 } }
/** A wave along the floor to the wall. Its body is 10px high: a jumping hero's feet clear it. */
export const GROUND_SHOCKWAVE = { speedPxPerS: 200, start: 20, frameMs: 60, maxMs: 2600, body: { width: 16, height: 10 } }

const shortQuake: Spawner = (spec) => {
  const travelMs = (SHORT_QUAKE.travelPx / SHORT_QUAKE.speedPxPerS) * 1000
  return {
    sample(t) {
      const run = SHORT_QUAKE.start + (SHORT_QUAKE.speedPxPerS * Math.max(0, t)) / 1000
      const fade = progress(t, travelMs * 0.8, travelMs * 0.2)
      const pieces = ([-1, 1] as const).map((direction) => {
        const x = spec.originX + direction * run
        if (t >= travelMs || x < spec.minX || x > spec.maxX) return hidden(x, spec.floorY)
        return floor(spec, x, { frame: loopFrame(t, SHORT_QUAKE.frameMs, 4), scale: SHORT_QUAKE.scale, flipX: direction < 0, alpha: 1 - 0.6 * fade, body: SHORT_QUAKE.body })
      })
      return frameOf('ripple', pieces, t >= travelMs)
    }
  }
}

const groundShockwave: Spawner = (spec) => {
  const directions: Array<1 | -1> = (spec.count ?? 1) >= 2 ? [-1, 1] : [spec.facing]
  return {
    sample(t) {
      const run = GROUND_SHOCKWAVE.start + (GROUND_SHOCKWAVE.speedPxPerS * Math.max(0, t)) / 1000
      const pieces = directions.map((direction) => {
        const x = spec.originX + direction * run
        if (x < spec.minX || x > spec.maxX) return hidden(x, spec.floorY)
        return floor(spec, x, { frame: loopFrame(t, GROUND_SHOCKWAVE.frameMs, 4), flipX: direction < 0, body: GROUND_SHOCKWAVE.body })
      })
      return frameOf('travel', pieces, t >= GROUND_SHOCKWAVE.maxMs || pieces.every((entry) => !entry.visible))
    }
  }
}

// ------------------------------------------------------------------------------------------ wind_hitbox

/** Turbine Slice's gust: a moving box at waist height, not a bullet (player shots pass through it). */
export const WIND_HITBOX = { start: 24, travelPx: 220, lift: 6, frameMs: 60, body: { width: 34, height: 20 } }

const windHitbox: Spawner = (spec) => {
  const speed = Math.max(80, spec.speed ?? 240)
  const travelMs = (WIND_HITBOX.travelPx / speed) * 1000
  return {
    sample(t) {
      const x = spec.originX + spec.facing * (WIND_HITBOX.start + (speed * Math.max(0, t)) / 1000)
      const inside = x >= spec.minX && x <= spec.maxX && t < travelMs
      const gust = inside
        ? piece({ x, y: spec.floorY - WIND_HITBOX.lift, frame: loopFrame(t, WIND_HITBOX.frameMs, 4), flipX: spec.facing < 0, body: WIND_HITBOX.body })
        : hidden(x, spec.floorY - WIND_HITBOX.lift)
      return frameOf('gust', [gust], !inside)
    }
  }
}

// --------------------------------------------------------------------------------------------- mag_disc

/** Out along the boss's facing, slowing to a stop 108px away at 600ms, then back to the boss's muzzle. */
export const MAG_DISC = { outPxPerS: 360, turnMs: 600, returnPxPerS: 300, catchPx: 12, maxMs: 2800, frameMs: 50, body: { width: 14, height: 14 } }

const magDisc: Spawner = (spec) => {
  const x0 = spec.originX + 12 * spec.facing
  const deceleration = MAG_DISC.outPxPerS / (MAG_DISC.turnMs / 1000)
  let x = x0
  let y = spec.muzzleY
  let lastT = 0
  let caught = false
  return {
    sample(t, env) {
      const frame = loopFrame(t, MAG_DISC.frameMs, 4)
      if (t < MAG_DISC.turnMs) {
        const s = Math.max(0, t) / 1000
        x = clamp(x0 + spec.facing * (MAG_DISC.outPxPerS * s - 0.5 * deceleration * s * s), spec.minX, spec.maxX)
        lastT = Math.max(lastT, t)
        return frameOf('out', [piece({ x, y, anchor: 'center', frame, scale: 0.8, body: MAG_DISC.body })])
      }
      const step = (MAG_DISC.returnPxPerS * Math.max(0, t - lastT)) / 1000
      lastT = Math.max(lastT, t)
      const dx = env.boss.x - x
      const dy = env.boss.y - y
      const distance = Math.hypot(dx, dy)
      if (!caught && distance <= Math.max(MAG_DISC.catchPx, step)) caught = true
      if (!caught) {
        x += (dx / distance) * step
        y += (dy / distance) * step
      }
      const done = caught || t >= MAG_DISC.maxMs
      return frameOf('return', [done ? hidden(x, y, 'center') : piece({ x, y, anchor: 'center', frame, scale: 0.8, body: MAG_DISC.body })], done)
    }
  }
}

// -------------------------------------------------------------------------------------------- blaze_lob

/** Blaze Lob: the orb arcs to the hero's x and bursts into three falling arcs where it lands. */
export const BLAZE_LOB = {
  flightMs: 720,
  peakPx: 64,
  gravity: 900,
  arcs: [
    { vx: -120, vy: -260 },
    { vx: 0, vy: -300 },
    { vx: 120, vy: -260 }
  ],
  orb: { width: 14, height: 14 },
  ember: { width: 10, height: 10 },
  maxMs: 2400
}

/** Where the lob lands: the hero's column, kept in the room. */
export function blazeLobLanding(spec: HazardSpec): { x: number; y: number } {
  return { x: laneX(spec, spec.heroX), y: spec.floorY - 8 }
}

const blazeLob: Spawner = (spec) => {
  const x0 = spec.originX + 12 * spec.facing
  const y0 = spec.muzzleY
  const landing = blazeLobLanding(spec)
  return {
    sample(t) {
      const frame = loopFrame(t, 80, 4)
      if (t < BLAZE_LOB.flightMs) {
        const p = Math.max(0, t) / BLAZE_LOB.flightMs
        const orb = piece({
          x: x0 + (landing.x - x0) * p,
          y: y0 + (landing.y - y0) * p - 4 * BLAZE_LOB.peakPx * p * (1 - p),
          anchor: 'center',
          frame,
          scale: 0.8,
          flipX: spec.facing < 0,
          body: BLAZE_LOB.orb
        })
        return frameOf('lob', [orb, ...BLAZE_LOB.arcs.map(() => hidden(landing.x, landing.y, 'center'))])
      }
      const s = (t - BLAZE_LOB.flightMs) / 1000
      const embers = BLAZE_LOB.arcs.map(({ vx, vy }) => {
        const x = landing.x + vx * s
        const y = landing.y + vy * s + 0.5 * BLAZE_LOB.gravity * s * s
        const landed = s > 0.05 && y >= spec.floorY - 4
        return landed || x < spec.minX || x > spec.maxX
          ? hidden(x, y, 'center')
          : piece({ x, y, anchor: 'center', frame, scale: 0.45, flipX: vx < 0, body: BLAZE_LOB.ember })
      })
      const done = t >= BLAZE_LOB.maxMs || (s > 0.05 && embers.every((entry) => !entry.visible))
      return frameOf('arcs', [hidden(landing.x, landing.y, 'center'), ...embers], done)
    }
  }
}

const SPAWNERS: Record<BossHazardId, Spawner> = {
  icicle_fall: icicleFall,
  charge_mine: chargeMine,
  tornado_pillar: tornadoPillar,
  splash_pillar: splashPillar,
  burn_puddle: (spec) => lingeringTrail(spec, BURN_PUDDLE),
  acid_trail: (spec) => lingeringTrail(spec, ACID_TRAIL),
  magnet_node: magnetNode,
  stone_pillar: stonePillar,
  vapor_pod: vaporPod,
  short_quake: shortQuake,
  ground_shockwave: groundShockwave,
  wind_hitbox: windHitbox,
  mag_disc: magDisc,
  blaze_lob: blazeLob
}

export function createBossHazard(spec: HazardSpec): BossHazard {
  return { id: spec.id, damage: spec.damage, ...SPAWNERS[spec.id](spec) }
}
