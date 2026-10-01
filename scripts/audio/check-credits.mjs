#!/usr/bin/env node
// Audio credits and quality gate (prompt 04 EVAL-P4-002, prompt 08 8.1, part 12h).
//  1. Every .ogg/.wav under assets/audio is named in assets/audio/credits/README.md, and every audio
//     path the credits name exists on disk.
//  2. Every runtime music file (assets/audio/music, not source/) meets the one loudness target
//     (ffmpeg loudnorm, within the tolerance), the true-peak ceiling and the loop-seam limit;
//     generated tracks also last 30 to 60 seconds.
//  3. Every sound in assets/audio/sfx/generated/sfx-params.json has its rendered file.
// Writes output/audio/check-credits.md and prints one result line; exits 1 on any failure.
//
//   node scripts/audio/check-credits.mjs          (npm run audio:check)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  LOOP_SEAM_MAX_DB,
  MUSIC_LOUDNESS_TARGET_LUFS,
  MUSIC_LOUDNESS_TOLERANCE_LU,
  MUSIC_MAX_SECONDS,
  MUSIC_MIN_SECONDS,
  MUSIC_TRUE_PEAK_MAX_DBTP,
  decodeMono,
  loopSeamDb,
  measureLoudness,
  round
} from './audio-lib.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const CREDITS = 'assets/audio/credits/README.md'
const REPORT = 'output/audio/check-credits.md'

/**
 * Music files allowed past the seam limit, each with the condition that retires it. Keep this list
 * short and loud: every entry prints on every run.
 */
export const SEAM_WAIVERS = {
  'assets/audio/music/stage_loop.ogg':
    "the CC0 fallback for the 'stage' cue ends on a decaying tail before its downbeat (the author's loop point); it stops playing once Game.ts passes stage ids to AudioService.playMusic, then this file and its waiver go"
}

function audioFiles(dir) {
  const found = []
  for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...audioFiles(path))
    else if (/\.(ogg|wav)$/i.test(entry.name)) found.push(path.split('\\').join('/'))
  }
  return found.sort()
}

export function creditedPaths(markdown) {
  return [...new Set([...markdown.matchAll(/`(assets\/audio\/[^`]+\.(?:ogg|wav))`/gi)].map((match) => match[1]))].sort()
}

function main() {
  const failures = []
  const lines = []
  const credits = readFileSync(resolve(ROOT, CREDITS), 'utf8')
  const credited = creditedPaths(credits)
  const onDisk = audioFiles('assets/audio')
  for (const path of onDisk) if (!credited.includes(path)) failures.push(`${path}: on disk but not in ${CREDITS}`)
  for (const path of credited) if (!existsSync(resolve(ROOT, path))) failures.push(`${path}: credited but missing on disk`)

  const params = JSON.parse(readFileSync(resolve(ROOT, 'assets/audio/sfx/generated/sfx-params.json'), 'utf8'))
  for (const [name, entry] of Object.entries(params.sounds)) {
    if (!existsSync(resolve(ROOT, entry.file))) failures.push(`${entry.file}: sfx-params '${name}' has no rendered file (node scripts/audio/sfx-synth.mjs ${name})`)
  }

  lines.push('| Music file | Seconds | Loudness LUFS | True peak dBTP | Seam dB (250ms) | Result |', '| --- | ---: | ---: | ---: | ---: | --- |')
  const music = onDisk.filter((path) => path.startsWith('assets/audio/music/') && !path.includes('/source/'))
  let waived = 0
  for (const path of music) {
    const problems = []
    const loud = measureLoudness(resolve(ROOT, path))
    const samples = decodeMono(resolve(ROOT, path), 48000)
    const seconds = samples.length / 48000
    const seam = loopSeamDb(samples, 48000)
    if (Math.abs(loud.integratedLufs - MUSIC_LOUDNESS_TARGET_LUFS) > MUSIC_LOUDNESS_TOLERANCE_LU) problems.push(`loudness ${loud.integratedLufs} LUFS is off the ${MUSIC_LOUDNESS_TARGET_LUFS}±${MUSIC_LOUDNESS_TOLERANCE_LU} target`)
    if (loud.truePeakDbtp > MUSIC_TRUE_PEAK_MAX_DBTP) problems.push(`true peak ${loud.truePeakDbtp} dBTP is over ${MUSIC_TRUE_PEAK_MAX_DBTP}`)
    const generated = path.includes('/generated/')
    if (generated && (seconds < MUSIC_MIN_SECONDS - 0.01 || seconds > MUSIC_MAX_SECONDS)) problems.push(`${round(seconds, 2)}s is outside ${MUSIC_MIN_SECONDS}-${MUSIC_MAX_SECONDS}s`)
    let result = 'PASS'
    if (seam > LOOP_SEAM_MAX_DB) {
      if (SEAM_WAIVERS[path]) {
        waived += 1
        result = `WAIVED seam: ${SEAM_WAIVERS[path]}`
        console.log(`WAIVED ${path}: seam ${round(seam, 2)}dB > ${LOOP_SEAM_MAX_DB}dB; ${SEAM_WAIVERS[path]}`)
      } else {
        problems.push(`loop seam ${round(seam, 2)}dB is over ${LOOP_SEAM_MAX_DB}dB`)
      }
    }
    if (problems.length) {
      result = `FAIL: ${problems.join('; ')}`
      failures.push(`${path}: ${problems.join('; ')}`)
    }
    lines.push(`| \`${path}\` | ${round(seconds, 2)} | ${loud.integratedLufs} | ${loud.truePeakDbtp} | ${round(seam, 2)} | ${result} |`)
  }

  const status = failures.length ? 'FAIL' : 'PASS'
  const summary = `audio:check ${status}: ${onDisk.length} audio files, ${credited.length} credited, ${music.length} music files at ${MUSIC_LOUDNESS_TARGET_LUFS}±${MUSIC_LOUDNESS_TOLERANCE_LU} LUFS, TP<=${MUSIC_TRUE_PEAK_MAX_DBTP}dBTP, seam<=${LOOP_SEAM_MAX_DB}dB, ${waived} waived, ${failures.length} failures`
  mkdirSync(resolve(ROOT, 'output/audio'), { recursive: true })
  writeFileSync(
    resolve(ROOT, REPORT),
    [`# Audio credits and quality check`, '', summary, '', ...lines, '', failures.length ? '## Failures' : '', ...failures.map((failure) => `- ${failure}`), ''].join('\n')
  )
  for (const failure of failures) console.error(`FAIL ${failure}`)
  console.log(`${summary} (report ${relative(ROOT, resolve(ROOT, REPORT))})`)
  if (failures.length) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
