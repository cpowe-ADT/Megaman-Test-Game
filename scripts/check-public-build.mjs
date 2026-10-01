// Prompt 08 8.5 (implements prompt 04 4.4 verbatim, adjusted: 05 deleted `assets/private`, so this
// asserts no private path exists rather than stripping one). Run after `npm run build:public` against
// its `dist/`. Four checks:
//   1. `dist/assets/private` does not exist (the retired developer skin must never ship).
//   2. No emitted `.js`/`.css` bundle matches the identity regex from prompt 01 (word-boundary safe,
//      so `OMEGA CORE` stays legal).
//   3. Every atlas `assets/sprites/manifest.v1.json` names is present under `dist/`.
//   4. `mechanics_lab` is unreachable: not a key of `CAMPAIGN_STAGES`, the map stage select, saves and
//      the campaign read (confirmed by importing the actual module, not by re-deriving its rules here).
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const distRoot = path.join(root, 'dist')
const distAssetsRoot = path.join(distRoot, 'assets')
const failures = []

function fail(message) {
  failures.push(message)
}

// Check 1: the retired developer skin.
function checkNoPrivatePath() {
  const privatePath = path.join(distAssetsRoot, 'private')
  if (fs.existsSync(privatePath)) {
    fail(`dist/assets/private exists: the retired developer skin must never ship (${privatePath})`)
  }
}

// Check 2: the identity regex (prompt 01 1.2), scanned over every emitted .js/.css bundle's text.
const IDENTITY_REGEX = /\b(MEGA MAN|MEGA CORE|ROBOT MASTER|Robot Master|Mega Man|Capcom)\b/
function collectBundleFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectBundleFiles(fullPath)
    return /\.(js|css)$/.test(entry.name) ? [fullPath] : []
  })
}
function checkIdentityRegex() {
  const bundles = collectBundleFiles(distRoot)
  if (bundles.length === 0) {
    fail('No .js/.css bundle found under dist/ to scan for the identity regex')
    return
  }
  bundles.forEach((file) => {
    const text = fs.readFileSync(file, 'utf8')
    const match = text.match(IDENTITY_REGEX)
    if (match) {
      fail(`${path.relative(root, file)} matches the identity regex: "${match[0]}"`)
    }
  })
}

// Check 3: every atlas the sprite manifest names.
function checkManifestAtlasesPresent() {
  const manifestPath = path.join(root, 'assets', 'sprites', 'manifest.v1.json')
  if (!fs.existsSync(manifestPath)) {
    fail(`Sprite manifest missing: ${path.relative(root, manifestPath)}`)
    return
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const runtimePaths = new Set()
  for (const entry of manifest.entries ?? []) {
    if (entry.source?.runtimeImage) runtimePaths.add(entry.source.runtimeImage)
    if (entry.source?.runtimeData) runtimePaths.add(entry.source.runtimeData)
  }
  if (runtimePaths.size === 0) {
    fail('Sprite manifest named no runtime atlas paths to check')
    return
  }
  const missing = [...runtimePaths].filter((runtimePath) => !fs.existsSync(path.join(distRoot, runtimePath.replace(/^\//, ''))))
  if (missing.length > 0) {
    fail(`Manifest atlases missing from dist/: ${missing.join(', ')}`)
  }
}

// Check 4: mechanics_lab is excluded from the map that drives stage select, saves and the campaign.
async function checkMechanicsLabUnreachable() {
  await import(new URL('../tools/register-ts-loader.mjs', import.meta.url))
  const campaign = await import(new URL('../src/content/campaign.ts', import.meta.url))
  const { CAMPAIGN_STAGES, MECHANICS_LAB_STAGE_ID } = campaign
  if (!MECHANICS_LAB_STAGE_ID || typeof MECHANICS_LAB_STAGE_ID !== 'string') {
    fail('MECHANICS_LAB_STAGE_ID is missing from src/content/campaign.ts: cannot confirm it is excluded')
    return
  }
  if (Object.prototype.hasOwnProperty.call(CAMPAIGN_STAGES, MECHANICS_LAB_STAGE_ID)) {
    fail(`mechanics_lab is reachable: "${MECHANICS_LAB_STAGE_ID}" is a key of CAMPAIGN_STAGES`)
  }
}

async function main() {
  if (!fs.existsSync(distRoot)) {
    console.error(`Missing dist/: run npm run build:public first (${distRoot})`)
    process.exit(1)
  }
  checkNoPrivatePath()
  checkIdentityRegex()
  checkManifestAtlasesPresent()
  await checkMechanicsLabUnreachable()

  if (failures.length > 0) {
    console.error(`check-public-build: ${failures.length} failure(s)`)
    failures.forEach((message) => console.error(`- ${message}`))
    process.exit(1)
  }

  console.log('check-public-build: no private path, no identity-regex bundle match, every manifest atlas present, mechanics_lab unreachable.')
}

main()
