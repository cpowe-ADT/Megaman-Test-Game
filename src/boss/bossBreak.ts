/**
 * The boss "break" on a weakness hit (prompt 12 part 12f wave 5, EVAL-P7-002; Craig, 2026-09-25: the boss stops what
 * it is doing, makes a sound and falls back). A weakness hit outside the lockout cancels the running
 * attack whatever its lifecycle (and its pending spawn, tell and motion), knocks the boss back away from the hero,
 * and holds the first `defeat` frame as a recoil pose for the stun, under the white fill, `boss_hit_weak` and the
 * camera's weakness hit-stop. Pure: the timings, the lockout and the knockback curve. `BossBase` owns the lockout,
 * `BossController` plays the knockback and the pose; every clock here is boss time (hit-stop frames do not count).
 */
export const BOSS_BREAK = {
  /** The break's stun: no attack, no motion, the recoil pose held. */
  stunMs: 450,
  /** After a break, weakness hits deal their damage and blink but do not break again for this long. */
  lockoutMs: 1500,
  /** The knockback carries the boss this far from the hero... */
  knockbackPx: 24,
  /** ...over this long; then gravity lands it. */
  knockbackMs: 180,
  /** A grounded (or hybrid) boss hops this high on the way back. */
  hopPx: 10,
  /** A hover boss bobs this far instead of hopping. */
  bobPx: 4,
  /** A break that ends in the air holds until the boss lands, at most this much longer, so it cannot attack mid-fall. */
  maxAirHoldMs: 600
} as const

/** `hop`: grounded and hybrid bosses; `hover`: the aerial ones (their combat profile's `locomotion`). */
export type BossBreakStyle = 'hop' | 'hover'

export interface BossBreakOffset {
  /** Pixels away from the hero, 0 to `knockbackPx`. */
  dx: number
  /** Pixels on screen (negative is up). */
  dy: number
  /** The knockback has run its `knockbackMs`: gravity takes the boss from here. */
  done: boolean
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/**
 * Where the knockback has carried the boss `elapsedMs` in. A hop pushes out fast and settles (ease-out) under a
 * parabola that peaks at `hopPx` halfway and lands where it started. A hover boss drifts (ease-in-out) and bobs: it
 * sinks while afloat and lifts while standing, so it never bobs into the floor.
 */
export function breakKnockbackOffset(elapsedMs: number, style: BossBreakStyle, grounded = true): BossBreakOffset {
  const t = clamp01(elapsedMs / BOSS_BREAK.knockbackMs)
  if (style === 'hover') {
    const dx = (BOSS_BREAK.knockbackPx * (1 - Math.cos(Math.PI * t))) / 2
    const dy = (grounded ? -1 : 1) * BOSS_BREAK.bobPx * Math.sin(Math.PI * t)
    return { dx, dy: t >= 1 ? 0 : dy, done: t >= 1 }
  }
  const dx = BOSS_BREAK.knockbackPx * (1 - (1 - t) * (1 - t))
  const dy = -4 * BOSS_BREAK.hopPx * t * (1 - t)
  return { dx, dy: t >= 1 ? 0 : dy, done: t >= 1 }
}

/** Away from the hero; a hero in the boss's own column pushes it back from the way it faces. */
export function breakDirection(bossX: number, heroX: number, facing: -1 | 1): -1 | 1 {
  if (bossX !== heroX) return bossX > heroX ? 1 : -1
  return facing === 1 ? -1 : 1
}

/** The knockback's x this frame, clamped to the arena's safe bounds (the same bounds the controller clamps to). */
export function breakKnockbackX(startX: number, direction: -1 | 1, dx: number, bounds: { minX: number; maxX: number }): number {
  return Math.min(bounds.maxX, Math.max(bounds.minX, startX + direction * dx))
}

/**
 * The recoil pose a break holds: the first `defeat` frame (every runtime boss atlas has one). An atlas without the
 * grouped layout holds a frame named for a hit, else its last frame: Rook's legacy numbered atlas
 * (`assets/sprites/bosses/sentinel_rook/sentinel_rook.atlas.json`, not loaded at runtime) would hold `_11`.
 */
export function bossRecoilFrame(grouped: Readonly<Record<string, readonly string[]>>, frames: readonly string[]): string | undefined {
  return grouped.defeat?.[0] ?? frames.find((name) => /(^|[/_])(hit|hurt)([/_]|$)/.test(name)) ?? frames[frames.length - 1]
}

/** The lockout in boss time: a break starts it, and no other break lands until it has run out. */
export class BossBreakLockout {
  private remaining = 0

  get remainingMs(): number {
    return this.remaining
  }

  get ready(): boolean {
    return this.remaining <= 0
  }

  /** Starts a break's lockout if none is running; false means this weakness hit does not break the boss. */
  tryStart(lockoutMs: number = BOSS_BREAK.lockoutMs): boolean {
    if (!this.ready) return false
    this.remaining = Math.max(0, lockoutMs)
    return true
  }

  tick(dtMs: number): void {
    this.remaining = Math.max(0, this.remaining - Math.max(0, dtMs))
  }

  reset(): void {
    this.remaining = 0
  }
}
