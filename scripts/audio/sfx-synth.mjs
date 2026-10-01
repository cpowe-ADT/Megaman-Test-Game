#!/usr/bin/env node
// Procedural sound-effect synthesizer (sfxr-style). Every sound is a recorded parameter set in
// assets/audio/sfx/generated/sfx-params.json: one or more voices (square, saw, triangle, sine or noise)
// with a pitch slide, arpeggio, vibrato, duty sweep, tremolo, low/high-pass filters and an
// attack/sustain/punch/decay envelope. The seed drives the noise, so the same parameters always
// render the same file. Output is Ogg Vorbis or 16-bit WAV, peak-normalized.
//
//   node scripts/audio/sfx-synth.mjs            render every sound
//   node scripts/audio/sfx-synth.mjs dash jump  render the named sounds
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRng, encodeOgg, normalizePeak, peakDb, round, writeWav } from './audio-lib.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
export const SFX_PARAMS_PATH = 'assets/audio/sfx/generated/sfx-params.json'
const SUPERSAMPLE = 8
const TAU = Math.PI * 2

function voiceSeconds(voice) {
  return (voice.delay ?? 0) + (voice.attack ?? 0.002) + (voice.sustain ?? 0) + (voice.decay ?? 0.05)
}

function envelopeAt(voice, t) {
  const attack = Math.max(1e-4, voice.attack ?? 0.002)
  const sustain = voice.sustain ?? 0
  const decay = Math.max(1e-4, voice.decay ?? 0.05)
  if (t < attack) return t / attack
  if (t < attack + sustain) return 1 + (voice.punch ?? 0) * (1 - (t - attack) / Math.max(1e-4, sustain))
  const d = (t - attack - sustain) / decay
  return d >= 1 ? 0 : (1 - d) ** (voice.curve ?? 1.5)
}

function frequencyAt(voice, t) {
  const local = voice.repeat ? t % voice.repeat : t
  let freq = voice.freq * 2 ** ((voice.slide ?? 0) * local + 0.5 * (voice.slideAccel ?? 0) * local * local)
  for (const step of voice.arp ?? []) if (local >= step.at) freq *= step.ratio
  const vibrato = voice.vibrato
  if (vibrato && t >= (vibrato.delay ?? 0)) freq *= 2 ** ((vibrato.depth / 12) * Math.sin(TAU * vibrato.rate * t))
  return Math.min(voice.maxFreq ?? 20000, Math.max(voice.minFreq ?? 20, freq))
}

/** One voice rendered into `out` from its delay on; filters are one-pole (low-pass twice, for a 12dB slope). */
function renderVoice(voice, out, sampleRate, rng) {
  const start = Math.round((voice.delay ?? 0) * sampleRate)
  const length = Math.ceil((voiceSeconds(voice) - (voice.delay ?? 0)) * sampleRate)
  const subRate = sampleRate * SUPERSAMPLE
  let phase = 0
  let noise = rng() * 2 - 1
  let noisePhase = 0
  let low1 = 0
  let low2 = 0
  let highIn = 0
  let highOut = 0
  const gain = voice.gain ?? 1
  for (let index = 0; index < length && start + index < out.length; index += 1) {
    const t = index / sampleRate
    const freq = frequencyAt(voice, t)
    const duty = Math.min(0.95, Math.max(0.05, (voice.duty ?? 0.5) + (voice.dutySweep ?? 0) * t))
    let sum = 0
    for (let sub = 0; sub < SUPERSAMPLE; sub += 1) {
      phase += freq / subRate
      phase -= Math.floor(phase)
      let sample
      switch (voice.wave) {
        case 'square':
          sample = phase < duty ? 1 : -1
          break
        case 'saw':
          sample = 2 * phase - 1
          break
        case 'triangle':
          sample = 1 - 4 * Math.abs(phase - 0.5)
          break
        case 'sine':
          sample = Math.sin(TAU * phase)
          break
        case 'noise':
          noisePhase += freq / subRate
          if (noisePhase >= 1) {
            noisePhase -= Math.floor(noisePhase)
            noise = rng() * 2 - 1
          }
          sample = noise
          break
        default:
          throw new Error(`unknown wave '${voice.wave}'`)
      }
      sum += sample
    }
    let sample = sum / SUPERSAMPLE
    if (voice.lpf) {
      const cutoff = Math.min(sampleRate * 0.45, voice.lpf * 2 ** ((voice.lpfSlide ?? 0) * t))
      const alpha = 1 - Math.exp((-TAU * cutoff) / sampleRate)
      low1 += alpha * (sample - low1)
      low2 += alpha * (low1 - low2)
      sample = low2
    }
    if (voice.hpf) {
      const rc = 1 / (TAU * voice.hpf)
      const alpha = rc / (rc + 1 / sampleRate)
      highOut = alpha * (highOut + sample - highIn)
      highIn = sample
      sample = highOut
    }
    const am = voice.am ? 1 - voice.am.depth * 0.5 * (1 - Math.cos(TAU * voice.am.rate * t)) : 1
    out[start + index] += sample * envelopeAt(voice, t) * am * gain
  }
}

/** Renders one sound's parameter set to mono float samples. Pure: the same entry gives the same samples. */
export function renderSfx(entry) {
  const sampleRate = entry.rate ?? 44100
  const seconds = Math.max(...entry.voices.map(voiceSeconds))
  const out = new Float32Array(Math.ceil(seconds * sampleRate) + 1)
  const rng = createRng(entry.seed)
  for (const voice of entry.voices) renderVoice(voice, out, sampleRate, rng)
  normalizePeak(out, entry.peakDb ?? -1)
  // 3ms fade-out so no sound ends on a click.
  const fade = Math.min(out.length, Math.round(sampleRate * 0.003))
  for (let index = 0; index < fade; index += 1) out[out.length - 1 - index] *= index / fade
  return { samples: out, sampleRate }
}

export function loadSfxParams() {
  return JSON.parse(readFileSync(resolve(ROOT, SFX_PARAMS_PATH), 'utf8'))
}

function main() {
  const params = loadSfxParams()
  const only = process.argv.slice(2)
  const names = Object.keys(params.sounds).filter((name) => only.length === 0 || only.includes(name))
  for (const name of names) {
    const entry = params.sounds[name]
    const { samples, sampleRate } = renderSfx(entry)
    const path = resolve(ROOT, entry.file)
    if (entry.file.endsWith('.wav')) writeWav(path, samples, sampleRate)
    else encodeOgg(path, samples, sampleRate, { quality: params.oggQuality ?? 4 })
    console.log(`${name.padEnd(20)} ${entry.file}  ${round(samples.length / sampleRate, 3)}s  peak ${round(peakDb(samples), 1)}dBFS  seed ${entry.seed}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
