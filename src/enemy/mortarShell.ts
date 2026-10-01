import { rectsOverlap, type RectLike } from './floorProbe'

/**
 * A lobbed mortar shell (the relay turret nest's second attack, 12c): fired at the hero's position, it
 * flies a fixed time on a ballistic arc and lands exactly on the floor marker drawn at its target; the
 * landing blast hurts a hero standing in it. Like the ground shockwave it is not a `ProjectileSystem`
 * shot: the nest that fired it owns it (drawn and hit-tested by `RelayTurretNestBrain`).
 */
export interface MortarDefinition {
  key: string
  /** px/s², downward. */
  gravity: number
  /** Muzzle to floor, whatever the distance: the floor marker's warning time. */
  flightMs: number
  blastWidth: number
  blastHeight: number
  /** How long the blast stays live on the floor. */
  blastMs: number
  damage: number
}

export const RELAY_NEST_MORTAR: MortarDefinition = {
  key: 'relay_nest_mortar',
  gravity: 900,
  flightMs: 1000,
  blastWidth: 36,
  blastHeight: 28,
  blastMs: 200,
  damage: 2
}

export type MortarStage = 'flight' | 'blast' | 'spent'

export interface MortarShell {
  originX: number
  originY: number
  targetX: number
  floorTop: number
  vx: number
  vy: number
  elapsedMs: number
  x: number
  y: number
  stage: MortarStage
}

/** A shell from the muzzle that lands on (`targetX`, `floorTop`) after exactly `flightMs`. */
export function launchMortar(
  originX: number,
  originY: number,
  targetX: number,
  floorTop: number,
  def: MortarDefinition = RELAY_NEST_MORTAR
): MortarShell {
  const t = def.flightMs / 1000
  const vx = (targetX - originX) / t
  const vy = (floorTop - originY - 0.5 * def.gravity * t * t) / t
  return { originX, originY, targetX, floorTop, vx, vy, elapsedMs: 0, x: originX, y: originY, stage: 'flight' }
}

/** Position from the elapsed time (no drift with the frame rate); snaps to the target when it lands. */
export function stepMortar(shell: MortarShell, dtMs: number, def: MortarDefinition = RELAY_NEST_MORTAR): MortarShell {
  if (shell.stage === 'spent') {
    return shell
  }
  const elapsedMs = shell.elapsedMs + Math.max(0, dtMs)
  if (elapsedMs >= def.flightMs) {
    const stage: MortarStage = elapsedMs >= def.flightMs + def.blastMs ? 'spent' : 'blast'
    return { ...shell, elapsedMs, x: shell.targetX, y: shell.floorTop, stage }
  }
  const t = elapsedMs / 1000
  return {
    ...shell,
    elapsedMs,
    x: shell.originX + shell.vx * t,
    y: shell.originY + shell.vy * t + 0.5 * def.gravity * t * t,
    stage: 'flight'
  }
}

/** The highest point of the arc (smallest y). */
export function mortarApexY(shell: MortarShell, def: MortarDefinition = RELAY_NEST_MORTAR): number {
  const t = Math.max(0, -shell.vy / def.gravity)
  return shell.originY + shell.vy * t + 0.5 * def.gravity * t * t
}

export function mortarBlastRect(shell: Pick<MortarShell, 'targetX' | 'floorTop'>, def: MortarDefinition = RELAY_NEST_MORTAR): RectLike {
  return {
    left: shell.targetX - def.blastWidth / 2,
    right: shell.targetX + def.blastWidth / 2,
    top: shell.floorTop - def.blastHeight,
    bottom: shell.floorTop
  }
}

/** Only the landed blast hurts; a hero who left the marker, or is above the blast, is clear. */
export function mortarBlastHits(shell: MortarShell, hero: RectLike, def: MortarDefinition = RELAY_NEST_MORTAR): boolean {
  return shell.stage === 'blast' && rectsOverlap(mortarBlastRect(shell, def), hero)
}
