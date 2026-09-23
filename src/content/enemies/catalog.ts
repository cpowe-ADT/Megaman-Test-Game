import type { EnemyDefinition } from '../../enemy/types'
import generatedCatalogJson from './enemy_catalog.generated.json'

type GeneratedEnemyCatalog = {
  schemaVersion: '1'
  generatedAt: string
  entries: Record<string, EnemyDefinition>
}

const generatedCatalog = generatedCatalogJson as GeneratedEnemyCatalog

export function getGeneratedEnemyDefinition(typeKey: string): EnemyDefinition | undefined {
  return generatedCatalog.entries[typeKey]
}

export function getGeneratedEnemyDefinitions(): Record<string, EnemyDefinition> {
  return generatedCatalog.entries
}

export function getGeneratedEnemyCount(): number {
  return Object.keys(generatedCatalog.entries).length
}
