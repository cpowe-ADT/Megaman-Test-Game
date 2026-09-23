export type RegistryEntry = {
  id: string
}

export class Registry<TEntry extends RegistryEntry> {
  private readonly entries = new Map<string, TEntry>()

  register(entry: TEntry): void {
    this.entries.set(entry.id, entry)
  }

  get(id: string): TEntry | undefined {
    return this.entries.get(id)
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  all(): TEntry[] {
    return Array.from(this.entries.values())
  }

  clear(): void {
    this.entries.clear()
  }
}
