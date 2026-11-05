import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createE2eViteServer } from './e2e-vite.mjs'

it('E2E server does not reset a browser workflow when a source change is reported', async t => {
  // A temporary app exercises the real Vite change pipeline without touching
  // CareCircle source files or requiring an application API/database.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'carecircle-e2e-vite-')))
  let vite
  t.after(async () => { await vite?.close(); await rm(root, { recursive: true, force: true }) })
  await writeFile(join(root, 'vite.config.js'), 'export default { optimizeDeps: { noDiscovery: true, include: [] } }')
  await writeFile(join(root, 'index.html'), '<script type="module" src="/entry.js"></script>')
  const entry = join(root, 'entry.js')
  await writeFile(entry, 'document.body.textContent = "Ready"')
  vite = await createE2eViteServer({ root, cacheDir: join(root, '.e2e-cache'), port: 0 })
  await vite.listen()
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`
  assert.equal((await fetch(base)).status, 200)
  const response = await fetch(`${base}/entry.js`)
  assert.match(await response.text(), /Ready/)

  const messages = []
  t.mock.method(vite.environments.client.hot, 'send', payload => messages.push(payload))
  await writeFile(entry, 'document.body.textContent = "Changed"')
  // Await the same handlers used by a file watcher. This reproduces the HMR
  // interference from the failed trace without sleeping for a filesystem event.
  for (const handleChange of vite.watcher.listeners('change')) await handleChange(entry)
  assert.deepEqual(messages.filter(message => ['update', 'full-reload'].includes(message.type)), [])
  assert.deepEqual(vite.watcher.getWatched(), {})
})
