import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: { open: true },
  preview: { open: false },
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
