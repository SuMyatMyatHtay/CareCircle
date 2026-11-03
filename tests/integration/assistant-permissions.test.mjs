import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { startApiHarness } from '../support/api-harness.mjs'
import { ids } from '../../server/test/support/fixtures.js'
import { recurringTaskPayload } from '../support/recurring-fixtures.mjs'
import { chat } from '../../server/src/features/assistant/service.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Family from '../../server/src/features/families/Family.model.js'
import Series from '../../server/src/features/tasks/RecurringSeries.model.js'
import Proposal from '../../server/src/features/assistant/Proposal.model.js'
import Notification from '../../server/src/features/notifications/Notifications.model.js'
let api
before(async () => { api = await startApiHarness('assistant_permissions') }, { timeout: 180000 })
beforeEach(async () => { await api.reset() })
after(async () => { await api?.stop() })
const family = `/families/${ids.family}`
async function makeTask({ createdBy = ids.may, familyId = ids.family, status = 'open', future = false } = {}) {
  return Task.create({ family: familyId, createdBy, status, title: 'Permission audit task', startAt: new Date(Date.now() + (future ? 86400000 : -3600000)) })
}
async function draft(task, user = 'may', options = {}) {
  return chat({ body: { selectedTaskId: String(task._id), messages: [{ role: 'user', content: 'Delete this task' }] },
    familyId: task.family, familyName: 'Family', userId: ids[user], memberRole: user === 'may' ? 'member' : 'admin',
    generate: async request => { options.capture?.(request.context); return { intent: 'delete', taskId: String(task._id), message: 'Review', suggestions: [] } } })
}
const confirm = (proposal, user = 'may', familyId = ids.family) => api.request(`/families/${familyId}/assistant/proposals/${proposal.id}/confirm`, { method: 'POST', user, body: {} })
const setPermission = value => api.request(`${family}/recipient-permissions`, { method: 'PATCH', body: { recipientDeletion: value } })
const notes = () => Notification.find({ family: ids.family, eventType: 'task.deleted' }).lean()

test('a creator can delete their own overdue task with the default recipient setting', async () => {
  const task = await makeTask()
  let context
  const { proposal } = await draft(task, 'may', { capture: value => { context = value } })
  assert.equal(context.permissions.taskDeletion, 'admin_or_creator')
  assert.equal(context.selectedTask.canDelete, true)
  assert.equal((await confirm(proposal)).data.requiresSecondConfirmation, true)
  assert.equal((await confirm(proposal)).status, 200)
  assert.equal(await Task.findById(task._id), null)
})

test('creator can delete an overdue task with two confirmations and one actor/count summary', async () => {
  await setPermission('member')
  const task = await makeTask()
  let context
  const { proposal } = await draft(task, 'may', { capture: value => { context = value } })
  assert.equal(context.permissions.taskDeletion, 'admin_or_creator')
  assert.equal(context.selectedTask.canDelete, true)
  assert.equal(context.tasks.find(entry => entry.id === String(task._id)).canDelete, true)
  assert.equal((await confirm(proposal)).data.requiresSecondConfirmation, true)
  assert.ok(await Task.exists({ _id: task._id }))
  assert.equal((await notes()).length, 0)
  assert.equal((await confirm(proposal)).status, 200)
  assert.equal(await Task.findById(task._id), null)
  assert.deepEqual((await notes()).map(note => note.text), ['Aunt May deleted 1 overdue task.'])
  assert.equal((await confirm(proposal)).data.deleted, true)
  assert.equal((await notes()).length, 1)
})

test('admin can delete another creators overdue task under the default policy', async () => {
  const task = await makeTask()
  const { proposal } = await draft(task, 'alex')
  assert.equal((await confirm(proposal, 'alex')).data.requiresSecondConfirmation, true)
  assert.equal((await confirm(proposal, 'alex')).status, 200)
  assert.deepEqual((await notes()).map(note => note.text), ['Alex deleted 1 overdue task.'])
})

for (const afterFirst of [false, true]) {
  test(`recipient permission changed ${afterFirst ? 'between confirmations' : 'after proposal'} does not block the creator`, async () => {
    await setPermission('member')
    const task = await makeTask()
    const { proposal } = await draft(task)
    if (afterFirst) assert.equal((await confirm(proposal)).data.requiresSecondConfirmation, true)
    await setPermission('admin')
    if (!afterFirst) assert.equal((await confirm(proposal)).data.requiresSecondConfirmation, true)
    assert.equal((await confirm(proposal)).status, 200)
    assert.equal(await Task.findById(task._id), null)
    assert.equal((await notes()).length, 1)
  })
}

test('demotion between confirmations is checked against current family membership', async () => {
  const task = await makeTask()
  const { proposal } = await draft(task, 'alex')
  assert.equal((await confirm(proposal, 'alex')).data.requiresSecondConfirmation, true)
  assert.equal((await api.request(`${family}/members/${ids.alex}`, { method: 'PATCH', user: 'jasmine', body: { role: 'member' } })).status, 200)
  assert.equal((await confirm(proposal, 'alex')).status, 403)
  assert.ok(await Task.exists({ _id: task._id }))
})

test('each family uses its own setting and proposals cannot be confirmed in a different family', async () => {
  assert.equal((await api.request('/families/join', { method: 'POST', user: 'may', body: { inviteCode: '1122334455' } })).status, 200)
  await setPermission('member')
  const allowed = await makeTask(), denied = await makeTask({ familyId: ids.otherFamily, createdBy: ids.alex })
  const { proposal } = await draft(allowed)
  await assert.rejects(draft(denied), { status: 403 })
  assert.equal((await confirm(proposal, 'may', ids.otherFamily)).status, 404)
  assert.ok(await Task.exists({ _id: allowed._id }))
  assert.ok(await Task.exists({ _id: denied._id }))
})

test('member permission does not bypass creator checks for future tasks or locked-task checks', async () => {
  await setPermission('member')
  await assert.rejects(draft(await makeTask({ future: true, createdBy: ids.alex })), { status: 403 })
  assert.ok((await draft(await makeTask({ future: true }), 'alex')).proposal)
  for (const status of ['in_progress', 'completed']) await assert.rejects(draft(await makeTask({ status })), { status: 409 })
  const ownFuture = await makeTask({ future: true })
  const { proposal } = await draft(ownFuture)
  assert.equal((await confirm(proposal)).data.requiresSecondConfirmation, true)
  assert.equal((await confirm(proposal)).status, 200)
  assert.equal(await Task.findById(ownFuture._id), null)
})

test('overdue recurring deletion follows the setting and keeps its occurrence tombstone', async () => {
  await setPermission('member')
  const created = await api.request(`${family}/tasks`, { method: 'POST', user: 'may', body: recurringTaskPayload({ never: true }) })
  assert.equal(created.status, 201)
  const task = await Task.findByIdAndUpdate(created.data.task._id, { startAt: new Date(Date.now() - 86400000) }, { new: true })
  const { proposal } = await draft(task)
  assert.equal((await confirm(proposal)).data.requiresSecondConfirmation, true)
  assert.equal((await confirm(proposal)).status, 200)
  assert.ok((await Series.findById(task.recurringSeries)).deletedOccurrences.includes(task.occurrenceIndex))
  await api.request(`${family}/tasks`)
  assert.equal(await Task.findById(task._id), null)
  assert.deepEqual((await notes()).map(note => note.text), ['Aunt May deleted 1 overdue task.'])
})

test('task changed between confirmations is preserved and creates no deletion summary', async () => {
  await setPermission('member')
  const task = await makeTask()
  const { proposal } = await draft(task)
  assert.equal((await confirm(proposal)).data.requiresSecondConfirmation, true)
  await Task.updateOne({ _id: task._id }, { $set: { title: 'Updated by someone else' } })
  assert.equal((await confirm(proposal)).status, 409)
  assert.equal((await Task.findById(task._id)).title, 'Updated by someone else')
  assert.equal((await notes()).length, 0)
})

test('manual overdue deletion uses the same conditional write when the schedule changes during deletion', async t => {
  const task = await makeTask()
  const deleteOne = Task.deleteOne
  t.mock.method(Task, 'deleteOne', async function(filter, ...args) {
    await Task.updateOne({ _id: task._id }, { $set: { startAt: new Date(Date.now() + 86400000) } })
    return deleteOne.call(this, filter, ...args)
  })
  const result = await api.request(`${family}/tasks/${task._id}`, { method: 'DELETE', user: 'alex' })
  assert.equal(result.status, 409)
  assert.ok(await Task.exists({ _id: task._id }))
  assert.equal((await notes()).length, 0)
})

test('forged permission fields cannot authorize deletion of another creators task', async () => {
  const task = await makeTask({ createdBy: ids.alex })
  const proposal = await Proposal.create({ family: ids.family, user: ids.may, action: 'delete', taskId: task._id,
    changes: {}, expectedUpdatedAt: task.updatedAt, deletionAcknowledged: true, expiresAt: new Date(Date.now() + 60000) })
  const result = await api.request(`${family}/assistant/proposals/${proposal._id}/confirm`, { method: 'POST', user: 'may',
    body: { memberRole: 'admin', recipientDeletion: 'member', deletionAcknowledged: true } })
  assert.equal(result.status, 403)
  assert.ok(await Task.exists({ _id: task._id }))
  assert.equal((await notes()).length, 0)
})
