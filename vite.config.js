import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function git(cmd, fallback) {
  try { return execSync(cmd).toString().trim() } catch { return fallback }
}

const commitCount = git('git rev-list --count HEAD', '0')
const commitHash = git('git rev-parse --short HEAD', 'unknown')
const buildDate = new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(commitCount),
    __BUILD_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
