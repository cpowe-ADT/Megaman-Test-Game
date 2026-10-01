#!/usr/bin/env node
// Masters the three CC0 music tracks (the fallback cues) from their untouched originals in
// assets/audio/music/source/ (never shipped: vite skips `source` folders) to the runtime paths:
// summed to mono (decoded music is PCM at the AudioContext rate, so mono halves the memory the
// footprint budget counts), normalized to the one loudness target with the soft knee compose.mjs
// uses, and re-encoded as Ogg Vorbis. Lengths are kept to the sample, so each loop point is the
// author's. Measurements print per track; check-credits.mjs re-measures the results.
//
//   node scripts/audio/master-music.mjs
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MUSIC_LOUDNESS_TARGET_LUFS, decodeMono, encodeOgg, loopSeamDb, master, measureLoudness, probe, round } from './audio-lib.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')

/** Runtime file, its original, the output rate and Vorbis quality (the Title track keeps the most detail), and an optional knee. */
export const CC0_MASTERS = [
  { file: 'assets/audio/music/stage_select.ogg', original: 'assets/audio/music/source/stage_select.ogg', rate: 44100, quality: 2 },
  { file: 'assets/audio/music/stage_loop.ogg', original: 'assets/audio/music/source/stage_loop.ogg', rate: 32000, quality: 0 },
  { file: 'assets/audio/music/boss_loop.ogg', original: 'assets/audio/music/source/boss_loop.ogg', rate: 22050, quality: 0, kneeDb: -8, ceilingDb: -4.5 }
]

function levelProfile(samples, sampleRate, fromSeconds, toSeconds, stepMs = 50) {
  const values = []
  const step = Math.round((sampleRate * stepMs) / 1000)
  for (let start = Math.max(0, Math.round(fromSeconds * sampleRate)); start + step <= Math.min(samples.length, Math.round(toSeconds * sampleRate)); start += step) {
    let sum = 0
    for (let index = start; index < start + step; index += 1) sum += samples[index] * samples[index]
    values.push(Math.round(20 * Math.log10(Math.sqrt(sum / step) + 1e-9)))
  }
  return values.join(' ')
}

function main() {
  for (const track of CC0_MASTERS) {
    const samples = decodeMono(resolve(ROOT, track.original), track.rate)
    let gainDb = MUSIC_LOUDNESS_TARGET_LUFS - measureLoudness(samples, track.rate).integratedLufs
    let final
    for (let pass = 0; pass < 2; pass += 1) {
      encodeOgg(resolve(ROOT, track.file), master(samples, gainDb, track), track.rate, { quality: track.quality })
      final = measureLoudness(resolve(ROOT, track.file))
      if (Math.abs(final.integratedLufs - MUSIC_LOUDNESS_TARGET_LUFS) < 0.3) break
      gainDb += MUSIC_LOUDNESS_TARGET_LUFS - final.integratedLufs
    }
    const decoded = decodeMono(resolve(ROOT, track.file), track.rate)
    const seconds = decoded.length / track.rate
    const info = probe(resolve(ROOT, track.file))
    console.log(
      `${track.file.padEnd(38)} ${round(seconds, 3)}s ${final.integratedLufs} LUFS TP ${final.truePeakDbtp} seam250 ${round(loopSeamDb(decoded, track.rate), 2)}dB seam50 ${round(loopSeamDb(decoded, track.rate, 50), 2)}dB ${round(info.bytes / 1024, 1)}KB gain ${round(gainDb, 2)}dB samples ${decoded.length === samples.length ? 'kept' : `${samples.length} -> ${decoded.length}`}`
    )
    console.log(`  last 1s (50ms RMS dBFS): ${levelProfile(decoded, track.rate, seconds - 1, seconds)}`)
    console.log(`  first 0.5s:              ${levelProfile(decoded, track.rate, 0, 0.5)}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
