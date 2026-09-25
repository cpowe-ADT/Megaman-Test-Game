// Shared helpers for the audio scripts (sfx-synth, compose, master-music, check-credits): a seeded PRNG,
// a 16-bit PCM WAV writer, and ffmpeg wrappers for loudness, decoding and Vorbis encoding.
// One loudness target and one loop-seam rule live here so every script measures the same way.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Integrated loudness every music track is normalized to (ffmpeg loudnorm / EBU R128), and the allowed error. */
export const MUSIC_LOUDNESS_TARGET_LUFS = -16
export const MUSIC_LOUDNESS_TOLERANCE_LU = 1
/** Loudest true peak a music track may reach after normalization. */
export const MUSIC_TRUE_PEAK_MAX_DBTP = -1
/** Loop seam: RMS level of the last window against the first window of the file, in dB. */
export const LOOP_SEAM_WINDOW_MS = 250
export const LOOP_SEAM_MAX_DB = 3
/** Music files are 30 to 60 seconds (prompt 12h). */
export const MUSIC_MIN_SECONDS = 30
export const MUSIC_MAX_SECONDS = 60

/** mulberry32: a small deterministic PRNG; the same seed always gives the same sound. */
export function createRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true })
}

/** Writes mono float samples (-1..1) as 16-bit PCM WAV. */
export function writeWav(path, samples, sampleRate) {
  const bytes = Buffer.alloc(44 + samples.length * 2)
  bytes.write('RIFF', 0, 'ascii')
  bytes.writeUInt32LE(36 + samples.length * 2, 4)
  bytes.write('WAVE', 8, 'ascii')
  bytes.write('fmt ', 12, 'ascii')
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36, 'ascii')
  bytes.writeUInt32LE(samples.length * 2, 40)
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]))
    bytes.writeInt16LE(Math.round(value * 32767), 44 + index * 2)
  }
  ensureDir(path)
  writeFileSync(path, bytes)
}

function ffmpeg(args, input) {
  return execFileSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], {
    input,
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  })
}

/** Encodes mono float samples straight to Ogg Vorbis (VBR quality `quality`, -1..10), with an optional gain. */
export function encodeOgg(path, samples, sampleRate, { quality = 2, gainDb = 0, outRate = sampleRate } = {}) {
  ensureDir(path)
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  const filters = gainDb === 0 ? [] : ['-af', `volume=${gainDb.toFixed(3)}dB`]
  // bitexact: a fixed Ogg serial and no encoder version tag, so the same samples always give the same bytes.
  ffmpeg(
    ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(sampleRate), '-ac', '1', '-i', 'pipe:0', ...filters, '-ar', String(outRate), '-ac', '1', '-c:a', 'libvorbis', '-q:a', String(quality), '-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1', path],
    pcm
  )
}

/** Integrated loudness (LUFS), true peak (dBTP) and loudness range of a file or of raw mono float samples. */
export function measureLoudness(source, sampleRate) {
  const args = ['-nostats']
  let input
  if (typeof source === 'string') {
    args.push('-i', source)
  } else {
    args.push('-f', 'f32le', '-ar', String(sampleRate), '-ac', '1', '-i', 'pipe:0')
    input = Buffer.from(source.buffer, source.byteOffset, source.byteLength)
  }
  args.push('-af', `loudnorm=I=${MUSIC_LOUDNESS_TARGET_LUFS}:TP=${MUSIC_TRUE_PEAK_MAX_DBTP}:LRA=11:print_format=json`, '-f', 'null', '-')
  // loudnorm prints its measurement as JSON on stderr.
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { input, maxBuffer: 64 * 1024 * 1024 })
  const stderr = String(result.stderr ?? '')
  if (result.status !== 0 || !stderr.includes('input_i')) {
    throw new Error(`ffmpeg loudnorm failed for ${typeof source === 'string' ? source : 'samples'}: ${stderr.slice(-400)}`)
  }
  const json = JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1))
  return { integratedLufs: Number(json.input_i), truePeakDbtp: Number(json.input_tp), rangeLu: Number(json.input_lra) }
}

/** Decodes any audio file to mono float samples at `sampleRate` (what a browser AudioContext would hold, summed to mono). */
export function decodeMono(path, sampleRate = 48000) {
  const bytes = ffmpeg(['-v', 'error', '-i', path, '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', 'pipe:1'])
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

/** Channels, sample rate and duration of a file (ffprobe). */
export function probe(path) {
  const out = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=channels,sample_rate,codec_name:format=duration,size', '-of', 'json', path]).toString()
  )
  const stream = out.streams?.[0] ?? {}
  return { channels: Number(stream.channels), sampleRate: Number(stream.sample_rate), codec: stream.codec_name, seconds: Number(out.format?.duration), bytes: Number(out.format?.size) }
}

function rms(samples, from, to) {
  let sum = 0
  for (let index = from; index < to; index += 1) sum += samples[index] * samples[index]
  return Math.sqrt(sum / Math.max(1, to - from))
}

/**
 * The loop seam: how far the level jumps where the file wraps from its end to its start, as the RMS of the
 * last `LOOP_SEAM_WINDOW_MS` against the first, in dB (both floored at -60dBFS so silence meets silence at 0).
 */
export function loopSeamDb(samples, sampleRate, windowMs = LOOP_SEAM_WINDOW_MS) {
  const size = Math.min(Math.floor(samples.length / 2), Math.round((sampleRate * windowMs) / 1000))
  const floor = 10 ** (-60 / 20)
  const head = Math.max(floor, rms(samples, 0, size))
  const tail = Math.max(floor, rms(samples, samples.length - size, samples.length))
  return Math.abs(20 * Math.log10(tail / head))
}

export function peakDb(samples) {
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) peak = Math.max(peak, Math.abs(samples[index]))
  return 20 * Math.log10(Math.max(peak, 1e-9))
}

/** Scales samples in place so the loudest one sits at `targetDb` dBFS. */
export function normalizePeak(samples, targetDb) {
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) peak = Math.max(peak, Math.abs(samples[index]))
  if (peak <= 0) return samples
  const scale = 10 ** (targetDb / 20) / peak
  for (let index = 0; index < samples.length; index += 1) samples[index] *= scale
  return samples
}

export function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/** Applies `gainDb`, then a soft knee (default from -6dBFS) that approaches, never reaches, the ceiling. Returns a copy. */
export function master(samples, gainDb, { kneeDb = -6, ceilingDb = -3 } = {}) {
  const gain = 10 ** (gainDb / 20)
  const knee = 10 ** (kneeDb / 20)
  const ceiling = 10 ** (ceilingDb / 20)
  const out = new Float32Array(samples.length)
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] * gain
    const size = Math.abs(value)
    out[index] = size <= knee ? value : Math.sign(value) * (knee + (ceiling - knee) * Math.tanh((size - knee) / (ceiling - knee)))
  }
  return out
}
