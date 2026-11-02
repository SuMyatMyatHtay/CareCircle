import test from 'node:test'
import assert from 'node:assert/strict'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Family from '../../server/src/features/families/Family.model.js'
import { deleteOverdueTasks, deleteTask } from '../../server/src/features/tasks/controller.js'
import { updateTaskPermissions } from '../../server/src/features/families/settings.controller.js'
const req = (role = 'member', permission) => ({ memberRole: role, family: { _id: 'family', overdueTaskDeletion: permission }, user: { userId: 'creator' }, params: { taskId: '000000000000000000000001' } })
const response = () => ({ code: 200, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
test('missing permission defaults to admin only for bulk deletion', async t => {
  t.mock.method(Task, 'find', () => { throw new Error('Must not query tasks') })
  const res = response()
  await deleteOverdueTasks(req(), res, error => { throw error })
  assert.equal(res.code, 403)
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
test('creator cannot bypass overdue permission through individual deletion', async t => {
  t.mock.method(Task, 'getTaskInFamily', async () => ({ createdBy: 'creator', status: 'open', startAt: new Date(0) }))
  const res = response()
  await deleteTask(req(), res, error => { throw error })
  assert.equal(res.code, 403)
})
test('invalid permission is rejected', async () => {
  const res = response()
  await updateTaskPermissions({ ...req('admin'), body: { overdueTaskDeletion: 'everyone' } }, res, error => { throw error })
  assert.equal(res.code, 400)
})
test('permission write requires current admin membership', async t => {
  let filter
  t.mock.method(Family, 'findOneAndUpdate', async value => { filter = value; return null })
  const res = response()
  await updateTaskPermissions({ ...req(), body: { overdueTaskDeletion: 'member' } }, res, error => { throw error })
  assert.equal(filter.members.$elemMatch.role, 'admin')
  assert.equal(res.code, 403)
})
