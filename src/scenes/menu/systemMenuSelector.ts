export type SystemMenuSource = 'Game' | 'StageSelect'

export type SystemMenuAction =
  | 'weapon'
  | 'sub_tank'
  | 'resume'
  | 'controls'
  | 'options'
  | 'progression'
  | 'save_game'
  | 'load_game'
  | 'new_game'
  | 'stage_select'
  | 'clear_save'
  | 'back'

export type SystemMenuOption = {
  id: SystemMenuAction
  label: string
  enabled: boolean
  /** Cycle rows react to left and right; action rows react to confirm. */
  kind: 'action' | 'cycle'
}

export type PauseInventoryWeapon = { id: string; label: string; energy: { current: number; max: number } }

export type PauseInventory = {
  weapons: PauseInventoryWeapon[]
  currentWeaponIndex: number
  subTankFill: number[]
  selectedSubTank: number
  heartTanks: number
  upgrades: string[]
}

export function describeSubTank(fill: number[], selected: number): string {
  if (fill.length === 0) return 'NONE'
  const value = fill[Math.max(0, Math.min(fill.length - 1, selected))] ?? 0
  return `TANK ${selected + 1}/${fill.length}  ${Math.round(value * 100)}%`
}

/**
 * The in-game pause menu is one linear list so keyboard, touch and automation share one cursor:
 * two inventory rows (weapon, sub tank) above the actions. Stage Select keeps a short console.
 * `save_game` and `load_game` remain handled by the scenes for automation, but are not listed.
 */
export function buildSystemMenuOptions(
  source: SystemMenuSource,
  inventory?: PauseInventory | null,
  includeDebug = false
): SystemMenuOption[] {
  if (source === 'Game') {
    const weapon = inventory?.weapons[inventory.currentWeaponIndex]
    const weaponLabel = weapon ? `${weapon.label}  ${weapon.energy.current}/${weapon.energy.max}` : 'Buster'
    const fills = inventory?.subTankFill ?? []
    return [
      { id: 'weapon', label: `Weapon  < ${weaponLabel} >`, enabled: true, kind: 'cycle' },
      { id: 'sub_tank', label: `Sub Tank  < ${describeSubTank(fills, inventory?.selectedSubTank ?? 0)} >`, enabled: fills.length > 0, kind: 'cycle' },
      { id: 'resume', label: 'Resume', enabled: true, kind: 'action' },
      { id: 'controls', label: 'Controls', enabled: true, kind: 'action' },
      { id: 'options', label: 'Options', enabled: true, kind: 'action' },
      { id: 'stage_select', label: 'Quit To Warden Select', enabled: true, kind: 'action' }
    ]
  }

  return [
    { id: 'controls', label: 'Controls', enabled: true, kind: 'action' },
    { id: 'options', label: 'Options', enabled: true, kind: 'action' },
    { id: 'new_game', label: 'New Campaign', enabled: true, kind: 'action' },
    ...(includeDebug ? [{ id: 'progression' as const, label: 'Progression', enabled: true, kind: 'action' as const }] : []),
    { id: 'back', label: 'Back', enabled: true, kind: 'action' }
  ]
}

export function selectMenuIndex(current: number, delta: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return (current + delta + total) % total
}
