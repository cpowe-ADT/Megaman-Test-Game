import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { validateSpriteManifest } from '../../src/assets/validateManifest.ts'
import {
  REQUIRED_BOSS_IDS,
  REQUIRED_ENEMY_TYPE_KEYS,
  REQUIRED_MANIFEST_ENTRY_IDS,
  REQUIRED_MANIFEST_PREFIX_GROUPS,
  buildSpriteCoverageReport
} from '../../src/assets/coverageRequirements.ts'

function parseArgs(argv) {
  const args = {
    manifest: 'assets/sprites/manifest.v1.json',
    sourceRoot: 'assets/sprites/source',
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
    if (arg === '--source-root' && next) {
      args.sourceRoot = next
      i += 1
      continue
    }
    if (arg === '--json') {
      args.json = true
    }
  }

  return args
}

function readDirFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return []
  }
  return fs.readdirSync(dirPath).filter((file) => file.endsWith('.png'))
}

function main() {
  const args = parseArgs(process.argv)
  const manifestPath = path.resolve(process.cwd(), args.manifest)
  const sourceRoot = path.resolve(process.cwd(), args.sourceRoot)
  const enemySourceDir = path.join(sourceRoot, 'enemies')
  const bossSourceDir = path.join(sourceRoot, 'bosses')

  if (!fs.existsSync(manifestPath)) {
    console.error(`[sprites] Coverage check failed: manifest not found at ${manifestPath}`)
    process.exit(1)
  }

  let manifestRaw
  try {
    manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.error(`[sprites] Coverage check failed: invalid manifest JSON (${String(error)})`)
    process.exit(1)
  }

  const manifestValidation = validateSpriteManifest(manifestRaw)
  if (!manifestValidation.valid) {
    console.error('[sprites] Coverage check aborted: manifest is invalid.')
    manifestValidation.errors.forEach((entry) => console.error(`  - ${entry}`))
    process.exit(1)
  }

  const enemySourceFiles = readDirFiles(enemySourceDir)
  const bossSourceFiles = readDirFiles(bossSourceDir)
  const report = buildSpriteCoverageReport(manifestValidation.manifest, enemySourceFiles, bossSourceFiles)

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          valid: report.valid,
          required: {
            manifestEntryCount: REQUIRED_MANIFEST_ENTRY_IDS.length,
            enemySourceCount: REQUIRED_ENEMY_TYPE_KEYS.length,
            bossSourceCount: REQUIRED_BOSS_IDS.length,
            prefixGroups: REQUIRED_MANIFEST_PREFIX_GROUPS
          },
          report
        },
        null,
        2
      )
    )
  } else if (report.valid) {
    console.log(
      `[sprites] Coverage valid (${REQUIRED_MANIFEST_ENTRY_IDS.length} required manifest entries, ` +
        `${REQUIRED_ENEMY_TYPE_KEYS.length} enemy source sheets, ${REQUIRED_BOSS_IDS.length} boss source sheets)`
    )
  } else {
    console.error('[sprites] Coverage check failed:')
    if (report.missingManifestIds.length > 0) {
      console.error(`  - Missing manifest entries: ${report.missingManifestIds.join(', ')}`)
    }
    if (report.nonReadyManifestIds.length > 0) {
      console.error(`  - Required entries not ready: ${report.nonReadyManifestIds.join(', ')}`)
    }
    if (report.missingRuntimePaths.length > 0) {
      console.error(`  - Required ready entries missing runtime paths: ${report.missingRuntimePaths.join(', ')}`)
    }
    if (report.missingPrefixGroups.length > 0) {
      console.error(`  - Missing manifest groups: ${report.missingPrefixGroups.join(', ')}`)
    }
    if (report.missingEnemySourceSheets.length > 0) {
      console.error(`  - Missing enemy source sheets: ${report.missingEnemySourceSheets.join(', ')}`)
    }
    if (report.missingBossSourceSheets.length > 0) {
      console.error(`  - Missing boss source sheets: ${report.missingBossSourceSheets.join(', ')}`)
    }
    process.exit(1)
  }
}

main()
