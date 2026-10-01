/**
 * Maps a resolved dialogue speaker id to its 48x48 frame in the portrait atlas
 * (`assets/ui/portraits/portraits.{png,atlas.json}`, loaded on first use by `portraitAtlasLoader.ts`).
 *
 * Pure and Phaser-free so the mapping is unit-testable without a scene.
 */

/** Every frame name baked into `portraits.atlas.json`. */
export const PORTRAIT_FRAME_NAMES = [
  'wren', 'iona', 'rook', 'pyro_maw', 'tide_reaver', 'volt_hopper',
  'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin', 'omega_core'
] as const

export const PORTRAIT_ATLAS_KEY = 'atlas_ui_portraits'
export const PORTRAIT_FRAME_SIZE = 48
export const PORTRAIT_ATLAS_PNG_PATH = 'assets/ui/portraits/portraits.png'
export const PORTRAIT_ATLAS_JSON_PATH = 'assets/ui/portraits/portraits.atlas.json'

/**
 * Speaker ids (`src/content/dialogue/types.ts` `DIALOGUE_SPEAKER_IDS`) whose frame name is not the
 * id itself: the hero line speaks as the pilot (identity's `HERO_CALLSIGN`, frame `wren`), the
 * operator is `director_iona` (frame `iona`), and the tutorial mini-boss is `sentinel_rook` (frame
 * `rook`). Every warden id and `omega_core` already equal their frame name.
 */
const SPEAKER_FRAME_OVERRIDES: Readonly<Record<string, string>> = {
  hero: 'wren',
  director_iona: 'iona',
  sentinel_rook: 'rook'
}

/** `speakerId` to portrait frame; narration (no speaker) and any id without a frame return null. */
export function portraitForSpeaker(speakerId: string | null | undefined): string | null {
  if (!speakerId) return null
  const frame = SPEAKER_FRAME_OVERRIDES[speakerId] ?? speakerId
  return (PORTRAIT_FRAME_NAMES as readonly string[]).includes(frame) ? frame : null
}
