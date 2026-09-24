// A small pure PNG reader for the one shape our sprite pipeline writes: RGBA8, non-interlaced.
// No Phaser, no canvas: this runs the same in a CLI script and in a unit test.
import { inflateSync } from 'node:zlib'

export type DecodedPng = {
  width: number
  height: number
  // RGBA8, row-major, 4 bytes per pixel, no padding.
  pixels: Uint8Array
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const RGBA_COLOR_TYPE = 6
const SUPPORTED_BIT_DEPTH = 8
const BYTES_PER_PIXEL = 4

type Chunk = { type: string; data: Buffer }

function readChunks(buffer: Buffer): Chunk[] {
  const chunks: Chunk[] = []
  let offset = SIGNATURE.length
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    chunks.push({ type, data })
    offset += 12 + length // length + type + data + crc
  }
  return chunks
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

// Reverses the five PNG scanline filters (spec section 9.3) in place over the raw (unfiltered) buffer.
function unfilter(raw: Buffer, width: number, height: number, bytesPerPixel: number): Uint8Array {
  const stride = width * bytesPerPixel
  const out = new Uint8Array(height * stride)
  let rawOffset = 0
  for (let y = 0; y < height; y += 1) {
    const filterType = raw[rawOffset]
    rawOffset += 1
    const rowStart = y * stride
    const prevRowStart = (y - 1) * stride
    for (let x = 0; x < stride; x += 1) {
      const raw8 = raw[rawOffset + x]
      const a = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel] : 0
      const b = y > 0 ? out[prevRowStart + x] : 0
      const c = y > 0 && x >= bytesPerPixel ? out[prevRowStart + x - bytesPerPixel] : 0
      let value: number
      switch (filterType) {
        case 0:
          value = raw8
          break
        case 1:
          value = raw8 + a
          break
        case 2:
          value = raw8 + b
          break
        case 3:
          value = raw8 + Math.floor((a + b) / 2)
          break
        case 4:
          value = raw8 + paeth(a, b, c)
          break
        default:
          throw new Error(`[pngDecode] Unsupported PNG filter type ${filterType} on row ${y}`)
      }
      out[rowStart + x] = value & 0xff
    }
    rawOffset += stride
  }
  return out
}

export function decodePng(buffer: Buffer): DecodedPng {
  if (buffer.length < SIGNATURE.length || !buffer.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    throw new Error('[pngDecode] Not a PNG (bad signature)')
  }

  const chunks = readChunks(buffer)
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')
  if (!ihdr) {
    throw new Error('[pngDecode] Missing IHDR chunk')
  }

  const width = ihdr.data.readUInt32BE(0)
  const height = ihdr.data.readUInt32BE(4)
  const bitDepth = ihdr.data.readUInt8(8)
  const colorType = ihdr.data.readUInt8(9)
  const interlace = ihdr.data.readUInt8(12)

  if (bitDepth !== SUPPORTED_BIT_DEPTH) {
    throw new Error(`[pngDecode] Unsupported bit depth ${bitDepth} (only 8 is supported)`)
  }
  if (colorType !== RGBA_COLOR_TYPE) {
    throw new Error(`[pngDecode] Unsupported color type ${colorType} (only RGBA truecolor+alpha, 6, is supported)`)
  }
  if (interlace !== 0) {
    throw new Error('[pngDecode] Interlaced PNGs are not supported')
  }

  const idatChunks = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)
  const compressed = Buffer.concat(idatChunks)
  const raw = inflateSync(compressed)
  const pixels = unfilter(raw, width, height, BYTES_PER_PIXEL)

  return { width, height, pixels: pixels as Uint8Array }
}
