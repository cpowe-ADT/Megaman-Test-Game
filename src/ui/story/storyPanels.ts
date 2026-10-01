/**
 * Part 12i (EVAL-P8-003): the eight story panels (Higgsfield gpt_image_2 stills cut to 448x252 and 48 colours by
 * `scripts/sprites/cut_keyart_v1.py`; provenance in `assets/ui/README.md`) and which page shows which. Pure.
 * Loading: the prologue's four in `PrologueScene`, the epilogue's four in `EndingScene`; each scene evicts its own on shutdown.
 */
export const STORY_PANEL_IDS = [
  'prologue_city', 'prologue_override', 'prologue_hangar', 'prologue_vale',
  'epilogue_dawn', 'epilogue_streets', 'epilogue_archive', 'epilogue_choice'
] as const
export type StoryPanelId = typeof STORY_PANEL_IDS[number]

export const PROLOGUE_PANEL_IDS: readonly StoryPanelId[] = ['prologue_city', 'prologue_override', 'prologue_hangar', 'prologue_vale']
export const EPILOGUE_PANEL_IDS: readonly StoryPanelId[] = ['epilogue_dawn', 'epilogue_streets', 'epilogue_archive', 'epilogue_choice']

export function storyPanelKey(id: StoryPanelId): string {
  return `story_panel_${id}`
}

export function storyPanelPath(id: StoryPanelId): string {
  return `assets/ui/story/${id}.png`
}

/** The seven prologue pages: the city twice, the override, the Drill Hangar, Vale's two lines, the override again. */
const PROLOGUE_PAGES: readonly StoryPanelId[] = [
  'prologue_city', 'prologue_city', 'prologue_override', 'prologue_hangar', 'prologue_vale', 'prologue_vale', 'prologue_override'
]

/** Vale's lines always show her operations room, whatever page they land on. */
export function prologuePanel(pageIndex: number, speakerId?: string | null): StoryPanelId {
  if (speakerId === 'director_iona') return 'prologue_vale'
  return PROLOGUE_PAGES[Math.max(0, Math.min(PROLOGUE_PAGES.length - 1, Math.floor(pageIndex)))]
}

/**
 * District cards: the four utility districts over the dawn city, the street districts over the street, the Public
 * Archives (and the Drill Hangar secret, which is about the public record) over the archive hall.
 */
const CARD_PANELS: Readonly<Record<string, StoryPanelId>> = {
  pyro_maw: 'epilogue_dawn', tide_reaver: 'epilogue_dawn', volt_hopper: 'epilogue_dawn', basalt_titan: 'epilogue_dawn',
  ferro_blade: 'epilogue_streets', mire_wraith: 'epilogue_streets', gale_vixen: 'epilogue_streets',
  glacier_ronin: 'epilogue_archive', tutorial_sentinel: 'epilogue_archive'
}

export function endingCardPanel(stageId: string): StoryPanelId {
  return CARD_PANELS[stageId] ?? 'epilogue_dawn'
}

/** The close: the record lines over the archive hall; the last two (the network holding, WREN's last line) over the rooftop sunrise. */
export function endingClosePanel(pageIndex: number, pageCount: number): StoryPanelId {
  return pageIndex >= pageCount - 2 ? 'epilogue_choice' : 'epilogue_archive'
}
