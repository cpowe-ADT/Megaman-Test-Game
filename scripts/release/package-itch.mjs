// Prompt 08 8.5 / prompt 04 4.4: `npm run package:itch` zips the already-built `dist/` for a manual
// itch.io upload, with `index.html` at the zip root (itch's HTML5 embed looks for it there, not one
// folder down). Craig uploads the zip himself; this script never touches the network.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const distRoot = path.join(root, 'dist')
const releaseDir = path.join(root, 'output', 'release')

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  return pkg.version
}

function main() {
  if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
    console.error(`Missing dist/index.html: run npm run build (or build:public) first (${distRoot})`)
    process.exit(1)
  }

  const version = readVersion()
  fs.mkdirSync(releaseDir, { recursive: true })
  const zipPath = path.join(releaseDir, `omega-relay-${version}.zip`)
  // `zip` updates an existing archive instead of replacing it; start clean so a removed dist/ file
  // cannot linger in the zip from a previous run.
  fs.rmSync(zipPath, { force: true })

  // Run from inside dist/ so the archive's entries are relative to it (index.html at the zip root),
  // not nested under a "dist/" folder.
  execFileSync('zip', ['-rq', zipPath, '.', '-x', '.DS_Store'], { cwd: distRoot, stdio: 'inherit' })

  const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' })
  console.log(`package:itch: wrote ${path.relative(root, zipPath)}`)
  console.log(listing)
}

main()
