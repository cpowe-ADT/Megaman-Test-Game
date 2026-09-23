import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'assets')
const distIndexPath = path.join(root, 'dist', 'index.html')
const distRoot = path.join(root, 'dist', 'assets')
const excludedRuntimeRoots = [
  path.join(sourceRoot, 'sprites', 'source'),
  path.join(sourceRoot, 'private', 'source')
]

function isInside(parent, candidate) {
  const relativePath = path.relative(parent, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function shouldSkip(candidate) {
  const basename = path.basename(candidate)
  if (basename === '.DS_Store') {
    return true
  }
  return excludedRuntimeRoots.some((excludedRoot) => isInside(excludedRoot, candidate))
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

console.log(
  `Checked ${runtimeFiles.length} runtime asset files and ${emittedAssetRefs.length} emitted build refs in dist/.`
)
