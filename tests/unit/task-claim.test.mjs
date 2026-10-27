import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Family from '../../server/src/features/families/Family.model.js'
import { claimTask, unclaimTask, startTask } from '../../server/src/features/tasks/controller.js'

const familyId = '000000000000000000000001', taskId = '000000000000000000000002'
const creator = '000000000000000000000003', member = '000000000000000000000004'
let stored, transit
beforeEach(t => {
  t.mock.method(Family, 'findById', () => ({ select: () => ({ lean: async () => null }) }))
  stored = { _id: taskId, family: familyId, createdBy: creator, claimedBy: null, status: 'open', needsTransit: true, startAt: new Date(Date.now() + 3600000) }
  transit = []
  t.mock.method(Task, 'getTaskInFamily', async (family, id) => family === stored.family && id === stored._id ? { ...stored } : null)
  t.mock.method(Task, 'getTaskById', async () => ({ ...stored }))
  t.mock.method(Task, 'getPopulatedTaskById', async () => ({ ...stored, claimedBy: stored.claimedBy ? { _id: stored.claimedBy, name: 'Helper' } : null }))
  // Exercise the actual updateTaskStatus static, including its compare-and-set filter.
  t.mock.method(Task, 'findOneAndUpdate', async (filter, update) => {
    if (!Object.entries(filter).every(([key, value]) => value?.$gt ? new Date(stored[key]) > value.$gt : stored[key] === value)) return null
    Object.assign(stored, update.$set)
    return { ...stored }
  })
  t.mock.method(Task, 'startTransitSession', async task => {
    const session = { _id: 'trip', task: task._id, family: task.family, companion: task.claimedBy, status: 'active' }
    transit.push(session)
    return session
  })
})
async function invoke(handler, userId = member, family = familyId) {
  let status = 200, data
  const res = { status(value) { status = value; return this }, json(value) { data = value; return this } }
  await handler({ family: { _id: family }, params: { taskId }, user: { userId }, memberRole: 'member' }, res, error => { throw error })
  return { status, data }
}
test('member claims a real task then starts transit as its companion', async () => {
  const claimed = await invoke(claimTask)
  assert.equal(claimed.status, 200)
  assert.equal(claimed.data.task.claimedBy._id, member)
  assert.ok(stored.claimedAt instanceof Date)
  const started = await invoke(startTask)
  assert.equal(started.status, 200)
  assert.equal(stored.status, 'in_progress')
  assert.equal(started.data.transitSession.companion, member)
  assert.equal(transit.length, 1)
})
test('simultaneous claims have exactly one winner', async () => {
  const results = await Promise.all([invoke(claimTask, member), invoke(claimTask, creator)])
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  const winner = results.find(r => r.status === 200).data.task.claimedBy._id
  assert.equal(stored.claimedBy, winner)
})
test('another family cannot claim a task and only the claimer can start its trip', async () => {
  assert.equal((await invoke(claimTask, member, '000000000000000000000099')).status, 404)
  await invoke(claimTask)
  assert.equal((await invoke(startTask, creator)).status, 403)
  assert.equal(transit.length, 0)
})

test('overdue tasks reject claims without changing the assignment', async () => {
  stored.startAt = new Date(Date.now() - 1)
  const result = await invoke(claimTask)
  assert.equal(result.status, 409)
  assert.match(result.data.error, /overdue/)
  assert.equal(stored.status, 'open')
  assert.equal(stored.claimedBy, null)
})

test('claim checks the deadline atomically if it expires after the initial read', async t => {
  const originalRead = Task.getTaskInFamily
  t.mock.method(Task, 'getTaskInFamily', async (...args) => {
    const snapshot = await originalRead(...args)
    stored.startAt = new Date(Date.now() - 1000)
    return snapshot
  })
  const result = await invoke(claimTask)
  assert.equal(result.status, 409)
  assert.match(result.data.error, /overdue/)
  assert.equal(stored.claimedBy, null)
})

test('claimer can unclaim and another member can then claim, but strangers cannot unclaim', async () => {
  await invoke(claimTask)
  assert.equal((await invoke(unclaimTask, '000000000000000000000099')).status, 403)
  assert.equal((await invoke(unclaimTask)).status, 200)
  assert.equal(stored.claimedBy, null)
  assert.equal(stored.claimedAt, null)
  assert.equal((await invoke(claimTask, creator)).status, 200)
  assert.equal(stored.claimedBy, creator)
  assert.equal((await invoke(claimTask, member)).status, 409)
})

test('unclaim remains available after the deadline, but nobody can reclaim the expired task', async () => {
  await invoke(claimTask)
  stored.startAt = new Date(Date.now() - 1000)
  assert.equal((await invoke(unclaimTask)).status, 200)
  assert.equal((await invoke(claimTask, creator)).status, 409)
})

test('task creator can release a claim, and in-progress tasks cannot be unclaimed', async () => {
  await invoke(claimTask)
  assert.equal((await invoke(unclaimTask, creator)).status, 200)
  await invoke(claimTask)
  await invoke(startTask)
  assert.equal((await invoke(unclaimTask)).status, 409)
})
