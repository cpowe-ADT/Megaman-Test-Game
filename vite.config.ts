import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { relative, resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

const smokeWatchIgnored = process.env.VITE_SMOKE === '1' ? ['**/*'] : undefined
const smokeServerActive = process.env.VITE_SMOKE === '1'
// Source maps are for debugging a build; the dev server has its own. Phaser's map alone is 10MB.
// 'hidden' still writes .map files next to the bundle but omits the //# sourceMappingURL comment,
// so a browser (or an end user) never auto-loads them; upload them to a crash reporter by hand.
const buildSourcemap = process.env.BUILD_SOURCEMAP === '1' ? 'hidden' : false

function copyRuntimeAssetsPlugin(): Plugin {
  const sourceRoot = resolve(__dirname, 'assets')
  const targetRoot = resolve(__dirname, 'dist/assets')
  const ownedRuntimeDirs = ['audio', 'backgrounds', 'sprites', 'ui']

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
          // Generator sheets (Higgsfield sources, prompts, variants) live in a `source` folder beside the
          // runtime files they were cut into (sprites/source, backgrounds/source, ui/source): never ship them.
          if (/(^|\/)source(\/|$)/.test(assetPath)) {
            return false
          }
          // The developer-only skin was retired in 05c (5.5); never ship anything left in assets/private.
          if (assetPath === 'private' || assetPath.startsWith('private/')) {
            return false
          }

          return true
        }
      })
    }
  }
}

/** Production builds ship the sprite manifest without its human notes and local source paths (prompt 09 `jsGzipKB`). */
function stripSpriteManifestDocsPlugin(): Plugin {
  return {
    name: 'strip-sprite-manifest-docs',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      if (!id.endsWith('/assets/sprites/manifest.v1.json')) return null
      const manifest = JSON.parse(code) as { entries?: Array<{ notes?: unknown; source?: Record<string, unknown> }> }
      for (const entry of manifest.entries ?? []) {
        delete entry.notes
        if (entry.source) {
          delete entry.source.localImagePath
          delete entry.source.localDataPath
        }
      }
      return { code: JSON.stringify(manifest), map: null }
    }
  }
}

export default defineConfig(({ command }) => ({
  plugins: [stripSpriteManifestDocsPlugin(), copyRuntimeAssetsPlugin()],
  // Production builds fetch the dialogue lines and the enemy catalog in Preload instead of bundling them
  // (src/content/dialogue/index.ts, src/content/enemies/catalog.ts), and ship the sprite manifest without its notes.
  define: command === 'build' ? { __FETCH_CONTENT__: 'true' } : {},
  server: {
    open: !smokeServerActive,
    hmr: smokeServerActive ? false : undefined,
    watch: smokeWatchIgnored ? { ignored: smokeWatchIgnored } : undefined
  },
  preview: { open: false },
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
