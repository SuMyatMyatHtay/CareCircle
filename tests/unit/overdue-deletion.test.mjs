import test from 'node:test'
import assert from 'node:assert/strict'
import User from '../../server/src/features/auth/User.model.js'
import Notification from '../../server/src/features/notifications/Notifications.model.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Family from '../../server/src/features/families/Family.model.js'
import { deleteOverdueTasks, deleteTask } from '../../server/src/features/tasks/controller.js'
import { updateRecipientPermissions } from '../../server/src/features/families/settings.controller.js'
const req = (role = 'member', permission) => ({ memberRole: role, family: { _id: 'family', recipientDeletion: permission, members: [{ userId: 'creator', role }] }, user: { userId: 'creator' }, params: { taskId: '000000000000000000000001' } })
const response = () => ({ code: 200, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
test('members bulk-delete only their own tasks regardless of recipient permission', async t => {
  let filter
  t.mock.method(Task, 'find', async value => { filter = value; return [] })
  const res = response()
  await deleteOverdueTasks(req(), res, error => { throw error })
  assert.equal(res.code, 200)
  assert.equal(filter.createdBy, 'creator')
})
for (const [role, permission] of [['admin', undefined], ['member', 'member']]) {
  test(`${role} can bulk delete when allowed, scoped to overdue open tasks`, async t => {
    let filter
    t.mock.method(Task, 'find', async value => { filter = value; return [] })
    const res = response()
    await deleteOverdueTasks(req(role, permission), res, error => { throw error })
    assert.equal(res.code, 200)
    assert.equal(filter.family, 'family')
    assert.equal(filter.status, 'open')
    assert.ok(filter.startAt.$lte instanceof Date)
    assert.equal(res.body.deletedCount, 0)
  })
}
test('an unrelated member cannot individually delete another creators overdue task', async t => {
  t.mock.method(Task, 'getTaskInFamily', async () => ({ createdBy: 'someone-else', status: 'open', startAt: new Date(0) }))
  t.mock.method(Family, 'findById', async () => ({ recipientDeletion: 'member', members: [{ userId: 'creator', role: 'member' }] }))
  const res = response()
  await deleteTask(req(), res, error => { throw error })
  assert.equal(res.code, 403)
})

test('invalid permission is rejected', async () => {
  const res = response()
  await updateRecipientPermissions({ ...req('admin'), body: { recipientDeletion: 'everyone' } }, res, error => { throw error })
  assert.equal(res.code, 400)
})
test('permission write requires current admin membership', async t => {
  let filter
  t.mock.method(Family, 'findOneAndUpdate', async value => { filter = value; return null })
  const res = response()
  await updateRecipientPermissions({ ...req(), body: { recipientDeletion: 'member' } }, res, error => { throw error })
  assert.equal(filter.members.$elemMatch.role, 'admin')
  assert.equal(res.code, 403)
})

test('selected deletion scopes IDs while preserving family, status and deadline filters', async t => {
  const id = '000000000000000000000001'
  let filter
  t.mock.method(Task, 'find', async value => { filter = value; return [] })
  const res = response()
  await deleteOverdueTasks({ ...req('admin'), body: { taskIds: [id, id] } }, res, error => { throw error })
  assert.equal(res.code, 200)
  assert.deepEqual(filter._id, { $in: [id] })
  assert.equal(filter.family, 'family')
  assert.equal(filter.status, 'open')
  assert.ok(filter.startAt.$lte instanceof Date)
})
for (const taskIds of [[], ['invalid'], 'all', [null]]) {
  test(`rejects invalid selection ${JSON.stringify(taskIds)} without deleting everything`, async t => {
    t.mock.method(Task, 'find', () => { throw new Error('Must not query tasks') })
    const res = response()
    await deleteOverdueTasks({ ...req('admin'), body: { taskIds } }, res, error => { throw error })
    assert.equal(res.code, 400)
  })
}

test('bulk deletion records one summary naming the deleter and the actual deleted count', async t => {
  const familyId = '000000000000000000000010'
  const tasks = [1, 2, 3].map(id => ({ _id: String(id), updatedAt: new Date() }))
  const notifications = []
  t.mock.method(Task, 'find', async () => tasks)
  t.mock.method(Task, 'deleteOne', async filter => ({ deletedCount: filter._id === '3' ? 0 : 1 }))
  t.mock.method(Task, 'getPopulatedTaskById', () => { throw new Error('Must not create individual task updates') })
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ name: 'Jasmine Tan' }) }) }))
  t.mock.method(Family, 'findById', () => ({ select: () => ({ lean: async () => ({ telegram: {} }) }) }))
  t.mock.method(Notification, 'create', async record => { notifications.push(record); return record })
  const res = response()
  await deleteOverdueTasks({ ...req('admin'), family: { ...req('admin').family, _id: familyId } }, res, error => { throw error })
  assert.equal(res.code, 200)
  assert.equal(res.body.deletedCount, 2)
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].text, 'Jasmine deleted 2 overdue tasks.')
  assert.equal(notifications[0].refId, undefined)
})
