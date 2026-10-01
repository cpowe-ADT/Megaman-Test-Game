import type { EnemyDefinition } from '../../enemy/types'
import generatedCatalogJson from './enemy_catalog.generated.json'

type GeneratedEnemyCatalog = {
  schemaVersion: '1'
  generatedAt: string
  entries: Record<string, EnemyDefinition>
}

/**
 * A production build fetches the catalog in `Preload` (`installEnemyCatalog`) instead of bundling it (prompt 09
 * `jsGzipKB`; `__FETCH_CONTENT__`, as the dialogue does). Development, smoke and unit tests read the bundled file.
 * Every reader runs after `Preload` (enemies spawn in the Game scene) and falls back to `EnemyCatalog`.
 */
const fetchCatalog = typeof __FETCH_CONTENT__ !== 'undefined' && __FETCH_CONTENT__
let generatedCatalog = (fetchCatalog ? { schemaVersion: '1', generatedAt: '', entries: {} } : generatedCatalogJson) as GeneratedEnemyCatalog
let catalogInstalled = !fetchCatalog

export function enemyCatalogInstalled(): boolean {
  return catalogInstalled
}

export function installEnemyCatalog(json: unknown): void {
  generatedCatalog = json as GeneratedEnemyCatalog
  catalogInstalled = true
}

export function getGeneratedEnemyDefinition(typeKey: string): EnemyDefinition | undefined {
  return generatedCatalog.entries[typeKey]
}

export function getGeneratedEnemyDefinitions(): Record<string, EnemyDefinition> {
  return generatedCatalog.entries
}

export function getGeneratedEnemyCount(): number {
  return Object.keys(generatedCatalog.entries).length
}
