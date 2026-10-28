// Service tests use a serializable in-memory transaction double; actual MongoDB
// write-conflict/retry behavior still requires a replica-set integration run.
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from '../../server/node_modules/mongoose/index.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Series from '../../server/src/features/tasks/RecurringSeries.model.js'
import Family from '../../server/src/features/families/Family.model.js'
import { createRecurringTasks, changeRecurringClaim, ensureRecurringTasks, updateRecurringTasks, deleteRecurringOccurrence, setSeriesPaused } from '../../server/src/features/tasks/recurringService.js'

const family = '000000000000000000000001', creator = '000000000000000000000002', helper = '000000000000000000000003', backup = '000000000000000000000004'
let tasks, series, counter, members
const copy = value => value == null ? value : value instanceof Date ? new Date(value) : Array.isArray(value) ? value.map(copy) : value?._bsontype === 'ObjectId' ? String(value) : typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, copy(v)])) : value
function matches(doc, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key]
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) return Object.entries(expected).every(([op, val]) => op === '$in' ? val.map(String).includes(String(actual)) : op === '$nin' ? !val.map(String).includes(String(actual)) : op === '$gt' ? actual > val : op === '$gte' ? actual >= val : false)
    return actual instanceof Date || expected instanceof Date ? +new Date(actual) === +new Date(expected) : String(actual) === String(expected)
  })
}
function query(read) {
  let sorting, max = Infinity
  const q = { session() { return q }, select() { return q }, populate() { return q }, lean() { return q }, sort(value) { sorting = value; return q }, limit(value) { max = value; return q }, then(resolve, reject) {
    return Promise.resolve().then(() => {
      let result = read()
      if (Array.isArray(result)) {
        if (sorting) { const [key, order] = Object.entries(sorting)[0]; result.sort((a, b) => (a[key] > b[key] ? 1 : -1) * order) }
        result = result.slice(0, max)
      }
      return result
    }).then(resolve, reject)
  } }
  return q
}
function taskDoc(raw) { return raw ? Object.assign(copy(raw), { toObject() { return copy(this) } }) : null }
function seriesDoc(raw) { return raw ? Object.assign(copy(raw), { async save() { series.set(String(this._id), copy(this)); return this } }) : null }
function update(doc, change) { Object.assign(doc, copy(change.$set || {})); for (const [k, v] of Object.entries(change.$inc || {})) doc[k] += v; doc.updatedAt = new Date(+doc.updatedAt + 1) }
beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T00:00:00Z') })
  tasks = new Map(); series = new Map(); counter = 100; members = new Set([creator, helper, backup])
  let queue = Promise.resolve()
  t.mock.method(mongoose, 'startSession', async () => ({ endSession: async () => {}, withTransaction(work) {
    const run = queue.then(async () => { const beforeTasks = copy([...tasks]), beforeSeries = copy([...series]); try { return await work() } catch (err) { tasks = new Map(beforeTasks); series = new Map(beforeSeries); throw err } })
    queue = run.catch(() => {}); return run
  } }))
  t.mock.method(Family, 'exists', filter => query(() => members.has(String(filter['members.userId'])) ? { _id: family } : null))
  t.mock.method(Family, 'findOne', filter => query(() => members.has(String(filter['members.userId'])) ? { _id: family } : null))
  t.mock.method(Series, 'create', async ([data]) => {
    const doc = copy(new Series(data).toObject()); series.set(doc._id, doc); return [seriesDoc(doc)]
  })
  t.mock.method(Series, 'find', filter => query(() => [...series.values()].filter(d => matches(d, filter)).map(seriesDoc)))
  t.mock.method(Series, 'findOneAndUpdate', (filter, changes) => query(() => { const found = [...series.values()].find(d => matches(d, filter)); if (!found) return null; update(found, changes); return seriesDoc(found) }))
  t.mock.method(Task, 'find', filter => query(() => [...tasks.values()].filter(d => matches(d, filter)).map(taskDoc)))
  t.mock.method(Task, 'findOne', filter => query(() => taskDoc([...tasks.values()].find(d => matches(d, filter)))))
  t.mock.method(Task, 'findById', id => query(() => taskDoc(tasks.get(String(id)))))
  t.mock.method(Task, 'getPopulatedTaskById', async id => taskDoc(tasks.get(String(id))))
  t.mock.method(Task, 'insertMany', async documents => {
    for (const data of documents) {
      const model = new Task({ ...data, _id: (++counter).toString(16).padStart(24, '0') }); await model.validate()
      const doc = copy(model.toObject()); doc.updatedAt = new Date(); tasks.set(doc._id, doc)
    }
  })
  for (const method of ['updateOne', 'updateMany']) t.mock.method(Task, method, async (filter, changes) => {
    let count = 0
    for (const doc of tasks.values()) if (matches(doc, filter)) { update(doc, changes); count++; if (method === 'updateOne') break }
    return { modifiedCount: count }
  })
  t.mock.method(Task, 'deleteOne', async filter => { const doc = [...tasks.values()].find(d => matches(d, filter)); if (doc) tasks.delete(doc._id); return { deletedCount: doc ? 1 : 0 } })
})
const all = () => [...tasks.values()].sort((a, b) => a.occurrenceIndex - b.occurrenceIndex)
const claim = (task, userId = helper, scope = 'series') => changeRecurringClaim('claim', { taskId: task._id, familyId: family, userId, scope })
async function create(never = false) { return createRecurringTasks({ title: 'Physiotherapy', category: 'therapy', startAt: new Date('2026-11-03T06:30:00Z'), endAt: new Date('2026-11-03T07:30:00Z') }, { frequency: 'daily', end: never ? { mode: 'never' } : { mode: 'after', count: 8 } }, family, creator) }

test('series claim, one-date release, and replacement never transfer the rest of the series', async () => {
  const first = await create(); await claim(first)
  assert.ok(all().every(t => t.status === 'claimed' && t.claimedBy === helper))
  const released = all()[2]
  await changeRecurringClaim('unclaim', { taskId: released._id, familyId: family, userId: helper })
  assert.equal(tasks.get(released._id).recurrenceDetached, true)
  await claim(released, backup, 'series')
  assert.equal(tasks.get(released._id).claimedBy, backup)
  assert.ok(all().filter(t => t._id !== released._id).every(t => t.claimedBy === helper))
})
test('simultaneous whole-series claims have one winner and no split assignment', async () => {
  const first = await create()
  const results = await Promise.allSettled([claim(first), claim(first, backup)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409)
  assert.equal(new Set(all().map(t => t.claimedBy)).size, 1)
})
test('next four and just this date remain independent of the usual helper', async () => {
  const first = await create(); await claim(first, helper, 'next4')
  assert.equal(all().filter(t => t.claimedBy === helper && t.recurrenceDetached).length, 4)
  await claim(all()[4], backup)
  assert.equal(all().filter(t => t.claimedBy === backup).length, 4)
})
test('Never extends the rolling window without duplicates, retaining the usual helper', async t => {
  const first = await create(true); await claim(first)
  const original = all().length
  t.mock.timers.tick(14 * 86400000)
  await ensureRecurringTasks(family)
  assert.ok(all().length > original)
  assert.ok(all().slice(original).every(t => t.claimedBy === helper))
  const total = all().length; await ensureRecurringTasks(family); assert.equal(all().length, total)
})
test('pause/resume preserves detached dates, completed work and ownership', async () => {
  const first = await create(); await claim(first)
  await changeRecurringClaim('unclaim', { taskId: all()[1]._id, familyId: family, userId: helper })
  tasks.get(first._id).status = 'completed'
  await assert.rejects(setSeriesPaused(first.recurringSeries, family, helper, true), { status: 403 })
  await setSeriesPaused(first.recurringSeries, family, creator, true)
  assert.equal(all()[0].status, 'completed'); assert.equal(all()[1].status, 'open')
  assert.ok(all().slice(2).every(t => t.status === 'cancelled' && t.recurrencePaused))
  await setSeriesPaused(first.recurringSeries, family, creator, false)
  assert.ok(all().slice(2).every(t => t.status === 'claimed' && t.claimedBy === helper))
})
test('scoped edits preserve exceptions and history, and carry into generated sessions', async t => {
  await create(true)
  await claim(all()[1], helper, 'one')
  tasks.get(all()[0]._id).status = 'completed'
  await updateRecurringTasks(taskDoc(all()[2]), { title: 'New therapy time' }, 'future')
  assert.equal(all()[0].title, 'Physiotherapy'); assert.equal(all()[1].title, 'Physiotherapy')
  assert.ok(all().slice(2).every(t => t.title === 'New therapy time'))
  const length = all().length; t.mock.timers.tick(14 * 86400000); await ensureRecurringTasks(family)
  assert.ok(all().slice(length).every(t => t.title === 'New therapy time'))
})
test('deleted occurrences never regenerate and departed helpers release attached future dates', async () => {
  const first = await create(true); await claim(first)
  await deleteRecurringOccurrence(taskDoc(all()[1]))
  members.delete(helper)
  await ensureRecurringTasks(family)
  assert.ok(!all().some(t => t.occurrenceIndex === 1))
  assert.ok(all().every(t => t.status === 'open' && !t.claimedBy))
  assert.equal([...series.values()][0].usualHelper, null)
})
test('overdue and cross-family claims are rejected without assigning tasks', async t => {
  const first = await create()
  await assert.rejects(changeRecurringClaim('claim', { taskId: first._id, familyId: creator, userId: helper }), { status: 404 })
  t.mock.timers.tick(4 * 86400000)
  await assert.rejects(claim(first), { status: 409 })
  assert.ok(all().every(t => t.status === 'open'))
})

test('time edits shift each future date separately and preserve duration', async () => {
  await create()
  const before = all().map(copy), selected = taskDoc(all()[3])
  await updateRecurringTasks(selected, { startAt: new Date(+selected.startAt + 1800000) }, 'future')
  for (let index = 0; index < all().length; index++) {
    assert.equal(+all()[index].startAt - +before[index].startAt, index >= 3 ? 1800000 : 0)
    assert.equal(all()[index].endAt - all()[index].startAt, 3600000)
  }
})
test('stale edits and invalid series date moves roll back without partial changes', async () => {
  await create()
  const selected = taskDoc(all()[2]), before = all().map(copy)
  await assert.rejects(updateRecurringTasks(selected, { title: 'Stale' }, 'all', new Date(0)), { status: 409 })
  await assert.rejects(updateRecurringTasks(selected, { startAt: new Date(+selected.startAt + 86400000) }, 'all'), { status: 400 })
  assert.deepEqual(all(), before)
})
