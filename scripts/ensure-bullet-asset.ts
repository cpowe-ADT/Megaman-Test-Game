import { existsSync } from 'fs'
import { relative, resolve } from 'path'

const candidates = [
  ['public', 'assets', 'bossBullet.png'],
  ['public', 'assets', 'boss', 'bossBullet.png'],
  ['public', 'assets', 'sprites', 'bossBullet.png'],
  ['public', 'textures', 'bossBullet.png'],
  ['assets', 'bossBullet.png'],
  ['src', 'assets', 'bossBullet.png']
]

const cwd = process.cwd()
const found = candidates
  .map((segments) => resolve(cwd, ...segments))
  .find((fullPath) => existsSync(fullPath))

if (found) {
  console.log(`[assets] bossBullet texture found at ${relative(cwd, found)}`)
  process.exit(0)
} else {
  console.warn('[assets] WARNING bossBullet texture not located. Using probe placeholder fallback (1×1 px).')
  console.warn('[assets] Ensure production sprite atlases register the "bossBullet" texture key.')
  process.exit(0)
}
