import fs from 'node:fs'
import path from 'node:path'

async function main() {
  const mod = await import('../../src/enemy/EnemyCatalog.ts')
  const catalog = mod.EnemyCatalog

  const outPath = path.resolve('src/content/enemies/enemy_catalog.generated.json')
  const payload = {
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    entries: catalog
  }

  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  const count = Object.keys(catalog).length
  console.log(`[enemy-catalog] wrote ${count} entries to ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
