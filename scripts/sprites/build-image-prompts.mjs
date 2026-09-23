import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { ORDERED_BOSSES } from '../../src/bosses/roster.ts'

function parseArgs(argv) {
  const args = {
    outDir: 'output/imagegen/prompts'
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--out-dir' && next) {
      args.outDir = next
      i += 1
    }
  }

  return args
}

function bossPrompt(blueprint) {
  const animSpec = blueprint.spritePlan.animations
    .map((animation) => `- ${animation.key}: ${animation.frames} frames @ ${animation.fps}fps (${animation.description})`)
    .join('\n')

  return [
    `Use case: stylized-concept`,
    `Asset type: retro game sprite sheet`,
    `Primary request: Create a pixel-art boss sprite sheet and atlas metadata for ${blueprint.codename}.`,
    `Scene/background: Transparent background only.`,
    `Subject: ${blueprint.codename}, element=${blueprint.element}, arena vibe=${blueprint.arena}.`,
    `Style/medium: 16-bit inspired Mega-style pixel art, clean silhouettes, readable at gameplay scale.`,
    `Composition/framing: Each frame centered; frame size ${blueprint.spritePlan.frame.x}x${blueprint.spritePlan.frame.y}; origin near feet (${blueprint.spritePlan.origin.x}, ${blueprint.spritePlan.origin.y}).`,
    `Lighting/mood: Elemental accents using primary=${blueprint.theme.primary.toString(16)} accent=${blueprint.theme.accent.toString(16)} glow=${blueprint.theme.glow.toString(16)}.`,
    `Materials/textures: Mechanical armor with subtle wear and high readability against dark backgrounds.`,
    `Constraints: Keep sprite proportions stable across all animations, no motion blur, no antialiasing artifacts, transparent background, no watermark.`,
    `Avoid: painterly strokes, soft edges, low-contrast values, tiny unreadable details.`,
    '',
    `Required animations:`,
    animSpec,
    '',
    `Output expectations:`,
    `- One atlas image (PNG) with transparent background`,
    `- One frame map JSON with named frames`,
    `- Frame names aligned with animation keys above`
  ].join('\n')
}

function main() {
  const args = parseArgs(process.argv)
  const outDir = path.resolve(process.cwd(), args.outDir)
  fs.mkdirSync(outDir, { recursive: true })

  const index = []

  ORDERED_BOSSES.forEach((entry) => {
    const prompt = bossPrompt(entry.blueprint)
    const file = `${entry.id}.md`
    fs.writeFileSync(path.join(outDir, file), prompt)
    index.push({ id: entry.id, codename: entry.blueprint.codename, file })
  })

  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2))

  const readme = [
    '# Sprite Prompt Pack',
    '',
    'Generated prompts for each boss sprite sheet based on `src/bosses/roster.ts` sprite plans.',
    '',
    'Run image generation (example):',
    '```bash',
    'python /Users/thristannewman/.codex/skills/imagegen/scripts/image_gen.py generate --prompt-file output/imagegen/prompts/sentinel_rook.md --out output/imagegen/renders/sentinel_rook.png',
    '```',
    '',
    'Notes:',
    '- Requires OPENAI_API_KEY for live generation.',
    '- Missing key does not block game runtime; placeholder/generated textures still work.'
  ].join('\n')

  fs.writeFileSync(path.join(outDir, 'README.md'), readme)

  if (!process.env.OPENAI_API_KEY) {
    console.warn('[sprites] OPENAI_API_KEY is not set. Prompt pack created; generation is optional.')
  }

  console.log(`[sprites] Prompt pack generated for ${ORDERED_BOSSES.length} bosses at ${path.relative(process.cwd(), outDir)}`)
}

main()
