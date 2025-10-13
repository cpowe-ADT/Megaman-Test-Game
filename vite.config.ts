import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: { open: true },
  preview: { open: false },
  build: { sourcemap: true },
  resolve: {
    alias: {
      '@boss/BossController': resolve(__dirname, 'src/bosses/BossController.ts')
    }
  }
})
