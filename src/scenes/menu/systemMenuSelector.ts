export type SystemMenuSource = 'Game' | 'StageSelect'

export type SystemMenuAction =
  | 'resume'
  | 'controls'
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
}

export function buildSystemMenuOptions(source: SystemMenuSource, hasActiveRun: boolean): SystemMenuOption[] {
  if (source === 'Game') {
    return [
      { id: 'resume', label: 'Resume', enabled: true },
      { id: 'controls', label: 'Controls', enabled: true },
      { id: 'progression', label: 'Progression', enabled: true },
      { id: 'save_game', label: 'Save Game', enabled: true },
      { id: 'load_game', label: 'Load Save', enabled: hasActiveRun },
      { id: 'new_game', label: 'Start New', enabled: true },
      { id: 'stage_select', label: 'Exit To Stage Select', enabled: true },
      { id: 'clear_save', label: 'Clear Save Data', enabled: true }
    ]
  }

  return [
    { id: 'controls', label: 'Controls', enabled: true },
    { id: 'progression', label: 'Progression', enabled: true },
    { id: 'load_game', label: 'Continue (Load Save)', enabled: hasActiveRun },
    { id: 'new_game', label: 'Start New', enabled: true },
    { id: 'clear_save', label: 'Clear Save Data', enabled: true },
    { id: 'back', label: 'Back', enabled: true }
  ]
}

export function selectMenuIndex(current: number, delta: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return (current + delta + total) % total
}
