import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { relative, resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

const privateSpriteManifestPath = resolve(__dirname, 'assets/private/runtime/private-sprite-overrides.manifest.json')
const privateSpriteManifestData = existsSync(privateSpriteManifestPath)
  ? JSON.parse(readFileSync(privateSpriteManifestPath, 'utf8'))
  : null
const smokeWatchIgnored = process.env.VITE_SMOKE === '1' ? ['**/*'] : undefined
const smokeServerActive = process.env.VITE_SMOKE === '1'
// Source maps are for debugging a build; the dev server has its own. Phaser's map alone is 10MB.
const buildSourcemap = process.env.BUILD_SOURCEMAP === '1'

function copyRuntimeAssetsPlugin(): Plugin {
  const sourceRoot = resolve(__dirname, 'assets')
  const targetRoot = resolve(__dirname, 'dist/assets')
  const ownedRuntimeDirs = ['audio', 'backgrounds', 'sprites', 'private']

  return {
    name: 'copy-runtime-assets',
    apply: 'build',
    writeBundle() {
      if (!existsSync(sourceRoot)) {
        return
      }

      ownedRuntimeDirs.forEach((dir) => {
        rmSync(resolve(targetRoot, dir), { recursive: true, force: true })
      })
      mkdirSync(targetRoot, { recursive: true })
      cpSync(sourceRoot, targetRoot, {
        recursive: true,
        filter(source) {
          const assetPath = relative(sourceRoot, source).split('\\').join('/')
          const fileName = source.split(/[\\/]/).pop()

          if (fileName === '.DS_Store') {
            return false
          }
          if (assetPath === 'sprites/source' || assetPath.startsWith('sprites/source/')) {
            return false
          }
          if (assetPath === 'private/source' || assetPath.startsWith('private/source/')) {
            return false
          }

          return true
        }
      })
    }
  }
}

export default defineConfig(({ command }) => ({
  plugins: [copyRuntimeAssetsPlugin()],
  server: {
    open: !smokeServerActive,
    hmr: smokeServerActive ? false : undefined,
    watch: smokeWatchIgnored ? { ignored: smokeWatchIgnored } : undefined
  },
  preview: { open: false },
  define: {
    __PRIVATE_SPRITE_MANIFEST_DATA__: JSON.stringify(privateSpriteManifestData)
  },
  build: {
    sourcemap: buildSourcemap,
    rollupOptions: {
      output: {
        // Phaser is the only manual chunk: it changes rarely, so browsers keep it cached across game
        // updates. Splitting game code by folder (boss/content/gameplay) made chunks import each other
        // in a cycle, and the production build threw "Cannot access 'b' before initialization" at boot.
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) {
            return 'phaser'
          }
          return undefined
        }
      }
    }
  },
  resolve: {
    alias: [
      { find: '@boss/BossController', replacement: resolve(__dirname, 'src/bosses/BossController.ts') },
      // The game uses Arcade physics only. Phaser's arcade-physics build is the full engine minus
      // Matter.js, about 10% less JavaScript to download and parse. Types still come from 'phaser'.
      // The build takes Phaser's own minified file (smaller than re-minifying); dev keeps it readable.
      {
        find: /^phaser$/,
        replacement: resolve(
          __dirname,
          command === 'build'
            ? 'node_modules/phaser/dist/phaser-arcade-physics.min.js'
            : 'node_modules/phaser/dist/phaser-arcade-physics.js'
        )
      }
    ]
  }
}))
