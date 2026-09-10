export type DialoguePlaybackLine = {
  sequenceId: string
  speakerId: string
  speakerName: string
  text: string
}

export type DialoguePlaybackSnapshot = {
  active: boolean
  lineIndex: number
  lineCount: number
  sequenceId: string | null
  speakerId: string | null
  speakerName: string | null
  text: string | null
}

export class DialoguePlayback {
  private lines: DialoguePlaybackLine[] = []
  private index = 0

  start(lines: DialoguePlaybackLine[]): DialoguePlaybackSnapshot {
    this.lines = lines.map((line) => ({ ...line }))
    this.index = 0
    return this.snapshot()
  }

  advance(): DialoguePlaybackSnapshot {
    if (this.index < this.lines.length) {
      this.index += 1
    }
    return this.snapshot()
  }

  skip(): DialoguePlaybackSnapshot {
    this.index = this.lines.length
    return this.snapshot()
  }

  snapshot(): DialoguePlaybackSnapshot {
    const line = this.lines[this.index]
    return {
      active: Boolean(line),
      lineIndex: Math.min(this.index, this.lines.length),
      lineCount: this.lines.length,
      sequenceId: line?.sequenceId ?? null,
      speakerId: line?.speakerId ?? null,
      speakerName: line?.speakerName ?? null,
      text: line?.text ?? null
    }
  }
}
