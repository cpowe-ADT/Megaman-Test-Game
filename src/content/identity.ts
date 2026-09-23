/** Original public identity; the private skin changes only developer artwork and its HUD label. */
export const IDENTITY = Object.freeze({
  GAME_TITLE: 'OMEGA RELAY',
  GAME_SUBTITLE: 'EIGHT WARDENS. ONE MANUFACTURED CRISIS.',
  HERO_CALLSIGN: 'WREN',
  HERO_UNIT: 'RECOVERY UNIT 09',
  OPERATOR_NAME: 'Director Iona Vale',
  ANTAGONIST_NAME: 'OMEGA CORE',
  WARDEN_TERM: 'WARDEN',
  WARDEN_TERM_PLURAL: 'WARDENS',
  WARDEN_NAMES: Object.freeze({
    pyro_maw: 'Pyro Maw', tide_reaver: 'Tide Reaver', volt_hopper: 'Volt Hopper',
    basalt_titan: 'Basalt Titan', ferro_blade: 'Ferro Blade', mire_wraith: 'Mire Wraith',
    gale_vixen: 'Gale Vixen', glacier_ronin: 'Glacier Ronin'
  }),
  DEV_SKIN: Object.freeze({
    enabled: typeof __PRIVATE_SPRITE_MANIFEST_DATA__ !== 'undefined' &&
      __PRIVATE_SPRITE_MANIFEST_DATA__ !== null && import.meta.env?.VITE_PUBLIC_BUILD !== '1',
    heroLabel: 'MEGA MAN X'
  })
})
