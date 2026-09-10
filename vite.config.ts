import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { relative, resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

const privateSpriteManifestPath = resolve(__dirname, 'assets/private/runtime/private-sprite-overrides.manifest.json')
const privateSpriteManifestData = existsSync(privateSpriteManifestPath)
  ? JSON.parse(readFileSync(privateSpriteManifestPath, 'utf8'))
  : null
const smokeWatchIgnored = process.env.VITE_SMOKE === '1' ? ['**/*'] : undefined
const smokeServerActive = process.env.VITE_SMOKE === '1'

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

export default defineConfig({
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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) {
            return 'phaser'
          }
          if (id.includes('/src/boss/') || id.includes('/src/bosses/')) {
            return 'boss'
          }
          if (id.includes('/src/content/')) {
            return 'content'
          }
          if (
            id.includes('/src/player/') ||
            id.includes('/src/projectiles/') ||
            id.includes('/src/enemy/') ||
            id.includes('/src/physics/')
          ) {
            return 'gameplay'
          }
          return undefined
        }
      }
    }
  },
  resolve: {
    alias: {
      '@boss/BossController': resolve(__dirname, 'src/bosses/BossController.ts')
    }
  }
})
