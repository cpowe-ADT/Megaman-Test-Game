import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { validateSpriteManifest } from '../../src/assets/validateManifest.ts'

function parseArgs(argv) {
  const args = {
    manifest: 'assets/sprites/manifest.v1.json',
    json: false
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--manifest' && next) {
      args.manifest = next
      i += 1
      continue
    }
    if (arg === '--json') {
      args.json = true
    }
  }

  return args
}

function main() {
  const args = parseArgs(process.argv)
  const manifestPath = path.resolve(process.cwd(), args.manifest)

  if (!fs.existsSync(manifestPath)) {
    console.error(`[sprites] Manifest not found: ${manifestPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(manifestPath, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error(`[sprites] Invalid JSON in manifest: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  const result = validateSpriteManifest(parsed)
  if (!result.valid) {
    if (args.json) {
      console.error(JSON.stringify({ valid: false, errors: result.errors }, null, 2))
    } else {
      console.error('[sprites] Manifest validation failed:')
      result.errors.forEach((error) => console.error(`  - ${error}`))
    }
    process.exit(1)
  }

  const ready = result.manifest.entries.filter((entry) => entry.status === 'ready').length
  const planned = result.manifest.entries.length - ready
  const summary = {
    valid: true,
    manifest: path.relative(process.cwd(), manifestPath),
    entries: result.manifest.entries.length,
    ready,
    planned
  }

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(
      `[sprites] Manifest valid (${summary.entries} entries, ${summary.ready} ready, ${summary.planned} planned)`
    )
  }
}

main()
