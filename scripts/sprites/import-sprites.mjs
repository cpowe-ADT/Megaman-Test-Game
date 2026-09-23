import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { validateSpriteManifest } from '../../src/assets/validateManifest.ts'

const MAX_REMOTE_BYTES = Number(process.env.SPRITE_IMPORT_MAX_BYTES ?? 10 * 1024 * 1024)

function parseArgs(argv) {
  const args = {
    manifest: 'assets/sprites/manifest.v1.json',
    outDir: 'assets/sprites/imported',
    dryRun: false,
    overwrite: false
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--manifest' && next) {
      args.manifest = next
      i += 1
      continue
    }
    if (arg === '--out-dir' && next) {
      args.outDir = next
      i += 1
      continue
    }
    if (arg === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (arg === '--overwrite') {
      args.overwrite = true
    }
  }

  return args
}

function validateRemoteUrl(rawUrl) {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported URL protocol for ${rawUrl}`)
  }
  return parsed.toString()
}

async function fetchToFile(rawUrl, targetPath, overwrite) {
  if (fs.existsSync(targetPath) && !overwrite) {
    return 'skipped-existing'
  }

  const url = validateRemoteUrl(rawUrl)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_REMOTE_BYTES) {
    throw new Error(`Remote asset is too large (${contentLength} bytes) for ${url}`)
  }

  const data = Buffer.from(await response.arrayBuffer())
  if (data.byteLength > MAX_REMOTE_BYTES) {
    throw new Error(`Remote asset is too large (${data.byteLength} bytes) for ${url}`)
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, data)
  return 'downloaded'
}

async function main() {
  const args = parseArgs(process.argv)
  const manifestPath = path.resolve(process.cwd(), args.manifest)
  const outDir = path.resolve(process.cwd(), args.outDir)

  if (!fs.existsSync(manifestPath)) {
    console.error(`[sprites] Manifest not found: ${manifestPath}`)
    process.exit(1)
  }

  const manifestRaw = fs.readFileSync(manifestPath, 'utf8')
  const parsed = JSON.parse(manifestRaw)
  const validation = validateSpriteManifest(parsed)

  if (!validation.valid) {
    console.error('[sprites] Manifest validation failed before import:')
    validation.errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  const candidates = validation.manifest.entries.filter(
    (entry) => entry.source.remoteImageUrl && entry.source.remoteDataUrl
  )

  if (candidates.length === 0) {
    console.log('[sprites] No remote sources in manifest. Nothing to import.')
    process.exit(0)
  }

  let downloaded = 0
  let skipped = 0

  for (const entry of candidates) {
    const entryDir = path.join(outDir, entry.id)
    const imageTarget = path.join(entryDir, `${entry.atlasKey}.png`)
    const dataTarget = path.join(entryDir, `${entry.atlasKey}.json`)

    if (args.dryRun) {
      console.log(`[sprites][dry-run] ${entry.id}`)
      console.log(`  image: ${entry.source.remoteImageUrl} -> ${path.relative(process.cwd(), imageTarget)}`)
      console.log(`  data : ${entry.source.remoteDataUrl} -> ${path.relative(process.cwd(), dataTarget)}`)
      continue
    }

    try {
      const imageResult = await fetchToFile(entry.source.remoteImageUrl, imageTarget, args.overwrite)
      const dataResult = await fetchToFile(entry.source.remoteDataUrl, dataTarget, args.overwrite)
      if (imageResult === 'downloaded' || dataResult === 'downloaded') {
        downloaded += 1
      } else {
        skipped += 1
      }
      console.log(`[sprites] Imported ${entry.id}`)
    } catch (error) {
      console.error(`[sprites] Failed importing ${entry.id}: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    }
  }

  if (args.dryRun) {
    console.log(`[sprites] Dry run complete for ${candidates.length} entries.`)
    return
  }

  console.log(`[sprites] Import complete. downloaded=${downloaded} skipped=${skipped}`)
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode)
  }
}

main().catch((error) => {
  console.error(`[sprites] Import failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
