import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'assets')
const distIndexPath = path.join(root, 'dist', 'index.html')
const distRoot = path.join(root, 'dist', 'assets')
const excludedRuntimeRoots = [
  path.join(sourceRoot, 'sprites', 'source'),
  // The developer-only skin was retired in 05c (5.5): nothing under assets/private is a runtime asset.
  path.join(sourceRoot, 'private')
]

// v1.0 bundle budget (prompt 08 8.5, prompt 04 4.4): the emitted JS/CSS chunk total recorded in
// docs/adr/0002-bundle-size-strategy.md at the part-12i commit (index-*.js + phaser-*.js, 1,898,134
// bytes). This fails only past 15% over that, not on every byte of drift; lower it with a new ADR
// row when a slice earns it (charter rule 14), never raise it without one.
const BUNDLE_BUDGET_BYTES = 1898134
const BUNDLE_BUDGET_TOLERANCE = 1.15

function isInside(parent, candidate) {
  const relativePath = path.relative(parent, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function shouldSkip(candidate) {
  const basename = path.basename(candidate)
  if (basename === '.DS_Store') {
    return true
  }
  // Any `source` folder under assets holds generator sheets, not runtime files (see vite.config.ts).
  if (basename === 'source' && fs.statSync(candidate).isDirectory()) {
    return true
  }
  return excludedRuntimeRoots.some((excludedRoot) => isInside(excludedRoot, candidate))
}

function findSourceDirs(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    return entry.name === 'source' ? [fullPath] : findSourceDirs(fullPath)
  })
}

function collectRuntimeFiles(dir) {
  if (!fs.existsSync(dir)) {
    return []
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (shouldSkip(fullPath)) {
      continue
    }
    if (entry.isDirectory()) {
      files.push(...collectRuntimeFiles(fullPath))
      continue
    }
    if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

if (!fs.existsSync(distRoot)) {
  console.error(`Missing dist runtime asset directory: ${path.relative(root, distRoot)}`)
  process.exit(1)
}

if (!fs.existsSync(distIndexPath)) {
  console.error(`Missing production index: ${path.relative(root, distIndexPath)}`)
  process.exit(1)
}

if (fs.existsSync(path.join(distRoot, 'private'))) {
  console.error('dist/assets/private exists: the retired developer skin must never ship')
  process.exit(1)
}

const shippedSources = findSourceDirs(distRoot)
if (shippedSources.length > 0) {
  console.error(`Generator source folders shipped in dist: ${shippedSources.map((dir) => path.relative(root, dir)).join(', ')}`)
  process.exit(1)
}

const runtimeFiles = collectRuntimeFiles(sourceRoot)
const missing = runtimeFiles.filter((file) => {
  const relativePath = path.relative(sourceRoot, file)
  return !fs.existsSync(path.join(distRoot, relativePath))
})

if (missing.length > 0) {
  console.error('Missing runtime assets from dist:')
  missing.slice(0, 50).forEach((file) => {
    console.error(`- ${path.relative(root, file)}`)
  })
  if (missing.length > 50) {
    console.error(`...and ${missing.length - 50} more`)
  }
  process.exit(1)
}

const indexHtml = fs.readFileSync(distIndexPath, 'utf8')
const emittedAssetRefs = Array.from(indexHtml.matchAll(/(?:src|href)="\/?([^"]+\.(?:js|css))"/g), (match) => match[1])
const missingEmittedAssets = emittedAssetRefs.filter((assetRef) => !fs.existsSync(path.join(root, 'dist', assetRef)))

if (missingEmittedAssets.length > 0) {
  console.error('Missing emitted build assets referenced by dist/index.html:')
  missingEmittedAssets.forEach((assetRef) => {
    console.error(`- ${assetRef}`)
  })
  process.exit(1)
}

// Top-level dist/assets/*.js and *.css are Rollup's emitted chunks; the copied runtime folders
// (audio, backgrounds, fonts, sprites, ui) are subdirectories, so a non-recursive, extension-filtered
// read of distRoot cannot see into them.
const bundleFiles = fs
  .readdirSync(distRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(js|css)$/.test(entry.name))
const bundleTotalBytes = bundleFiles.reduce((total, entry) => total + fs.statSync(path.join(distRoot, entry.name)).size, 0)
const bundleBudgetCeiling = Math.round(BUNDLE_BUDGET_BYTES * BUNDLE_BUDGET_TOLERANCE)

if (bundleTotalBytes > bundleBudgetCeiling) {
  console.error(
    `Bundle total ${bundleTotalBytes} bytes is more than 15% over the ${BUNDLE_BUDGET_BYTES}-byte v1.0 budget (docs/adr/0002-bundle-size-strategy.md), ceiling ${bundleBudgetCeiling}: ${bundleFiles.map((entry) => entry.name).join(', ')}`
  )
  process.exit(1)
}

console.log(
  `Checked ${runtimeFiles.length} runtime asset files and ${emittedAssetRefs.length} emitted build refs in dist/. Bundle ${bundleTotalBytes} bytes (budget ${BUNDLE_BUDGET_BYTES}, ceiling ${bundleBudgetCeiling}).`
)
