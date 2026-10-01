#!/usr/bin/env node
// Procedural chiptune composer (part 12h). Four NES-style channels: two pulse waves (lead and arpeggio,
// band-limited), a stepped triangle bass and an LFSR noise drum kit. Each stage and boss has a mood
// (key, mode, tempo, progressions, bass, drum and arpeggio styles) and a seed; the seed writes the
// melody (two-bar motifs on the chord tones), so the same mood and seed always give the same track.
// Notes are rendered into a circular buffer the exact length of the loop, so release tails wrap to
// the start and the loop has no seam. Each boss has a phase-two track: the same song with a driving
// layer (sixteenth hats, doubled lead, octave bass), crossfaded in at the phase change.
// Every file is normalized to one ffmpeg loudnorm target and written as mono Ogg Vorbis; the measured
// loudness, true peak and loop seam go to assets/audio/music/generated/music-manifest.json.
//
//   node scripts/audio/compose.mjs              every track
//   node scripts/audio/compose.mjs pyro_maw     tracks whose id contains the text
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  MUSIC_LOUDNESS_TARGET_LUFS,
  MUSIC_MAX_SECONDS,
  MUSIC_MIN_SECONDS,
  createRng,
  decodeMono,
  encodeOgg,
  loopSeamDb,
  master,
  measureLoudness,
  probe,
  round
} from './audio-lib.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
export const MUSIC_MANIFEST_PATH = 'assets/audio/music/generated/music-manifest.json'
const SAMPLE_RATE = 22050
const OGG_QUALITY = Number(process.env.COMPOSE_OGG_QUALITY ?? 0)
const TAU = Math.PI * 2

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11]
}

// Stage moods (by stage id) and boss moods (by boss id). root is the tonic as a MIDI note in octave 3.
// prog: scale degrees (0-based), one chord per bar, A section then B section.
export const STAGE_MOODS = {
  tutorial_sentinel: { seed: 1201, bpm: 138, root: 50, scale: 'mixolydian', progA: [0, 0, 6, 3, 0, 0, 6, 4], progB: [3, 3, 0, 0, 5, 6, 4, 4], bass: 'drive', drums: 'rock', arp: 'up8', lead: 0.25, feel: 'drill hangar, bright and upbeat' },
  pyro_maw: { seed: 1202, bpm: 152, root: 52, scale: 'phrygian', progA: [0, 0, 1, 0, 0, 0, 6, 1], progB: [5, 5, 3, 3, 1, 1, 6, 6], bass: 'gallop', drums: 'break', arp: 'up16', lead: 0.5, feel: 'smelter, driving phrygian heat' },
  tide_reaver: { seed: 1203, bpm: 126, root: 48, scale: 'dorian', progA: [0, 3, 0, 3, 0, 3, 6, 4], progB: [5, 3, 6, 0, 5, 3, 4, 4], bass: 'octave', drums: 'rock', arp: 'wave16', lead: 0.25, feel: 'reservoir, flowing dorian arpeggios' },
  volt_hopper: { seed: 1204, bpm: 168, root: 54, scale: 'aeolian', progA: [0, 5, 2, 6, 0, 5, 2, 6], progB: [3, 4, 0, 5, 3, 4, 6, 6], bass: 'drive', drums: 'four', arp: 'up16', lead: 0.125, feel: 'capacitor rooftops, fast and electric' },
  basalt_titan: { seed: 1205, bpm: 116, root: 45, scale: 'aeolian', progA: [0, 0, 5, 5, 3, 3, 4, 4], progB: [5, 5, 6, 6, 0, 0, 4, 4], bass: 'half', drums: 'half', arp: 'broken8', lead: 0.5, feel: 'quarry, heavy half-time' },
  ferro_blade: { seed: 1206, bpm: 150, root: 49, scale: 'harmonic', progA: [0, 0, 5, 4, 0, 0, 5, 4], progB: [3, 3, 0, 0, 5, 5, 4, 4], bass: 'gallop', drums: 'break', arp: 'broken16', lead: 0.25, feel: 'foundry, harmonic-minor duel' },
  mire_wraith: { seed: 1207, bpm: 108, root: 47, scale: 'phrygian', progA: [0, 1, 0, 1, 5, 6, 5, 1], progB: [3, 1, 3, 1, 6, 5, 1, 1], bass: 'walk', drums: 'shuffle', arp: 'wave8', lead: 0.125, feel: 'biohazard lab, uneasy and slow' },
  gale_vixen: { seed: 1208, bpm: 160, root: 53, scale: 'lydian', progA: [0, 1, 0, 1, 4, 3, 1, 1], progB: [5, 4, 3, 1, 5, 4, 1, 4], bass: 'octave', drums: 'four', arp: 'wave16', lead: 0.25, feel: 'skybridge, airy lydian lift' },
  glacier_ronin: { seed: 1209, bpm: 122, root: 50, scale: 'aeolian', progA: [0, 6, 5, 6, 0, 6, 3, 4], progB: [5, 6, 0, 0, 5, 3, 4, 4], bass: 'walk', drums: 'half', arp: 'up8', lead: 0.125, feel: 'frozen archive, sparse and cold' },
  omega_fortress: { seed: 1210, bpm: 144, root: 50, scale: 'harmonic', progA: [0, 0, 5, 5, 3, 3, 4, 4], progB: [0, 5, 3, 1, 0, 5, 4, 4], bass: 'drive', drums: 'break', arp: 'broken16', lead: 0.5, feel: 'central core, final march' }
}

export const BOSS_MOODS = {
  sentinel_rook: { seed: 1301, bpm: 150, root: 50, scale: 'aeolian', progA: [0, 0, 6, 6, 5, 5, 4, 4], progB: [3, 3, 4, 4, 5, 5, 4, 4], bass: 'drive', drums: 'rock', arp: 'up16', lead: 0.25, feel: 'gatekeeper duel' },
  pyro_maw: { seed: 1302, bpm: 164, root: 52, scale: 'phrygian', progA: [0, 1, 0, 1, 0, 1, 6, 1], progB: [5, 1, 5, 1, 3, 1, 6, 1], bass: 'gallop', drums: 'four', arp: 'up16', lead: 0.5, feel: 'infernal engine' },
  tide_reaver: { seed: 1303, bpm: 156, root: 48, scale: 'harmonic', progA: [0, 0, 5, 5, 3, 3, 4, 4], progB: [0, 3, 5, 4, 0, 3, 4, 4], bass: 'octave', drums: 'break', arp: 'wave16', lead: 0.25, feel: 'abyssal hunter' },
  volt_hopper: { seed: 1304, bpm: 176, root: 54, scale: 'aeolian', progA: [0, 6, 5, 6, 0, 6, 5, 4], progB: [3, 4, 5, 6, 3, 4, 4, 4], bass: 'drive', drums: 'four', arp: 'up16', lead: 0.125, feel: 'kinetic capacitor' },
  basalt_titan: { seed: 1305, bpm: 140, root: 45, scale: 'phrygian', progA: [0, 0, 1, 1, 0, 0, 6, 6], progB: [5, 5, 1, 1, 3, 3, 1, 1], bass: 'gallop', drums: 'half', arp: 'broken16', lead: 0.5, feel: 'seismic warden' },
  ferro_blade: { seed: 1306, bpm: 168, root: 49, scale: 'harmonic', progA: [0, 5, 3, 4, 0, 5, 3, 4], progB: [5, 5, 6, 6, 0, 0, 4, 4], bass: 'drive', drums: 'break', arp: 'broken16', lead: 0.25, feel: 'vector duelist' },
  mire_wraith: { seed: 1307, bpm: 146, root: 47, scale: 'harmonic', progA: [0, 1, 0, 1, 5, 4, 5, 4], progB: [3, 1, 3, 1, 5, 4, 4, 4], bass: 'walk', drums: 'shuffle', arp: 'wave16', lead: 0.125, feel: 'nebulous corruptor' },
  gale_vixen: { seed: 1308, bpm: 172, root: 53, scale: 'dorian', progA: [0, 3, 0, 3, 5, 4, 3, 4], progB: [6, 5, 3, 4, 6, 5, 4, 4], bass: 'octave', drums: 'four', arp: 'up16', lead: 0.25, feel: 'sonic saboteur' },
  glacier_ronin: { seed: 1309, bpm: 152, root: 50, scale: 'harmonic', progA: [0, 0, 3, 3, 5, 5, 4, 4], progB: [5, 3, 0, 4, 5, 3, 4, 4], bass: 'drive', drums: 'break', arp: 'wave16', lead: 0.5, feel: 'cryo swordmaster' },
  omega_core: { seed: 1310, bpm: 160, root: 50, scale: 'harmonic', progA: [0, 0, 5, 5, 1, 1, 4, 4], progB: [0, 6, 5, 4, 0, 6, 4, 4], bass: 'gallop', drums: 'break', arp: 'broken16', lead: 0.5, feel: 'central directive' }
}

const RHYTHMS = [
  [4, 4, 4, 4],
  [2, 2, 4, 2, 2, 4],
  [6, 2, 4, 4],
  [3, 3, 2, 4, 4],
  [4, 2, 2, 8],
  [2, 2, 2, 2, 4, 4],
  [8, 4, 4],
  [6, 6, 4],
  [4, 4, 8],
  [3, 3, 3, 3, 4]
]

const DRUMS = {
  rock: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  four: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  half: { kick: [0, 10], snare: [8], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  break: { kick: [0, 6, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14, 15] },
  shuffle: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 3, 4, 7, 8, 11, 12, 15] }
}

function scaleNote(mood, degree, octave = 0) {
  const scale = SCALES[mood.scale]
  const wrapped = ((degree % 7) + 7) % 7
  const octaves = Math.floor(degree / 7) + octave
  return mood.root + scale[wrapped] + 12 * octaves
}

function chordDegrees(root) {
  return [root, root + 2, root + 4]
}

const midiHz = (midi) => 440 * 2 ** ((midi - 69) / 12)

/** Bars in the loop: the fewest even number that lasts at least MUSIC_MIN_SECONDS (and at most MUSIC_MAX_SECONDS). */
function loopBars(bpm) {
  const barSeconds = (4 * 60) / bpm
  const bars = 2 * Math.ceil(MUSIC_MIN_SECONDS / (2 * barSeconds))
  if (bars * barSeconds > MUSIC_MAX_SECONDS) throw new Error(`${bpm} BPM cannot loop inside ${MUSIC_MAX_SECONDS}s`)
  return bars
}

/** The note list for one song: {voice, step, steps, midi, level}; steps are sixteenths from the loop start. */
export function composeSong(mood, { phaseTwo = false } = {}) {
  const rng = createRng(mood.seed)
  const bars = loopBars(mood.bpm)
  const progression = []
  for (let bar = 0; bar < bars; bar += 1) {
    const section = Math.floor(bar / 8) % 2 === 0 ? mood.progA : mood.progB
    progression.push(section[bar % 8])
  }
  const notes = []
  const add = (voice, step, steps, midi, level) => notes.push({ voice, step, steps, midi, level })

  // Melody: two-bar motifs, stated, varied, stated, then a cadence on the chord root.
  const motifs = []
  const makeMotif = () => {
    const first = RHYTHMS[Math.floor(rng() * RHYTHMS.length)]
    const second = RHYTHMS[Math.floor(rng() * RHYTHMS.length)]
    const moves = [...first, ...second].map(() => Math.floor(rng() * 5) - 2)
    const rests = [...first, ...second].map(() => rng() < 0.12)
    return { rhythm: [first, second], moves, rests }
  }
  for (let index = 0; index < 4; index += 1) motifs.push(makeMotif())
  const plan = [0, 1, 0, 2, 3, 1, 3, 2]
  let degree = 9
  for (let bar = 0; bar < bars; bar += 2) {
    const motif = motifs[plan[(bar / 2) % plan.length]]
    const cadence = bar % 8 === 6 || bar === bars - 2
    let moveIndex = 0
    for (let half = 0; half < 2; half += 1) {
      const chord = chordDegrees(progression[bar + half])
      let step = (bar + half) * 16
      const rhythm = cadence && half === 1 ? [8, 8] : motif.rhythm[half]
      rhythm.forEach((length, position) => {
        const strong = position === 0 || (step % 16) === 8
        if (strong) {
          const targets = chord.flatMap((tone) => [tone + 7, tone + 14])
          degree = targets.reduce((best, tone) => (Math.abs(tone - degree) < Math.abs(best - degree) ? tone : best), targets[0])
        } else {
          degree += motif.moves[moveIndex % motif.moves.length]
        }
        degree = Math.max(5, Math.min(16, degree))
        const rest = !strong && motif.rests[moveIndex % motif.rests.length]
        if (!rest) add('lead', step, length, scaleNote(mood, degree, 1), 1)
        if (!rest && phaseTwo) add('double', step, length, scaleNote(mood, degree, 2), 1)
        moveIndex += 1
        step += length
      })
    }
  }

  // Arpeggio on the chord tones.
  const arpRate = mood.arp.endsWith('16') ? 1 : 2
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = chordDegrees(progression[bar])
    const tones = [chord[0], chord[1], chord[2], chord[0] + 7]
    const pattern = mood.arp.startsWith('wave') ? [0, 1, 2, 3, 2, 1] : mood.arp.startsWith('broken') ? [0, 2, 1, 3] : [0, 1, 2, 3]
    const rate = phaseTwo ? 1 : arpRate
    for (let step = 0, index = 0; step < 16; step += rate, index += 1) {
      add('arp', bar * 16 + step, rate, scaleNote(mood, tones[pattern[index % pattern.length]], 1), step % 4 === 0 ? 1 : 0.75)
    }
  }

  // Bass on the chord root.
  for (let bar = 0; bar < bars; bar += 1) {
    const root = scaleNote(mood, progression[bar], -1)
    const fifth = scaleNote(mood, progression[bar] + 4, -1)
    const at = bar * 16
    const style = phaseTwo && mood.bass !== 'gallop' ? 'octave' : mood.bass
    if (style === 'drive') for (let step = 0; step < 16; step += 2) add('bass', at + step, 2, step === 14 ? root + 12 : root, 1)
    if (style === 'octave') for (let step = 0; step < 16; step += 2) add('bass', at + step, 2, step % 4 === 2 ? root + 12 : root, 1)
    if (style === 'gallop') for (let step = 0; step < 16; step += 4) [0, 2, 3].forEach((offset, index) => add('bass', at + step + offset, index === 0 ? 2 : 1, root, 1))
    if (style === 'walk') [root, scaleNote(mood, progression[bar] + 2, -1), fifth, scaleNote(mood, progression[bar] + 5, -1)].forEach((midi, beat) => add('bass', at + beat * 4, 4, midi, 1))
    if (style === 'half') {
      add('bass', at, 6, root, 1)
      add('bass', at + 6, 2, root, 1)
      add('bass', at + 8, 6, fifth, 1)
      add('bass', at + 14, 2, root + 12, 1)
    }
  }

  // Drums, with a snare fill into every eighth bar (and so into the loop point).
  const kit = DRUMS[mood.drums]
  for (let bar = 0; bar < bars; bar += 1) {
    const at = bar * 16
    const fill = bar % 8 === 7 || bar === bars - 1
    kit.kick.forEach((step) => add('kick', at + step, 2, 0, 1))
    if (phaseTwo) [4, 12].forEach((step) => kit.kick.includes(step) || add('kick', at + step, 2, 0, 0.8))
    kit.snare.forEach((step) => (!fill || step < 12) && add('snare', at + step, 2, 0, 1))
    if (fill) [12, 13, 14, 15].forEach((step, index) => add('snare', at + step, 1, 0, 0.55 + index * 0.15))
    const hats = phaseTwo ? Array.from({ length: 16 }, (_, step) => step) : kit.hat
    hats.forEach((step) => add('hat', at + step, 1, 0, step % 4 === 0 ? 1 : 0.6))
  }
  return { bars, notes }
}

function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt
    return x + x - x * x - 1
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt
    return x * x + x + x + 1
  }
  return 0
}

const VOICES = {
  lead: { level: 0.2, duty: null, attack: 0.003, decay: 0.14, sustain: 0.62, release: 0.03, vibrato: 0.18 },
  double: { level: 0.08, duty: 0.125, attack: 0.003, decay: 0.1, sustain: 0.5, release: 0.03, vibrato: 0.18 },
  arp: { level: 0.085, duty: 0.125, attack: 0.001, decay: 0.07, sustain: 0.25, release: 0.02 },
  bass: { level: 0.34, attack: 0.002, decay: 0.05, sustain: 0.9, release: 0.02 }
}

/** Renders a composed song into a circular buffer exactly one loop long. */
export function renderSong(mood, song) {
  const stepSeconds = 60 / mood.bpm / 4
  const length = Math.round(song.bars * 16 * stepSeconds * SAMPLE_RATE)
  const out = new Float32Array(length)
  const at = (step) => Math.round(step * stepSeconds * SAMPLE_RATE)
  const write = (index, value) => {
    out[((index % length) + length) % length] += value
  }
  let lfsr = (mood.seed & 0x7fff) || 1
  for (const note of song.notes) {
    const start = at(note.step)
    if (note.voice === 'kick' || note.voice === 'snare' || note.voice === 'hat') {
      const seconds = note.voice === 'kick' ? 0.16 : note.voice === 'snare' ? 0.14 : 0.045
      const count = Math.round(seconds * SAMPLE_RATE)
      const clock = note.voice === 'hat' ? 9000 : note.voice === 'snare' ? 5200 : 2600
      const shortMode = note.voice === 'hat'
      let counter = 0
      let bodyPhase = 0
      for (let index = 0; index < count; index += 1) {
        const t = index / SAMPLE_RATE
        counter += clock / SAMPLE_RATE
        while (counter >= 1) {
          counter -= 1
          const bit = (lfsr & 1) ^ ((lfsr >> (shortMode ? 6 : 1)) & 1)
          lfsr = (lfsr >> 1) | (bit << 14)
        }
        const noise = lfsr & 1 ? -1 : 1
        const env = (1 - t / seconds) ** (note.voice === 'hat' ? 3 : 2)
        let value
        if (note.voice === 'kick') {
          bodyPhase += (48 + 110 * Math.exp(-t / 0.03)) / SAMPLE_RATE
          value = 0.55 * (1 - 4 * Math.abs((bodyPhase % 1) - 0.5)) * env + (t < 0.006 ? 0.12 * noise : 0)
        } else if (note.voice === 'snare') {
          bodyPhase += (185 * Math.exp(-t / 0.08)) / SAMPLE_RATE
          value = 0.2 * noise * env + 0.14 * (1 - 4 * Math.abs((bodyPhase % 1) - 0.5)) * Math.exp(-t / 0.04)
        } else {
          value = 0.075 * noise * env
        }
        write(start + index, value * note.level)
      }
      continue
    }
    const voice = VOICES[note.voice]
    const hz = midiHz(note.midi)
    const gate = note.steps * stepSeconds * 0.92
    const count = Math.round((gate + voice.release) * SAMPLE_RATE)
    const duty = voice.duty ?? mood.lead
    let phase = 0
    for (let index = 0; index < count; index += 1) {
      const t = index / SAMPLE_RATE
      const vibrato = voice.vibrato && t > voice.vibrato ? 2 ** ((0.15 / 12) * Math.sin(TAU * 5.5 * t)) : 1
      const dt = (hz * vibrato) / SAMPLE_RATE
      phase += dt
      phase -= Math.floor(phase)
      let value
      if (note.voice === 'bass') {
        const tri = 1 - 4 * Math.abs(phase - 0.5)
        value = Math.round(tri * 7.5) / 7.5
      } else {
        value = phase < duty ? 1 : -1
        value += polyBlep(phase, dt)
        value -= polyBlep((phase - duty + 1) % 1, dt)
      }
      let env
      if (t < voice.attack) env = t / voice.attack
      else if (t < gate) env = voice.sustain + (1 - voice.sustain) * Math.exp(-(t - voice.attack) / voice.decay)
      else env = (voice.sustain + (1 - voice.sustain) * Math.exp(-(gate - voice.attack) / voice.decay)) * (1 - (t - gate) / voice.release)
      write(start + index, value * env * voice.level * note.level)
    }
  }
  return out
}

function trackList() {
  const tracks = []
  for (const [id, mood] of Object.entries(STAGE_MOODS)) tracks.push({ id: `stage_${id}`, kind: 'stage', owner: id, mood, phaseTwo: false })
  for (const [id, mood] of Object.entries(BOSS_MOODS)) {
    tracks.push({ id: `boss_${id}`, kind: 'boss', owner: id, mood, phaseTwo: false })
    tracks.push({ id: `boss_${id}_phase2`, kind: 'boss_phase2', owner: id, mood, phaseTwo: true })
  }
  return tracks
}

function main() {
  const filter = process.argv[2]
  const manifest = { generator: 'scripts/audio/compose.mjs', sampleRate: SAMPLE_RATE, oggQuality: OGG_QUALITY, loudnessTargetLufs: MUSIC_LOUDNESS_TARGET_LUFS, tracks: {} }
  for (const track of trackList().filter((entry) => !filter || entry.id.includes(filter))) {
    const song = composeSong(track.mood, { phaseTwo: track.phaseTwo })
    const samples = renderSong(track.mood, song)
    const file = `assets/audio/music/generated/${track.id}.ogg`
    // Gain to the loudness target, a soft knee above -6dBFS so Vorbis overshoot stays under the true-peak
    // ceiling, then one correction pass from the encoded file's own measurement.
    let gainDb = MUSIC_LOUDNESS_TARGET_LUFS - measureLoudness(samples, SAMPLE_RATE).integratedLufs
    let final
    for (let pass = 0; pass < 2; pass += 1) {
      encodeOgg(resolve(ROOT, file), master(samples, gainDb), SAMPLE_RATE, { quality: OGG_QUALITY })
      final = measureLoudness(resolve(ROOT, file))
      if (Math.abs(final.integratedLufs - MUSIC_LOUDNESS_TARGET_LUFS) < 0.3) break
      gainDb += MUSIC_LOUDNESS_TARGET_LUFS - final.integratedLufs
    }
    const decoded = decodeMono(resolve(ROOT, file), SAMPLE_RATE)
    const info = probe(resolve(ROOT, file))
    const entry = {
      file,
      kind: track.kind,
      owner: track.owner,
      seed: track.mood.seed,
      feel: track.mood.feel,
      bpm: track.mood.bpm,
      bars: song.bars,
      seconds: round(samples.length / SAMPLE_RATE, 3),
      loudnessLufs: final.integratedLufs,
      truePeakDbtp: final.truePeakDbtp,
      seamDb: round(loopSeamDb(decoded, SAMPLE_RATE), 2),
      decodedSamplesMatch: decoded.length === samples.length,
      bytes: info.bytes
    }
    manifest.tracks[track.id] = entry
    console.log(`${track.id.padEnd(28)} ${entry.seconds}s ${entry.bars} bars ${entry.loudnessLufs} LUFS TP ${entry.truePeakDbtp} seam ${entry.seamDb}dB ${round(entry.bytes / 1024, 1)}KB${entry.decodedSamplesMatch ? '' : ` DECODED ${decoded.length} != ${samples.length}`}`)
  }
  if (!filter) writeFileSync(resolve(ROOT, MUSIC_MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
