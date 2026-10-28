import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// One id per build, baked into the bundle and published as /version.json so open
// tabs can tell they're running an old deploy (see src/lib/freshness.ts).
function buildVersion(id: string): Plugin {
  return {
    name: 'lift:build-version',
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id }) })
    },
  }
}

// The config module is loaded more than once per build; the process env keeps every load on one id.
const BUILD_STAMP = (process.env.LIFT_BUILD_ID ??= Date.now().toString(36))

const config = defineConfig(({ command }) => {
  const buildId = command === 'build' ? BUILD_STAMP : 'dev'
  return {
    resolve: { tsconfigPaths: true },
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    plugins: [
      devtools(),
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      buildVersion(buildId),
    ],
  }
})

export default config
