import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { startApiHarness } from '../support/api-harness.mjs'
import { recurringTaskPayload } from '../support/recurring-fixtures.mjs'
import { ids } from '../../server/test/support/fixtures.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Series from '../../server/src/features/tasks/RecurringSeries.model.js'

let api
const path = `/families/${ids.family}/tasks`
before(async () => { api = await startApiHarness('recurring') }, { timeout: 180000 })
beforeEach(async () => { await api.reset() })
after(async () => { await api?.stop() })
const request = (...args) => api.request(...args)
async function create(options) {
  const result = await request(path, { method: 'POST', body: { ...recurringTaskPayload(options), recipient: ids.grandpa } })
  assert.equal(result.status, 201, JSON.stringify(result.data))
  return result.data.task
}
const occurrences = series => Task.find({ recurringSeries: series }).sort({ occurrenceIndex: 1 }).lean()
const action = (task, name, user = 'may', body) => request(`${path}/${task._id}/${name}`, { method: 'POST', user, body })

test('creation persists separate sessions and validates family, rule and permissions', async () => {
  const first = await create()
  assert.equal((await occurrences(first.recurringSeries)).length, 8)
  assert.equal((await Series.findById(first.recurringSeries)).rule.end.count, 8)
  assert.equal((await request(path, { method: 'POST', user: 'outsider', body: recurringTaskPayload() })).status, 403)
  assert.equal((await request(path, { method: 'POST', body: recurringTaskPayload({ count: 501 }) })).status, 400)
  assert.equal(await Series.countDocuments({ family: ids.family }), 1)
})
test('real concurrent transactions have exactly one series claimant', async () => {
  const first = await create()
  const results = await Promise.all([action(first, 'claim', 'may'), action(first, 'claim', 'jasmine')])
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  const winner = results.find(r => r.status === 200).data.task.claimedBy._id
  assert.ok((await occurrences(first.recurringSeries)).every(t => String(t.claimedBy) === winner && t.status === 'claimed'))
})
test('giving back a date and reclaiming it never steals the other sessions', async () => {
  const first = await create(); assert.equal((await action(first, 'claim')).status, 200)
  const day = (await occurrences(first.recurringSeries))[2]
  assert.equal((await action(day, 'unclaim', 'jasmine')).status, 403)
  assert.equal((await action(day, 'unclaim')).status, 200)
  assert.equal((await action(day, 'claim', 'jasmine', { scope: 'series' })).status, 200)
  const saved = await occurrences(first.recurringSeries)
  assert.equal(String(saved[2].claimedBy), ids.jasmine); assert.equal(saved[2].recurrenceDetached, true)
  assert.ok(saved.filter(t => t.occurrenceIndex !== 2).every(t => String(t.claimedBy) === ids.may))
})
test('next-four claims leave the rest open and protect against cross-family claims', async () => {
  const first = await create()
  assert.equal((await action(first, 'claim', 'may', { scope: 'next4' })).status, 200)
  const saved = await occurrences(first.recurringSeries)
  assert.equal(saved.filter(t => t.status === 'claimed' && t.recurrenceDetached).length, 4)
  assert.equal(saved.filter(t => t.status === 'open').length, 4)
  assert.equal((await request(`/families/${ids.otherFamily}/tasks/${first._id}/claim`, { method: 'POST' })).status, 404)
})
test('scoped editing preserves completed/independent dates and rejects stale versions', async () => {
  const first = await create()
  const saved = await occurrences(first.recurringSeries)
  await action(saved[1], 'claim', 'may', { scope: 'one' })
  await action(first, 'claim', 'alex', { scope: 'one' }); await action(first, 'complete', 'alex')
  const edit = { method: 'PATCH', body: { title: 'Updated recurring therapy', scope: 'all', expectedUpdatedAt: saved[2].updatedAt } }
  assert.equal((await request(`${path}/${saved[2]._id}`, { ...edit, user: 'may' })).status, 403)
  assert.equal((await request(`${path}/${saved[2]._id}`, edit)).status, 200)
  const result = await occurrences(first.recurringSeries)
  assert.equal(result[0].title, first.title); assert.equal(result[1].title, first.title)
  assert.ok(result.slice(2).every(t => t.title === edit.body.title))
  assert.equal((await request(`${path}/${saved[2]._id}`, edit)).status, 409)
})
test('pause/resume preserves one-date openings and deleted dates do not regenerate', async () => {
  const first = await create({ never: true }); await action(first, 'claim')
  let saved = await occurrences(first.recurringSeries)
  await action(saved[1], 'unclaim')
  const seriesPath = `${path}/recurring/${first.recurringSeries}`
  assert.equal((await request(seriesPath, { method: 'PATCH', user: 'may', body: { paused: true } })).status, 403)
  assert.equal((await request(seriesPath, { method: 'PATCH', body: { paused: true } })).status, 200)
  saved = await occurrences(first.recurringSeries)
  assert.equal(saved[1].status, 'open'); assert.equal(saved[2].recurrencePaused, true)
  await request(seriesPath, { method: 'PATCH', body: { paused: false } })
  assert.equal((await Task.findById(saved[2]._id)).status, 'claimed')
  assert.equal((await request(`${path}/${saved[2]._id}`, { method: 'DELETE' })).status, 200)
  await Series.updateOne({ _id: first.recurringSeries }, { $set: { generatedThrough: null } })
  assert.equal((await request(path)).status, 200)
  assert.equal(await Task.findById(saved[2]._id), null)
  assert.equal(await Task.countDocuments({ recurringSeries: first.recurringSeries, occurrenceIndex: 2 }), 0)
})
test('rolling generation retains ownership without duplicate occurrence indexes', async () => {
  const first = await create({ never: true }); await action(first, 'claim')
  // Simulate a gap at the edge of the materialized window, then exercise real read generation.
  const last = (await occurrences(first.recurringSeries)).at(-1)
  await Task.deleteOne({ _id: last._id })
  await Series.updateOne({ _id: first.recurringSeries }, { $set: { generatedThrough: null } })
  await request(path); await request(path)
  const saved = await occurrences(first.recurringSeries)
  assert.equal(saved.filter(t => t.occurrenceIndex === last.occurrenceIndex).length, 1)
  assert.ok(saved.every(t => String(t.claimedBy) === ids.may))
})
