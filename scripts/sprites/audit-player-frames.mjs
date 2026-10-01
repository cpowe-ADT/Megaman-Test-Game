import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { decodePng } from '../../src/assets/pngDecode.ts'
import { auditAtlasFrames } from '../../src/assets/playerFrameAudit.ts'

function parseArgs(argv) {
  const args = {
    atlasJson: 'assets/sprites/player/main/player_main.atlas.json',
    atlasImage: 'assets/sprites/player/main/player_main.png',
    prefix: 'player_main/'
  }
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--atlas-json' && next) {
      args.atlasJson = next
      i += 1
      continue
    }
    if (arg === '--atlas-image' && next) {
      args.atlasImage = next
      i += 1
    }
  }
  return args
}

function main() {
  const args = parseArgs(process.argv)
  const jsonPath = path.resolve(process.cwd(), args.atlasJson)
  const imagePath = path.resolve(process.cwd(), args.atlasImage)

  if (!fs.existsSync(jsonPath) || !fs.existsSync(imagePath)) {
    console.error(`[sprites] Player frame audit failed: missing ${jsonPath} or ${imagePath}`)
    process.exit(1)
  }

  const atlasData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const decoded = decodePng(fs.readFileSync(imagePath))

  const frames = {}
  Object.entries(atlasData.frames ?? {}).forEach(([name, entry]) => {
    if (name.startsWith(args.prefix)) {
      frames[name] = entry.frame
    }
  })

  const issues = auditAtlasFrames(decoded, frames)
  if (issues.length > 0) {
    console.error(`[sprites] Player frame audit failed (${issues.length} of ${Object.keys(frames).length} frames):`)
    issues.forEach(({ frame, reason }) => console.error(`  - ${frame}: ${reason}`))
    process.exit(1)
  }

  console.log(`[sprites] Player frame audit passed (${Object.keys(frames).length} frames checked in ${path.relative(process.cwd(), imagePath)})`)
}

main()
