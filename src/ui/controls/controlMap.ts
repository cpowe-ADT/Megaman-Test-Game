export type ControlRow = {
  action: string
  input: string
}

export type ControlSection = {
  title: string
  rows: ControlRow[]
}

export const CONTROL_SECTIONS: ControlSection[] = [
  {
    title: 'Gameplay',
    rows: [
      { action: 'Move', input: 'Left / Right arrows' },
      { action: 'Aim / crouch', input: 'Up / Down arrows' },
      { action: 'Jump', input: 'Space' },
      { action: 'Dash', input: 'Z' },
      { action: 'Shoot / charge', input: 'X (hold to charge)' },
      { action: 'Saber combo', input: 'C' },
      { action: 'Cycle weapon', input: 'D or E' },
      { action: 'Cycle weapon back', input: 'Q' },
      { action: 'Pause menu', input: 'Esc' }
    ]
  },
  {
    title: 'Menus',
    rows: [
      { action: 'Navigate', input: 'Arrow keys' },
      { action: 'Confirm', input: 'Enter / Numpad / Space' },
      { action: 'Back / cancel', input: 'Esc' }
    ]
  },
  {
    title: 'Stage Select',
    rows: [
      { action: 'Move selection', input: 'Arrow keys' },
      { action: 'Checkpoint', input: 'L / R' },
      { action: 'Tutorial', input: 'T' },
      { action: 'Final route', input: 'F (when unlocked)' }
    ]
  }
]

export const CONTROL_NOTES = [
  'Touch controls appear automatically on supported touch devices.',
  'Controller mappings are not currently wired in this build.'
]
