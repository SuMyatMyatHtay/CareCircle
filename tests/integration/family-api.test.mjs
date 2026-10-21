import { before, beforeEach, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../server/src/app.js'
import { startTestDatabase } from '../../server/test/support/database.js'
import { resetFixtures, ids, accounts, password } from '../../server/test/support/fixtures.js'
import Family from '../../server/src/features/families/Family.model.js'
import Recipient from '../../server/src/features/recipients/CareRecipient.model.js'
import User from '../../server/src/features/auth/User.model.js'

let database, server, base, tokens
before(async () => {
  database = await startTestDatabase('api')
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api`
}, { timeout: 180000 })
after(async () => {
  if (server) {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
  await database?.stop()
})
async function request(path, { method = 'GET', user = 'alex', body, authenticated = true } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json',
      ...(authenticated && tokens?.[user] ? { Authorization: `Bearer ${tokens[user]}` } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, data: response.status === 204 ? null : await response.json() }
}
beforeEach(async () => {
  await resetFixtures()
  tokens = {}
  for (const [name, email] of Object.entries(accounts)) {
    const login = await request('/auth/login', { method: 'POST', authenticated: false, body: { email, password } })
    assert.equal(login.status, 200)
    tokens[name] = login.data.token
  }
})
const family = `/families/${ids.family}`

describe('Family APIs with Express, authentication and a real isolated MongoDB', () => {
  it('returns public members only to authenticated family members', async () => {
    assert.equal((await request(`${family}/members`, { authenticated: false })).status, 401)
    assert.equal((await request(`${family}/members`, { user: 'outsider' })).status, 403)
    const result = await request(`${family}/members`)
    assert.equal(result.status, 200)
    assert.equal(result.data.members.length, 3)
    assert.equal(result.data.members[0].user.passwordHash, undefined)
    assert.equal(result.data.members[0].user.tokenVersion, undefined)
  })

  it('persists recipient create/edit/archive and keeps it in the selected family', async () => {
    const created = await request(`${family}/recipients`, { method: 'POST', body: {
      name: 'New care recipient', careType: 'elderly', family: ids.otherFamily,
    } })
    assert.equal(created.status, 201)
    const id = created.data.recipient._id
    assert.equal(String((await Recipient.findById(id)).family), ids.family)
    assert.equal((await request(`/families/${ids.otherFamily}/recipients/${id}`)).status, 404)
    const updated = await request(`${family}/recipients/${id}`, { method: 'PATCH', body: { careNotes: 'Bring the walking frame' } })
    assert.equal(updated.status, 200)
    assert.equal((await Recipient.findById(id)).careNotes, 'Bring the walking frame')
    assert.equal((await request(`${family}/recipients/${id}/archive`, { method: 'POST' })).status, 200)
    assert.equal((await Recipient.findById(id)).isActive, false)
    const list = await request(`${family}/recipients`)
    assert.ok(!list.data.recipients.some(recipient => recipient._id === id))
    const history = await request(`${family}/recipients?includeArchived=true`)
    assert.ok(history.data.recipients.some(recipient => recipient._id === id))
  })

  it('denies ordinary members admin writes without changing persisted data', async () => {
    const options = { method: 'POST', user: 'may' }
    assert.equal((await request(`${family}/recipients/${ids.grandpa}/archive`, options)).status, 403)
    assert.equal((await request(`${family}/invite-code`, options)).status, 403)
    assert.equal((await request(`${family}/members/${ids.alex}`, { method: 'PATCH', user: 'may', body: { role: 'member' } })).status, 403)
    assert.equal((await Recipient.findById(ids.grandpa)).isActive, true)
    assert.equal((await Family.findById(ids.family)).inviteCode, 'AABBCCDDEE')
  })

  it('preserves an admin when two admins concurrently demote themselves', async () => {
    const results = await Promise.all(['alex', 'jasmine'].map(user =>
      request(`${family}/members/${ids[user]}`, { method: 'PATCH', user, body: { role: 'member' } })))
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
    const saved = await Family.findById(ids.family)
    assert.equal(saved.members.filter(member => member.role === 'admin').length, 1)
  })

  it('prevents the last admin from leaving and allows an ordinary member to leave', async () => {
    assert.equal((await request(`${family}/members/${ids.jasmine}`, { method: 'PATCH', body: { role: 'member' } })).status, 200)
    assert.equal((await request(`${family}/members/${ids.alex}`, { method: 'DELETE' })).status, 409)
    assert.equal((await request(`${family}/members/${ids.may}`, { method: 'DELETE', user: 'may' })).status, 204)
    const saved = await Family.findById(ids.family)
    assert.ok(saved.members.some(member => member.userId.toString() === ids.alex && member.role === 'admin'))
    assert.ok(!saved.members.some(member => member.userId.toString() === ids.may))
  })

  it('rotates an invite so only the new persisted code can join the family', async () => {
    const rotated = await request(`${family}/invite-code`, { method: 'POST' })
    assert.equal(rotated.status, 200)
    assert.match(rotated.data.inviteCode, /^[A-F0-9]{10}$/)
    assert.notEqual(rotated.data.inviteCode, 'AABBCCDDEE')
    assert.equal((await request('/families/join', { method: 'POST', user: 'outsider', body: { inviteCode: 'AABBCCDDEE' } })).status, 404)
    assert.equal((await request('/families/join', { method: 'POST', user: 'outsider', body: { inviteCode: rotated.data.inviteCode } })).status, 200)
    assert.ok((await Family.findById(ids.family)).members.some(member => member.userId.toString() === ids.outsider))
  })

  it('saves the preferred language without changing unrelated profile fields', async () => {
    const current = (await request('/auth/me')).data.user
    const result = await request('/auth/me', { method: 'PATCH', body: { ...current, preferredLang: 'zh' } })
    assert.equal(result.status, 200)
    const saved = await User.findById(ids.alex)
    assert.equal(saved.preferredLang, 'zh')
    assert.equal(saved.name, current.name)
    assert.equal(saved.isCaretaker, current.isCaretaker)
    assert.equal((await request('/auth/me')).data.user.preferredLang, 'zh')
  })

  it('revokes a logged-out token before it can read the family again', async () => {
    assert.equal((await request('/auth/logout', { method: 'POST' })).status, 200)
    assert.equal((await request(`${family}/members`)).status, 401)
  })
})
