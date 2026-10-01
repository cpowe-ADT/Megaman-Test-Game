import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodePng } from '../src/assets/pngDecode'

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/png-decode/sample_rgba8.png', import.meta.url))

function pixelAt(decoded: ReturnType<typeof decodePng>, x: number, y: number): [number, number, number, number] {
  const stride = decoded.width * 4
  const offset = y * stride + x * 4
  return [decoded.pixels[offset], decoded.pixels[offset + 1], decoded.pixels[offset + 2], decoded.pixels[offset + 3]]
}

test('decodePng reads a 4x3 RGBA8 PNG written by PIL back to the exact pixels', () => {
  const buffer = fs.readFileSync(FIXTURE_PATH)
  const decoded = decodePng(buffer)

  assert.equal(decoded.width, 4)
  assert.equal(decoded.height, 3)
  assert.equal(decoded.pixels.length, 4 * 3 * 4)

  assert.deepEqual(pixelAt(decoded, 0, 0), [10, 20, 30, 0])
  assert.deepEqual(pixelAt(decoded, 1, 0), [255, 0, 0, 255])
  assert.deepEqual(pixelAt(decoded, 2, 0), [0, 255, 0, 128])
  assert.deepEqual(pixelAt(decoded, 3, 0), [0, 0, 255, 64])
  assert.deepEqual(pixelAt(decoded, 0, 1), [255, 255, 0, 255])
  assert.deepEqual(pixelAt(decoded, 3, 1), [128, 128, 128, 255])
  assert.deepEqual(pixelAt(decoded, 0, 2), [1, 2, 3, 4])
  assert.deepEqual(pixelAt(decoded, 2, 2), [0, 0, 0, 0])
  assert.deepEqual(pixelAt(decoded, 3, 2), [255, 255, 255, 255])
})

test('decodePng rejects a buffer without a PNG signature', () => {
  assert.throws(() => decodePng(Buffer.from('not a png')), /signature/i)
})

test('decodePng rejects an indexed-color IHDR (unsupported color type)', () => {
  const buffer = fs.readFileSync(FIXTURE_PATH)
  const tampered = Buffer.from(buffer)
  // IHDR color type byte sits right after the signature (8) + length(4) + "IHDR"(4) + width(4) + height(4) + bitDepth(1).
  const colorTypeOffset = 8 + 4 + 4 + 4 + 4 + 1
  tampered[colorTypeOffset] = 3 // palette-indexed, not RGBA truecolor+alpha
  assert.throws(() => decodePng(tampered), /color type/i)
})
