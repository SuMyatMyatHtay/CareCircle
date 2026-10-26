// Owner: Chaithra (E) · API/DB integration tests for My Tasks & Transit
// Real Express routes + JWT login + Mongoose + an isolated MongoDB (never the shared Atlas DB).
// Uses SangYoon's test database helpers; extra trip data comes from transit-fixtures.js.
import { before, beforeEach, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../server/src/app.js'
import { startTestDatabase } from '../../server/test/support/database.js'
import { accounts, password } from '../../server/test/support/fixtures.js'
import { resetTransitFixtures, transitIds as ids, TTSH, NEAR_TTSH } from '../../server/test/support/transit-fixtures.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import TransitSession from '../../server/src/features/journeys/Journey.model.js'

let database, server, base, tokens
before(async () => {
  database = await startTestDatabase('transit')
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
  await resetTransitFixtures()
  tokens = {}
  for (const [name, email] of Object.entries(accounts)) {
    const login = await request('/auth/login', { method: 'POST', authenticated: false, body: { email, password } })
    assert.equal(login.status, 200)
    tokens[name] = login.data.token
  }
})

const task = `/families/${ids.family}/tasks/${ids.tripTask}`
const transit = `${task}/transit`
const startTrip = () => request(`${task}/start`, { method: 'POST' })
const post = (body, user = 'alex') => request(`${transit}/milestones`, { method: 'POST', user, body })

describe('Transit APIs with Express, authentication and a real isolated MongoDB', () => {
  it('starting a claimed trip task creates a live trip for the claimer', async () => {
    assert.equal((await request(transit)).status, 404) // no trip before starting
    const started = await startTrip()
    assert.equal(started.status, 200)
    assert.equal(started.data.task.status, 'in_progress')
    assert.equal(started.data.transitSession.status, 'active')
    assert.equal(String(started.data.transitSession.companion), ids.alex)

    const fetched = await request(transit, { user: 'jasmine' }) // any family member can follow
    assert.equal(fetched.status, 200)
    assert.equal(fetched.data.transitSession.companion.name, 'Alex Tan')
    assert.equal(fetched.data.transitSession.task.title, 'Physio at TTSH')
  })

  it('saves updates in order with the server\'s time, and fills in preset labels', async () => {
    await startTrip()
    const before = Date.now()
    assert.equal((await post({ type: 'departed' })).status, 201)
    const second = await post({ type: 'custom', label: '  Stuck in traffic  ', at: '2000-01-01T00:00:00Z' })
    assert.equal(second.status, 201)

    const steps = second.data.transitSession.milestones
    assert.deepEqual(steps.map(s => s.label), ['Departed home', 'Stuck in traffic'])
    // The time a person sends is ignored: the server sets it
    assert.ok(new Date(steps[1].at).getTime() >= before)
  })

  it('rejects an unknown step type and an empty custom update', async () => {
    await startTrip()
    const wrongType = await post({ type: 'teleported' })
    assert.equal(wrongType.status, 400)
    assert.match(wrongType.data.errors[0], /Type must be one of/)
    const empty = await post({ type: 'custom', label: '   ' })
    assert.equal(empty.status, 400)
    assert.deepEqual(empty.data.errors, ['Please type what is happening'])
    const tooLong = await post({ type: 'custom', label: 'x'.repeat(81) })
    assert.equal(tooLong.status, 400)
    assert.equal((await TransitSession.findOne({ task: ids.tripTask })).milestones.length, 0)
  })

  it('only the person on the trip can post, end, remove or share location', async () => {
    await startTrip()
    await post({ type: 'departed' })
    assert.equal((await post({ type: 'arrived' }, 'jasmine')).status, 403)
    assert.equal((await request(`${transit}/end`, { method: 'POST', user: 'jasmine' })).status, 403)
    assert.equal((await request(`${transit}/location`, { method: 'PATCH', user: 'may', body: TTSH })).status, 403)
    const at = (await TransitSession.findOne({ task: ids.tripTask })).milestones[0].at.toISOString()
    assert.equal((await request(`${transit}/milestones?at=${encodeURIComponent(at)}`, { method: 'DELETE', user: 'jasmine' })).status, 403)
    assert.equal((await TransitSession.findOne({ task: ids.tripTask })).milestones.length, 1)
  })

  it('people outside the family cannot see or change the trip', async () => {
    await startTrip()
    assert.equal((await request(transit, { user: 'outsider' })).status, 403)
    assert.equal((await post({ type: 'arrived' }, 'outsider')).status, 403)
    assert.equal((await request(transit, { authenticated: false })).status, 401)
  })

  it('removes a wrong update, but never "Safely back home"', async () => {
    await startTrip()
    await post({ type: 'departed' })
    const wrong = await post({ type: 'custom', label: 'asdfgh' })
    const at = wrong.data.transitSession.milestones[1].at

    const removed = await request(`${transit}/milestones?at=${encodeURIComponent(at)}`, { method: 'DELETE' })
    assert.equal(removed.status, 200)
    assert.deepEqual(removed.data.transitSession.milestones.map(s => s.label), ['Departed home'])
    assert.equal((await request(`${transit}/milestones?at=${encodeURIComponent(at)}`, { method: 'DELETE' })).status, 404)
    assert.equal((await request(`${transit}/milestones?at=not-a-date`, { method: 'DELETE' })).status, 400)

    const home = await post({ type: 'home' })
    const homeAt = home.data.transitSession.milestones.at(-1).at
    const blocked = await request(`${transit}/milestones?at=${encodeURIComponent(homeAt)}`, { method: 'DELETE' })
    assert.equal(blocked.status, 409)
    assert.equal((await TransitSession.findOne({ task: ids.tripTask })).milestones.at(-1).type, 'home')
  })

  it('"Safely back home" completes the task and ends the trip; later updates are refused', async () => {
    await startTrip()
    await post({ type: 'departed' })
    const home = await post({ type: 'home' })
    assert.equal(home.status, 201)
    assert.equal(home.data.transitSession.status, 'ended')
    assert.equal(home.data.transitSession.milestones.at(-1).label, 'Safely back home')

    const saved = await Task.findById(ids.tripTask)
    assert.equal(saved.status, 'completed')
    assert.ok(saved.completedAt)
    assert.equal((await post({ type: 'arrived' })).status, 409)
  })

  it('"End the trip" keeps the task in progress, and the trip can be resumed', async () => {
    await startTrip()
    await post({ type: 'departed' })
    const ended = await request(`${transit}/end`, { method: 'POST' })
    assert.equal(ended.status, 200)
    assert.equal(ended.data.transitSession.status, 'ended')
    assert.equal((await Task.findById(ids.tripTask)).status, 'in_progress')
    assert.equal((await request(`${transit}/end`, { method: 'POST' })).status, 409)

    const resumed = await request(`${transit}/resume`, { method: 'POST' })
    assert.equal(resumed.status, 200)
    assert.equal(resumed.data.transitSession.status, 'active')
    assert.deepEqual(resumed.data.transitSession.milestones.map(s => s.type), ['departed']) // steps kept
    assert.equal((await request(`${transit}/resume`, { method: 'POST' })).status, 409)
  })

  it('a finished task\'s trip cannot be resumed', async () => {
    await startTrip()
    await post({ type: 'home' })
    const resumed = await request(`${transit}/resume`, { method: 'POST' })
    assert.equal(resumed.status, 409)
    assert.equal((await TransitSession.findOne({ task: ids.tripTask })).status, 'ended')
  })

  it('live location is saved as the latest spot and added to the trail', async () => {
    await startTrip()
    assert.equal((await request(`${transit}/location`, { method: 'PATCH', body: TTSH })).status, 200)
    assert.equal((await request(`${transit}/location`, { method: 'PATCH', body: NEAR_TTSH })).status, 200)

    const followed = await request(transit, { user: 'jasmine' })
    const trip = followed.data.transitSession
    assert.equal(trip.lastLocation.lat, NEAR_TTSH.lat)
    assert.deepEqual(trip.path.map(p => [p.lat, p.lng]), [[TTSH.lat, TTSH.lng], [NEAR_TTSH.lat, NEAR_TTSH.lng]])
  })

  it('rejects impossible coordinates and stops sharing once the trip ends', async () => {
    await startTrip()
    const bad = await request(`${transit}/location`, { method: 'PATCH', body: { lat: 200, lng: 'east' } })
    assert.equal(bad.status, 400)
    assert.equal(bad.data.errors.length, 2)
    await request(`${transit}/end`, { method: 'POST' })
    assert.equal((await request(`${transit}/location`, { method: 'PATCH', body: TTSH })).status, 409)
  })

  it('starting again clears the old trip\'s steps and trail', async () => {
    await startTrip()
    await post({ type: 'departed' })
    await request(`${transit}/location`, { method: 'PATCH', body: TTSH })
    await Task.updateOne({ _id: ids.tripTask }, { $set: { status: 'claimed' } }) // back to claimed
    const again = await startTrip()
    assert.equal(again.data.transitSession.milestones.length, 0)
    assert.equal(again.data.transitSession.path.length, 0)
    assert.equal(again.data.transitSession.lastLocation, undefined)
  })

  it('lists the family\'s live trips for the Family Home banner', async () => {
    assert.deepEqual((await request(`/families/${ids.family}/transit?status=active`, { user: 'may' })).data.transitSessions, [])
    await startTrip()
    const live = await request(`/families/${ids.family}/transit?status=active`, { user: 'may' })
    assert.equal(live.status, 200)
    assert.equal(live.data.transitSessions.length, 1)
    assert.equal(live.data.transitSessions[0].task.title, 'Physio at TTSH')
    assert.equal(live.data.transitSessions[0].task.recipient.name, 'Grandpa')
    assert.equal((await request(`/families/${ids.family}/transit?status=paused`)).status, 400)
    // Another family's banner never shows this trip
    const other = await request(`/families/${ids.otherFamily}/transit?status=active`)
    assert.deepEqual(other.data.transitSessions, [])
  })

  it('My Tasks: only the claimer\'s tasks come back for claimedBy=me', async () => {
    const mine = await request(`/families/${ids.family}/tasks?claimedBy=${ids.alex}`)
    assert.equal(mine.status, 200)
    const titles = mine.data.tasks.map(t => t.title)
    assert.ok(titles.includes('Physio at TTSH'))
    assert.ok(!titles.includes('Eye check')) // not claimed by anyone
  })
})
