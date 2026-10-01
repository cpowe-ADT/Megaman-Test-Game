/** The identity adapter's one input: the active profile's pilot name (prompt 05 5.6), registered by `Save`. */
let heroCallsignResolver: (() => string | null | undefined) | null = null

/** `Save` registers the active profile here; with no profile (or no resolver) the hero is WREN. */
export function setHeroCallsignResolver(resolver: (() => string | null | undefined) | null): void {
  heroCallsignResolver = resolver
}

/** Original public identity: the only source of public names (the developer-only skin was retired in 05c, 5.5). */
export const IDENTITY = Object.freeze({
  GAME_TITLE: 'OMEGA RELAY',
  GAME_SUBTITLE: 'EIGHT WARDENS. ONE MANUFACTURED CRISIS.',
  /** The pilot name: `{hero}` in dialogue and the HUD label read it, so they follow the active profile. */
  get HERO_CALLSIGN(): string {
    return heroCallsignResolver?.() || 'WREN'
  },
  HERO_UNIT: 'RECOVERY UNIT 09',
  OPERATOR_NAME: 'Director Iona Vale',
  ANTAGONIST_NAME: 'OMEGA CORE',
  WARDEN_TERM: 'WARDEN',
  WARDEN_TERM_PLURAL: 'WARDENS',
  WARDEN_NAMES: Object.freeze({
    pyro_maw: 'Pyro Maw', tide_reaver: 'Tide Reaver', volt_hopper: 'Volt Hopper',
    basalt_titan: 'Basalt Titan', ferro_blade: 'Ferro Blade', mire_wraith: 'Mire Wraith',
    gale_vixen: 'Gale Vixen', glacier_ronin: 'Glacier Ronin'
  })
})
