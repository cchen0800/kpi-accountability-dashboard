import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function git(cmd, fallback) {
  try { return execSync(cmd).toString().trim() } catch { return fallback }
}

const commitCount = git('git rev-list --count HEAD', '0')
const commitHash = git('git rev-parse --short HEAD', 'unknown')
const buildDate = new Date().toISOString()
const devPort = Number(process.env.VITE_DEV_PORT || 3100)
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5100'

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(commitCount),
    __BUILD_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  server: {
    port: devPort,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
    },
  },
})
