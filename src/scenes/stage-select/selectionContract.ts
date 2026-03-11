export type SlotClickResolution = {
  nextIndex: number
  shouldConfirm: boolean
}

export function resolveSlotClick(currentIndex: number, clickedIndex: number): SlotClickResolution {
  if (clickedIndex === currentIndex) {
    return {
      nextIndex: currentIndex,
      shouldConfirm: true
    }
  }

  return {
    nextIndex: clickedIndex,
    shouldConfirm: false
  }
}

export function truncateLabel(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value
  }
  return `${value.slice(0, Math.max(1, maxChars - 1))}…`
}
