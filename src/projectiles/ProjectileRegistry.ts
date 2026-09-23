import type { ProjectileDefinition } from './types'

export class ProjectileRegistry {
  private readonly entries = new Map<string, ProjectileDefinition>()

  register(definition: ProjectileDefinition): void {
    this.entries.set(definition.id, definition)
  }

  registerAll(definitions: ProjectileDefinition[]): void {
    definitions.forEach((definition) => this.register(definition))
  }

  get(id: string): ProjectileDefinition | undefined {
    return this.entries.get(id)
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  all(): ProjectileDefinition[] {
    return Array.from(this.entries.values())
  }
}
