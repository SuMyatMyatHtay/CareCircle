import { before, beforeEach, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../server/src/app.js'
import { startTestDatabase } from '../../server/test/support/database.js'
import { resetFixtures, ids, accounts, password } from '../../server/test/support/fixtures.js'
import Family from '../../server/src/features/families/Family.model.js'
import Recipient from '../../server/src/features/recipients/CareRecipient.model.js'
import User from '../../server/src/features/auth/User.model.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Log from '../../server/src/features/logs/CareLog.model.js'
import Notification from '../../server/src/features/notifications/Notifications.model.js'
import GoogleCalendarLink from '../../server/src/features/calendar-sync/GoogleCalendarLink.model.js'
import { installTranslationProvider } from '../../server/test/support/translation-provider.js'

let database, server, base, tokens, translationProvider
before(async () => {
  database = await startTestDatabase('api')
  translationProvider = installTranslationProvider()
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
  translationProvider?.restore()
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
  translationProvider.reset()
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

  it('keeps manual task edits and deletions restricted to the creator, including admins', async () => {
    for (const user of ['alex', 'may']) {
      assert.equal((await request(`${family}/tasks/${ids.task}`, { method: 'PATCH', user, body: { title: 'Unauthorized edit' } })).status, 403)
      assert.equal((await request(`${family}/tasks/${ids.task}`, { method: 'DELETE', user })).status, 403)
    }
    assert.equal((await Task.findById(ids.task)).title, 'Collect medicine')
    assert.equal((await request(`${family}/tasks/${ids.task}`, { method: 'PATCH', user: 'jasmine', body: { title: 'Creator edit' } })).status, 200)
    assert.equal((await Task.findById(ids.task)).title, 'Creator edit')
    const removed = await request(`${family}/tasks/${ids.task}`, { method: 'DELETE', user: 'jasmine' })
    assert.equal(removed.status, 200)
    assert.equal(removed.data.taskId, ids.task)
    assert.equal(await Task.findById(ids.task), null)
  })

  it('allows exactly one winner when two family members claim the same task', async () => {
    const results = await Promise.all(['alex', 'may'].map(user => request(`${family}/tasks/${ids.task}/claim`, { method: 'POST', user })))
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
    const saved = await Task.findById(ids.task)
    const winner = results[0].status === 200 ? 'alex' : 'may'
    assert.equal(saved.status, 'claimed')
    assert.equal(String(saved.claimedBy), ids[winner])
  })

  it('scopes live trips and milestones to their family and companion and completes a home step', async () => {
    assert.equal((await request(`${family}/tasks/${ids.task}`, { method: 'PATCH', user: 'jasmine',
      body: { needsTransit: true, location: { name: 'Test Clinic' } } })).status, 200)
    assert.equal((await request(`${family}/tasks/${ids.task}/claim`, { method: 'POST' })).status, 200)
    assert.equal((await request(`${family}/tasks/${ids.task}/start`, { method: 'POST' })).status, 200)
    const path = `${family}/tasks/${ids.task}/transit`
    assert.equal((await request(`${path}/milestones`, { method: 'POST', user: 'may', body: { type: 'arrived' } })).status, 403)
    const arrived = await request(`${path}/milestones`, { method: 'POST', body: { type: 'arrived' } })
    assert.equal(arrived.status, 201)
    const list = await request(`${family}/transit?status=active`, { user: 'may' })
    assert.equal(list.data.transitSessions.length, 1)
    assert.equal(list.data.transitSessions[0].task.recipient.name, 'Grandpa')
    assert.equal((await request(`/families/${ids.otherFamily}/transit?status=active`)).data.transitSessions.length, 0)
    const at = arrived.data.transitSession.milestones.at(-1).at
    assert.equal((await request(`${path}/milestones?at=${encodeURIComponent(at)}`, { method: 'DELETE' })).status, 200)
    assert.equal((await request(path)).data.transitSession.milestones.length, 0)
    const home = await request(`${path}/milestones`, { method: 'POST', body: { type: 'home' } })
    assert.equal(home.status, 201)
    assert.equal((await Task.findById(ids.task)).status, 'completed')
    assert.equal((await request(`${family}/transit?status=active`)).data.transitSessions.length, 0)
    const homeAt = home.data.transitSession.milestones.at(-1).at
    assert.equal((await request(`${path}/milestones?at=${encodeURIComponent(homeAt)}`, { method: 'DELETE' })).status, 409)
  })

  it('translates through the server, caches per language, and preserves the note timestamp', async () => {
    const before = await Log.findById(ids.log)
    const path = `${family}/logs/${ids.log}/translate`
    const first = await request(path, { method: 'POST', body: { lang: 'zh' } })
    assert.equal(first.status, 200)
    assert.equal(first.data.translation, '这是已翻译的护理记录。')
    assert.equal(first.data.cached, false)
    const again = await request(path, { method: 'POST', body: { lang: 'zh' } })
    assert.equal(again.data.cached, true)
    assert.equal(translationProvider.calls.length, 1)
    assert.equal(translationProvider.calls[0].to, 'zh-Hans')
    const saved = await Log.findById(ids.log)
    assert.equal(saved.translations.get('zh'), first.data.translation)
    assert.equal(saved.updatedAt.getTime(), before.updatedAt.getTime())
  })

  it('rejects unsupported languages and foreign-family notes before contacting the provider', async () => {
    const path = `${family}/logs/${ids.log}/translate`
    for (const lang of ['constructor', 'en', 123])
      assert.equal((await request(path, { method: 'POST', body: { lang } })).status, 400)
    assert.equal((await request(path, { method: 'POST', user: 'outsider', body: { lang: 'zh' } })).status, 403)
    assert.equal((await request(`/families/${ids.otherFamily}/logs/${ids.log}/translate`, { method: 'POST', body: { lang: 'zh' } })).status, 404)
    assert.equal(translationProvider.calls.length, 0)
  })

  it('invalidates cached translations only when note content changes', async () => {
    const path = `${family}/logs/${ids.log}`
    await request(`${path}/translate`, { method: 'POST', body: { lang: 'zh' } })
    assert.equal((await request(path, { method: 'PATCH', body: { type: 'consultation', consultation: { doctorName: 'Dr Test' } } })).status, 200)
    assert.equal((await request(`${path}/translate`, { method: 'POST', body: { lang: 'zh' } })).data.cached, true)
    assert.equal(translationProvider.calls.length, 1)
    assert.equal((await request(path, { method: 'PATCH', body: { content: 'A revised care note.' } })).status, 200)
    assert.equal((await Log.findById(ids.log)).translations.size, 0)
    assert.equal((await request(`${path}/translate`, { method: 'POST', body: { lang: 'zh' } })).data.cached, false)
    assert.equal(translationProvider.calls.at(-1).text, 'A revised care note.')
  })

  it('returns a retryable 502 for provider failure or malformed data without caching a result', async t => {
    t.mock.method(console, 'error', () => {})
    for (const mode of ['failure', 'empty']) {
      translationProvider.mode = mode
      const result = await request(`${family}/logs/${ids.log}/translate`, { method: 'POST', body: { lang: 'zh' } })
      assert.equal(result.status, 502)
      assert.equal(result.data.error, 'Translation service is unavailable. Please try again later.')
      assert.equal((await Log.findById(ids.log)).translations.size, 0)
    }
  })

  it('records log.updated and log.deleted for Recent updates, naming who did it but never the note text', async () => {
    const path = `${family}/logs/${ids.log}`
    // Jasmine is an admin, so she can change Alex's note
    assert.equal((await request(path, { method: 'PATCH', user: 'jasmine', body: { content: 'Private detail: new rash on arm.' } })).status, 200)
    assert.equal((await request(path, { method: 'DELETE', user: 'jasmine' })).status, 204)

    const feed = await request(`${family}/notifications`)
    assert.equal(feed.status, 200)
    const [deleted, updated] = feed.data.notifications
    assert.deepEqual(
      [updated.eventType, updated.text, String(updated.refId)],
      ['log.updated', 'Jasmine edited a care note for Grandpa.', ids.grandpa],
    )
    assert.deepEqual([deleted.eventType, deleted.text], ['log.deleted', 'Jasmine deleted a care note for Grandpa.'])
    // No Telegram group is linked in the fixtures, so nothing is sent
    assert.ok([updated, deleted].every(n => n.status === 'skipped'))
    assert.ok(!JSON.stringify(feed.data).includes('rash'))
    assert.equal(await Notification.countDocuments({ family: ids.otherFamily }), 0)
  })

  it('a note posted without Telegram still shows in Recent updates, but is never sent', async () => {
    await Family.updateOne({ _id: ids.family }, { $set: { telegram: { chatId: '-100123', linkedAt: new Date() } } })
    const created = await request(`${family}/logs`, { method: 'POST', body: {
      recipient: ids.grandpa, type: 'medication_change', content: 'Dose changed.', notify: false,
      medicationChanges: [{ name: 'Amlodipine', change: 'dosage_changed', details: '10mg' }],
    } })
    assert.equal(created.status, 201)
    const feed = (await request(`${family}/notifications`)).data.notifications
    // One update per note. Had it tried Telegram (no bot token in tests) the status would be 'failed'
    assert.deepEqual(feed.map(n => `${n.eventType} ${n.status}`), ['medication.changed skipped'])

    // Editing only the text is an edit, not another "medication was updated"
    const path = `${family}/logs/${created.data.log._id}`
    const sameMedicines = created.data.log.medicationChanges
    await request(path, { method: 'PATCH', body: { content: 'Dose changed today.', medicationChanges: sameMedicines } })
    await request(path, { method: 'PATCH', body: { medicationChanges: [{ name: 'Amlodipine', change: 'stopped' }] } })
    const events = (await request(`${family}/notifications`)).data.notifications.map(n => n.eventType)
    assert.deepEqual(events.slice(0, 2).sort(), ['log.updated', 'medication.changed'])
    assert.equal(events.length, 3)
  })

  it('guards optional Calendar endpoints and never exposes a saved refresh token', async t => {
    assert.equal((await request('/me/google', { authenticated: false })).status, 401)
    assert.deepEqual((await request('/me/google')).data, { available: false, connected: false })
    assert.equal((await request('/me/google/connect')).status, 503)
    assert.equal((await request('/google/callback', { authenticated: false })).status, 503)
    const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
    Object.assign(process.env, { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'http://app.example.test/api/google/callback' })
    t.after(() => { for (const key of keys) delete process.env[key] })
    await GoogleCalendarLink.create({ user: ids.alex, refreshToken: 'never-return-this-test-token', googleEmail: 'alex@example.test' })
    const status = await request('/me/google')
    assert.equal(status.data.connected, true)
    assert.equal(status.data.email, 'alex@example.test')
    assert.ok(!JSON.stringify(status.data).includes('never-return-this-test-token'))
    const url = await request('/me/google/connect')
    assert.equal(url.status, 200)
    assert.ok(!url.data.url.includes('test-secret'))
  })
})
