import { createServer } from '../../client/node_modules/vite/dist/node/index.js'
import { join } from 'node:path'

export function createE2eViteServer({ root, cacheDir, port = 5180 }) {
  return createServer({
    root,
    configFile: join(root, 'vite.config.js'),
    cacheDir,
    // Source edits during a run must not remount pages or erase pending UI.
    // This applies only to the isolated E2E server, not normal `npm run dev`.
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
  })
}
