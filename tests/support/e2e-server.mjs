import { mkdir, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../client/node_modules/vite/dist/node/index.js'
import { app } from '../../server/src/app.js'
import { startTestDatabase } from '../../server/test/support/database.js'
import { resetFixtures } from '../../server/test/support/fixtures.js'
import { installTranslationProvider } from '../../server/test/support/translation-provider.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const runtime = new URL('../../.test-runtime/', import.meta.url)
let database, api, vite, translationProvider
let stopping
async function stop() {
  if (stopping) return stopping
  stopping = (async () => {
    await vite?.close()
    if (api) {
      api.closeAllConnections()
      await new Promise(resolve => api.close(resolve))
    }
    await database?.stop()
    translationProvider?.restore()
    await rm(new URL('e2e.json', runtime), { force: true })
  })()
  return stopping
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop().then(() => process.exit(0)))
try {
  database = await startTestDatabase('e2e')
  translationProvider = installTranslationProvider()
  await resetFixtures()
  api = app.listen(0, '127.0.0.1')
  await new Promise(resolve => api.once('listening', resolve))
  const apiURL = `http://127.0.0.1:${api.address().port}/api`
  process.env.VITE_API_URL = apiURL
  await mkdir(runtime, { recursive: true })
  await writeFile(new URL('e2e.json', runtime), JSON.stringify({ uri: database.uri, apiURL }))
  vite = await createServer({ root: `${root}client`, configFile: `${root}client/vite.config.js`,
    server: { host: '127.0.0.1', port: 5180, strictPort: true } })
  await vite.listen()
  console.log('Isolated CareCircle E2E app ready at http://127.0.0.1:5180')
} catch (error) {
  console.error(error)
  await stop()
  process.exit(1)
}
