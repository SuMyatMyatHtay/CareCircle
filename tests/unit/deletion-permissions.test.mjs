import test from 'node:test'
import assert from 'node:assert/strict'
import { canDeleteFamilyTask, canRemoveRecipient } from '../../server/src/features/tasks/permissions.js'
import Family from '../../server/src/features/families/Family.model.js'
import { updateRecipientPermissions } from '../../server/src/features/families/settings.controller.js'
import recipientRoutes from '../../server/src/features/recipients/routes.js'
import express from '../../server/node_modules/express/index.js'
import Recipient from '../../server/src/features/recipients/CareRecipient.model.js'

const members = [{ userId: 'admin', role: 'admin' }, { userId: 'creator', role: 'member' }, { userId: 'other', role: 'member' }]
for (const permission of [undefined, 'admin', 'member']) {
  test(`task deletion remains admin-or-creator with recipient setting ${permission}`, () => {
    const family = { members, recipientDeletion: permission, overdueTaskDeletion: 'member' }
    for (const startAt of [new Date(0), new Date(Date.now() + 86400000)]) {
      const task = { status: 'open', startAt, createdBy: 'creator' }
      assert.equal(canDeleteFamilyTask(task, family, 'admin'), true)
      assert.equal(canDeleteFamilyTask(task, family, 'creator'), true)
      assert.equal(canDeleteFamilyTask(task, family, 'other'), false)
      assert.equal(canDeleteFamilyTask(task, family, 'outsider'), false)
      assert.equal(canDeleteFamilyTask({ ...task, status: 'completed' }, family, 'admin'), false)
    }
    assert.equal(canRemoveRecipient(family, 'admin'), true)
    assert.equal(canRemoveRecipient(family, 'other'), permission === 'member')
    assert.equal(canRemoveRecipient(family, 'outsider'), false)
  })
}

test('recipient setting persists only the new permission and requires current admin membership', async t => {
  let written
  t.mock.method(Family, 'findOneAndUpdate', async (filter, update) => {
    assert.deepEqual(filter.members.$elemMatch, { userId: 'admin', role: 'admin' })
    written = update.$set
    return { recipientDeletion: 'member' }
  })
  const res = { json(body) { this.body = body } }
  await updateRecipientPermissions({ family: { _id: 'family' }, user: { userId: 'admin' }, body: { recipientDeletion: 'member' } }, res, error => { throw error })
  assert.deepEqual(written, { recipientDeletion: 'member' })
  assert.deepEqual(res.body, { recipientDeletion: 'member' })
})

test('recipient archive route enforces admin-only default and optional member access', async t => {
  const recipientId = '000000000000000000000001'
  let permission, actor = 'other', writes = 0
  t.mock.method(Recipient, 'getRecipientInFamily', async () => ({ _id: recipientId }))
  t.mock.method(Recipient, 'archiveRecipient', async () => { writes++; return { _id: recipientId } })
  t.mock.method(Recipient, 'getPopulatedRecipientById', async () => ({ _id: recipientId, isActive: false }))
  const app = express()
  app.use((req, res, next) => { req.user = { userId: actor }; req.family = { _id: 'family', members, recipientDeletion: permission }; next() })
  app.use(recipientRoutes)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => server.close())
  const archive = () => fetch(`http://127.0.0.1:${server.address().port}/${recipientId}/archive`, { method: 'POST' })
  assert.equal((await archive()).status, 403)
  permission = 'member'; assert.equal((await archive()).status, 200)
  actor = 'outsider'; assert.equal((await archive()).status, 403)
  permission = 'admin'; actor = 'admin'; assert.equal((await archive()).status, 200)
  assert.equal(writes, 2)
})
