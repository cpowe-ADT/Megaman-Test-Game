import { getCampaignStage, TUTORIAL_STAGE_ID } from '../../content/campaign'

/**
 * Part 12i (EVAL-P8-003): the Title's attract cycle. The hero's own relay district opens it and three districts
 * follow, 20 s in all, each cross-fading over the last. Pure: the Title's backdrop asks it what to draw, which
 * district to load one beat ahead, and which layers to drop once their beat has faded out.
 */
export const ATTRACT_CYCLE_MS = 20_000
export const ATTRACT_FADE_MS = 900
/** A district's layers load this long before its beat, so the cross-fade never waits on the network. */
export const ATTRACT_LOAD_AHEAD_MS = 2_000
/** The relay district (loaded with the Title), then Heat Works, the Water District and the Public Archives. */
export const ATTRACT_STAGE_IDS: readonly string[] = [TUTORIAL_STAGE_ID, 'pyro_maw', 'tide_reaver', 'glacier_ronin']
export const ATTRACT_BEAT_MS = ATTRACT_CYCLE_MS / ATTRACT_STAGE_IDS.length

export type AttractFrame = {
  /** The beat on screen; 0 is the relay district. */
  beat: number
  stageId: string
  /** The beat it fades in over; equal to `beat` when nothing is fading. */
  previous: number
  /** 0..1: the beat's opacity over the previous one. */
  fade: number
  /** Districts whose layers must be loaded now: the relay district, the beat, the one fading out, the next one when it is close. */
  resident: string[]
}

export function attractFrame(elapsedMs: number): AttractFrame {
  const count = ATTRACT_STAGE_IDS.length
  const clamped = Math.max(0, elapsedMs)
  const t = clamped % ATTRACT_CYCLE_MS
  const beat = Math.min(count - 1, Math.floor(t / ATTRACT_BEAT_MS))
  const within = t - beat * ATTRACT_BEAT_MS
  // The very first beat fades in from nothing: there is no previous district yet.
  const fading = clamped >= ATTRACT_BEAT_MS && within < ATTRACT_FADE_MS
  const previous = fading ? (beat + count - 1) % count : beat
  const resident = new Set<string>([ATTRACT_STAGE_IDS[0], ATTRACT_STAGE_IDS[beat], ATTRACT_STAGE_IDS[previous]])
  if (within >= ATTRACT_BEAT_MS - ATTRACT_LOAD_AHEAD_MS) resident.add(ATTRACT_STAGE_IDS[(beat + 1) % count])
  return { beat, stageId: ATTRACT_STAGE_IDS[beat], previous, fade: fading ? within / ATTRACT_FADE_MS : 1, resident: [...resident] }
}

/** A district's parallax texture keys, from its stage background (`src/content/stageBackgroundCatalog.ts`). */
export function districtLayerKeys(stageId: string): string[] {
  return (getCampaignStage(stageId).arena.background?.layers ?? []).map((layer) => layer.key)
}

/** Loaded attract layers no resident district draws: the Title drops them once their beat has faded out. */
export function attractKeysToEvict(loadedKeys: readonly string[], elapsedMs: number): string[] {
  const keep = new Set(attractFrame(elapsedMs).resident.flatMap(districtLayerKeys))
  const attract = new Set(ATTRACT_STAGE_IDS.flatMap(districtLayerKeys))
  return loadedKeys.filter((key) => attract.has(key) && !keep.has(key))
}

/** PRESS START: on 650 ms, off 350 ms (1 Hz). Under Reduced Flashing it never goes dark: a slow 2 s swell between 55% and full. */
export function pressStartAlpha(elapsedMs: number, reducedFlashing: boolean): number {
  const t = Math.max(0, elapsedMs)
  if (reducedFlashing) return 0.775 + 0.225 * Math.cos((t / 2000) * Math.PI * 2)
  return t % 1000 < 650 ? 1 : 0
}
