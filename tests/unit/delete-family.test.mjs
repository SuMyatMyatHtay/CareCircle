import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from '../../server/node_modules/mongoose/index.js'
import Family from '../../server/src/features/families/Family.model.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import Recipient from '../../server/src/features/recipients/CareRecipient.model.js'
import Series from '../../server/src/features/tasks/RecurringSeries.model.js'
import Journey from '../../server/src/features/journeys/Journey.model.js'
import Log from '../../server/src/features/logs/CareLog.model.js'
import Notification from '../../server/src/features/notifications/Notifications.model.js'
import Proposal from '../../server/src/features/assistant/Proposal.model.js'
import { deleteFamily } from '../../server/src/features/families/delete.controller.js'

const request = () => ({ family: { _id: 'family', name: 'Tan family' }, user: { userId: 'admin' }, body: { confirmed: true, familyName: 'Tan family' } })
const response = () => ({ code: 200, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
function setup(t, allowed = true) {
  const calls = [], session = { withTransaction: async work => work(), endSession: async () => calls.push('closed') }
  t.mock.method(mongoose, 'startSession', async () => session)
  t.mock.method(Family, 'findOneAndDelete', async (filter, options) => {
    assert.deepEqual(filter.members.$elemMatch, { userId: 'admin', role: 'admin' })
    assert.equal(filter.name, 'Tan family'); assert.equal(options.session, session)
    calls.push('family')
    return allowed ? { _id: 'family', members: [] } : null
  })
  for (const Model of [Task, Recipient, Series, Journey, Log, Notification, Proposal]) {
    t.mock.method(Model, 'deleteMany', async (filter, options) => {
      assert.deepEqual(filter, { family: 'family' }); assert.equal(options.session, session)
      calls.push(Model.modelName)
    })
  }
  return calls
}
test('family deletion requires explicit confirmation and the exact name', async () => {
  for (const body of [{}, { confirmed: true, familyName: 'Wrong family' }, { confirmed: false, familyName: 'Tan family' }]) {
    const res = response()
    await deleteFamily({ ...request(), body }, res, error => { throw error })
    assert.equal(res.code, 400)
  }
})
test('deletes all family collections in one transaction without deleting user accounts', async t => {
  const calls = setup(t), res = response()
  await deleteFamily(request(), res, error => { throw error })
  assert.deepEqual(res.body, { deleted: true, familyId: 'family' })
  assert.equal(calls.length, 9)
  assert.equal(calls.at(-1), 'closed')
})
test('a demoted or removed admin cannot delete the family or any child records', async t => {
  const calls = setup(t, false), res = response()
  await deleteFamily(request(), res, error => { throw error })
  assert.equal(res.code, 403)
  assert.deepEqual(calls, ['family', 'closed'])
})
test('a collection error aborts the transaction and closes its session', async t => {
  const calls = setup(t), failure = new Error('Database failure')
  t.mock.method(Task, 'deleteMany', async () => { throw failure })
  let received
  await deleteFamily(request(), response(), error => { received = error })
  assert.equal(received, failure)
  assert.deepEqual(calls, ['family', 'closed'])
})
