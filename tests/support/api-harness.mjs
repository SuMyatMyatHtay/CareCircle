import assert from 'node:assert/strict'
import { app } from '../../server/src/app.js'
import { startTestDatabase } from '../../server/test/support/database.js'
import { resetFixtures, accounts, password } from '../../server/test/support/fixtures.js'

export async function startApiHarness(label) {
  const database = await startTestDatabase(label)
  let server, tokens = {}
  try {
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const base = `http://127.0.0.1:${server.address().port}/api`
    async function request(path, { method = 'GET', user = 'alex', body, authenticated = true } = {}) {
      const response = await fetch(`${base}${path}`, { method, headers: {
        'Content-Type': 'application/json', ...(authenticated && tokens[user] ? { Authorization: `Bearer ${tokens[user]}` } : {}),
      }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
      return { status: response.status, data: response.status === 204 ? null : await response.json() }
    }
    return { request, async reset() {
      await resetFixtures(); tokens = {}
      for (const [user, email] of Object.entries(accounts)) {
        const result = await request('/auth/login', { method: 'POST', authenticated: false, body: { email, password } })
        assert.equal(result.status, 200); tokens[user] = result.data.token
      }
    }, async stop() {
      try { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
      finally { await database.stop() }
    } }
  } catch (error) {
    server?.closeAllConnections(); server?.close()
    await database.stop(); throw error
  }
}
