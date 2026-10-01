import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PIXEL_FONT, PIXEL_FONT_FAMILY, pixelFont, pixelFontSize, pixelScaleFor } from '../src/ui/pixelFont'

const root = fileURLToPath(new URL('..', import.meta.url))
const table = fs.readFileSync(path.join(root, 'assets/fonts/source/omega-pixel.glyphs.txt'), 'utf8')
const tableChars = new Set(
  [...table.matchAll(/^U\+([0-9A-F]{4,6})\b/gm)].map((match) => String.fromCodePoint(parseInt(match[1]!, 16)))
)

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith('.ts') ? [full] : []
  })
}

test('12i pixel font: the glyph table covers ASCII and every symbol a UI string literal prints', () => {
  for (let code = 32; code <= 126; code += 1) assert.ok(tableChars.has(String.fromCharCode(code)), `missing ${String.fromCharCode(code)}`)
  assert.ok(tableChars.has('É'), "Phaser's metrics string |MÉqgy must measure with the font, not a fallback")
  // Developer-only overlays keep the system monospace (docs/architecture/rendering.md).
  const devOnly = new Set(['DebugOverlay.ts', 'DevUx.ts'])
  const files = ['src/scenes', 'src/ui', 'src/content', 'src/progression'].flatMap((dir) => sourceFiles(path.join(root, dir)))
  const missing = new Map<string, string>()
  for (const file of files.filter((file) => !devOnly.has(path.basename(file)))) {
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const literal of text.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? []) {
      for (const ch of literal) if (ch.codePointAt(0)! > 126 && !tableChars.has(ch)) missing.set(ch, path.relative(root, file))
    }
  }
  assert.deepEqual([...missing], [], 'add these characters to assets/fonts/source/omega-pixel.glyphs.txt and rebuild')
})

test('12i pixel font: the BMFont lists the table glyphs at size 8, one texel per font pixel', () => {
  const xml = fs.readFileSync(path.join(root, 'assets/fonts/omega-pixel.xml'), 'utf8')
  assert.match(xml, /<info face="OmegaPixel" size="8"\/>/)
  assert.match(xml, /<common lineHeight="8" base="6"/)
  const chars = [...xml.matchAll(/<char id="(\d+)" [^>]*width="(\d+)" height="8" [^>]*xadvance="(\d+)"/g)]
  assert.deepEqual(new Set(chars.map((match) => String.fromCodePoint(Number(match[1])))), tableChars)
  chars.forEach((match) => assert.equal(Number(match[3]), Number(match[2]) + 1, `char ${match[1]} advances its width plus one`))
  const woff = fs.readFileSync(path.join(root, 'assets/fonts/omega-pixel.woff'))
  assert.equal(woff.subarray(0, 4).toString('latin1'), 'wOFF')
  assert.ok(woff.length < 4096 && fs.statSync(path.join(root, 'assets/fonts/omega-pixel.png')).size < 1024, 'the font stays small (boot budget)')
})

test('12i pixel font: sizes are whole multiples of the 8px em, and the shorthand is one size and one family', () => {
  assert.equal(PIXEL_FONT_FAMILY, 'OmegaPixel')
  assert.equal(PIXEL_FONT, 'OmegaPixel, monospace')
  assert.deepEqual([pixelFontSize(1), pixelFontSize(2), pixelFontSize(3), pixelFontSize(4)], ['8px', '16px', '24px', '32px'])
  assert.equal(pixelFont(2), '16px OmegaPixel')
  assert.deepEqual([7, 8, 12, 13, 16, 19, 20, 22, 30].map(pixelScaleFor), [1, 1, 1, 2, 2, 2, 3, 3, 4])
})
