import { before, beforeEach, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../server/src/app.js'
import { startTestDatabase } from '../../server/test/support/database.js'
import { resetFixtures, ids, accounts, password } from '../../server/test/support/fixtures.js'
import Recipient from '../../server/src/features/recipients/CareRecipient.model.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Log from '../../server/src/features/logs/CareLog.model.js'
import { makeSnippet } from '../../server/src/features/search/service.js'

let database, server, base, tokens
before(async () => {
  database = await startTestDatabase('search')
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
async function request(path, { user = 'alex', method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(tokens?.[user] ? { Authorization: `Bearer ${tokens[user]}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, data: await response.json() }
}
const search = (params, options) => request(`/families/${ids.family}/search?${new URLSearchParams(params)}`, options)
const inDays = days => new Date(Date.now() + days * 86400000)

// Eye-related rows in the Tan family, plus look-alikes in the Lee family that must never show
async function seedEyeData() {
  const clinic = { name: 'TTSH Eye Centre', address: '11 Jalan Tan Tock Seng', postal: '308433' }
  await Task.create([
    { family: ids.family, recipient: ids.grandpa, title: 'Eye check-up', startAt: inDays(1), location: clinic, createdBy: ids.jasmine },
    { family: ids.family, recipient: ids.grandpa, title: 'Eye check-up', startAt: inDays(-20), location: clinic, status: 'completed', claimedBy: ids.jasmine, createdBy: ids.jasmine },
    { family: ids.family, recipient: ids.grandpa, title: 'Collect eye drops', startAt: inDays(3), createdBy: ids.alex },
    { family: ids.family, recipient: ids.grandpa, title: 'Old eye appointment', startAt: inDays(2), status: 'cancelled', createdBy: ids.alex },
    { family: ids.otherFamily, recipient: ids.otherRecipient, title: 'Eye exam (Lee)', startAt: inDays(1), location: { name: 'Lee Eye Clinic' }, createdBy: ids.outsider },
  ])
  await Log.create([
    { family: ids.family, recipient: ids.grandpa, author: ids.jasmine, type: 'consultation', content: 'Continue the eye drops twice a day and review in 3 months.', consultation: { doctorName: 'Dr Lim', clinic: 'TTSH Eye Centre' } },
    { family: ids.family, recipient: ids.grandpa, author: ids.may, type: 'medication_change', content: 'Started new drops.', medicationChanges: [{ name: 'Eye drops', change: 'added', details: '2 drops, morning and night' }] },
    { family: ids.otherFamily, recipient: ids.otherRecipient, author: ids.outsider, type: 'general', content: 'Lee eye note' },
  ])
  await Recipient.create({ family: ids.otherFamily, name: 'Eyeleen Lee', careType: 'other' })
}

beforeEach(async () => {
  await resetFixtures()
  tokens = {}
  for (const [name, email] of Object.entries(accounts)) {
    const login = await request('/auth/login', { method: 'POST', body: { email, password } })
    assert.equal(login.status, 200)
    tokens[name] = login.data.token
  }
})

describe('Family search API', () => {
  it('only returns the selected family, even for a member of both families', async () => {
    await seedEyeData()
    // alex belongs to both families; the family id in the query string is ignored
    const result = await search({ q: 'eye', limit: 50, family: ids.otherFamily })
    assert.equal(result.status, 200)
    const text = JSON.stringify(result.data)
    for (const leak of ['Lee', 'Eyeleen', ids.otherRecipient, ids.otherFamily]) assert.ok(!text.includes(leak), `found ${leak}`)
    assert.deepEqual(result.data.counts, { all: 6, tasks: 3, logs: 2, people: 0, places: 1 })
    // Cancelled tasks are left out
    assert.ok(!result.data.results.tasks.some(task => task.title === 'Old eye appointment'))

    const other = await request(`/families/${ids.otherFamily}/search?q=eye&limit=50`)
    assert.ok(!JSON.stringify(other.data).includes('Collect eye drops'))
    assert.equal(other.data.counts.tasks, 1)
    assert.equal((await search({ q: 'eye' }, { user: 'outsider' })).status, 403)
  })

  it('treats regex characters in the search literally', async () => {
    await Task.create({ family: ids.family, title: 'Eye (left) check?', startAt: inDays(1), createdBy: ids.alex })
    const literal = await search({ q: '(left) check?' })
    assert.equal(literal.status, 200)
    assert.equal(literal.data.counts.tasks, 1)
    for (const q of ['.*', '.+', '[a-z]+', '^C', 'a|b']) {
      const result = await search({ q })
      assert.equal(result.status, 200, q)
      assert.equal(result.data.counts.all, 0, q)
    }
  })

  it('returns only the requested type, while counts cover every type', async () => {
    await seedEyeData()
    const counts = { all: 6, tasks: 3, logs: 2, people: 0, places: 1 }
    for (const type of ['tasks', 'logs', 'people', 'places']) {
      const result = await search({ q: 'eye', type, limit: 50 })
      assert.equal(result.status, 200)
      assert.deepEqual(result.data.counts, counts)
      for (const [group, list] of Object.entries(result.data.results)) {
        assert.equal(list.length, group === type ? counts[group] : 0, `${type}: ${group}`)
      }
    }
    const people = await search({ q: 'jasm', type: 'people' })
    assert.deepEqual(people.data.results.people.map(person => [person.kind, person.name]), [['member', 'Jasmine']])
    const recipients = await search({ q: 'grandpa', type: 'people' })
    assert.equal(recipients.data.results.people[0].kind, 'recipient')
  })

  it('shapes results for the dropdown: best match first, snippets, places and filters', async () => {
    await seedEyeData()
    const { data } = await search({ q: 'eye check-up', limit: 50 })
    // Exact title first, the upcoming one before the past one
    assert.equal(data.results.tasks[0].title, 'Eye check-up')
    assert.ok(new Date(data.results.tasks[0].startAt) > new Date())
    assert.equal(data.results.tasks[1].claimedBy.name, 'Jasmine')
    assert.equal(data.results.tasks[0].recipient.name, 'Grandpa')

    const eye = (await search({ q: 'eye', limit: 50 })).data
    const consultation = eye.results.logs.find(log => log.type === 'consultation')
    assert.equal(consultation.doctorName, 'Dr Lim')
    assert.equal(consultation.author.name, 'Jasmine')
    const place = eye.results.places[0]
    assert.deepEqual([place.name, place.postal, place.taskCount, place.usualFor?.name], ['TTSH Eye Centre', '308433', 2, 'Grandpa'])

    assert.equal((await search({ q: 'eye', status: 'completed', limit: 50 })).data.counts.tasks, 1)
    assert.equal((await search({ q: 'eye', when: 'upcoming', limit: 50 })).data.counts.tasks, 2)
    assert.equal((await search({ q: 'eye', when: 'past30', limit: 50 })).data.counts.tasks, 1)
    assert.equal((await search({ q: 'eye', limit: 1 })).data.results.tasks.length, 1)
  })

  it('rejects a search shorter than 2 characters and invalid filters', async () => {
    for (const params of [{}, { q: 'e' }, { q: '   e  ' }, { q: 'x'.repeat(81) }, { q: 'eye', type: 'secrets' },
      { q: 'eye', recipient: 'not-an-id' }, { q: 'eye', limit: 500 }, { q: 'eye', sort: 'random' }]) {
      const result = await search(params)
      assert.equal(result.status, 400, JSON.stringify(params))
      assert.ok(result.data.error)
    }
  })

  it('cuts long notes into a snippet around the first match', () => {
    const text = `${'Before the visit we talked about many things. '.repeat(4)}Remember the eye drops tonight. ${'After that we went home and had dinner together. '.repeat(4)}`
    const snippet = makeSnippet(text, 'eye drops')
    assert.ok(snippet.length <= 122)
    assert.ok(snippet.startsWith('…') && snippet.endsWith('…'))
    assert.ok(snippet.includes('eye drops'))
    assert.equal(makeSnippet('Short note about eyes', 'eye'), 'Short note about eyes')
  })
})
