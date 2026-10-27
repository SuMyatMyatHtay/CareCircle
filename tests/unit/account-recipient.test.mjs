import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import User from '../../server/src/features/auth/User.model.js'
import Family from '../../server/src/features/families/Family.model.js'
import CareRecipient from '../../server/src/features/recipients/CareRecipient.model.js'
import { updateProfile } from '../../server/src/features/auth/controller.js'
import { syncAccountRecipientInFamily } from '../../server/src/features/recipients/syncAccountRecipient.js'

const originals = { user: User.findByIdAndUpdate, families: Family.find, upsert: CareRecipient.findOneAndUpdate, update: CareRecipient.updateMany }
after(() => { User.findByIdAndUpdate = originals.user; Family.find = originals.families; CareRecipient.findOneAndUpdate = originals.upsert; CareRecipient.updateMany = originals.update })
let recipients = [], account, nextId, collision
function setup() {
  recipients = []; nextId = 1; collision = false
  account = { _id: 'account-a', name: 'Alex', isCaretaker: false }
  User.findByIdAndUpdate = async (id, update) => { assert.equal(id, account._id); Object.assign(account, update.$set); return account }
  Family.find = filter => { assert.equal(filter['members.userId'], account._id); return { select: async () => [{ _id: 'family-a' }, { _id: 'family-b' }] } }
  CareRecipient.findOneAndUpdate = async (filter, update, options) => {
    let row = recipients.find(r => r.family === filter.family && r.linkedUser === filter.linkedUser)
    if (!row && options.upsert) {
      row = { _id: `recipient-${nextId++}`, ...filter, ...update.$setOnInsert, careNotes: 'Keep my notes' }; recipients.push(row)
      if (collision) { collision = false; throw Object.assign(new Error('duplicate'), { code: 11000 }) }
    }
    if (row) Object.assign(row, update.$set)
    return row
  }
  CareRecipient.updateMany = async (filter, update) => {
    recipients.filter(r => r.family === filter.family && r.linkedUser === filter.linkedUser).forEach(r => Object.assign(r, update.$set))
  }
}
async function save(enabled) {
  let status, body
  const res = { status(value) { status = value; return this }, json(value) { body = value; return this } }
  await updateProfile({ user: { userId: account._id }, body: { name: 'Alex Tan', phone: '', preferredLang: 'en', telegramUsername: '', isCaretaker: enabled } }, res)
  assert.equal(status, 200)
  assert.equal(body.user.isCaretaker, enabled)
}

test('profile checkbox persists and reuses one recipient per family through repeated toggles', async () => {
  setup()
  await save(true)
  const ids = recipients.map(r => r._id)
  const existingTask = { recipient: ids[0], title: 'Please collect my medicine', status: 'open' }
  recipients[0].careType = 'injury'
  recipients.push({ _id: 'unrelated', family: 'family-a', linkedUser: 'someone-else', isActive: true })
  for (let i = 0; i < 3; i++) {
    await save(false)
    assert.ok(recipients.slice(0, 2).every(r => !r.isActive && r.linkedUser === account._id))
    assert.equal(existingTask.recipient, ids[0])
    assert.equal(existingTask.status, 'open')
    await save(true)
    assert.deepEqual(recipients.slice(0, 2).map(r => r._id), ids)
    assert.ok(recipients.slice(0, 2).every(r => r.isActive))
  }
  assert.equal(recipients.length, 3)
  assert.equal(recipients[0].careType, 'injury')
  assert.equal(recipients[0].careNotes, 'Keep my notes')
  assert.equal(recipients[2].isActive, true)
})

test('simultaneous insert collision reuses the winning recipient', async () => {
  setup(); account.isCaretaker = true; collision = true
  await syncAccountRecipientInFamily(account, 'family-a')
  await syncAccountRecipientInFamily(account, 'family-a')
  assert.equal(recipients.length, 1)
  assert.equal(recipients[0].isActive, true)
})

test('opting out without an existing recipient does not create one', async () => {
  setup()
  await save(false)
  assert.equal(recipients.length, 0)
})

test('archiving retains the linked identity and never deletes task history', async () => {
  const original = CareRecipient.findOneAndUpdate
  try {
    CareRecipient.findOneAndUpdate = async (filter, update) => {
      assert.deepEqual(filter, { family: 'family-a', _id: 'recipient-a' })
      assert.deepEqual(update, { $set: { isActive: false } })
      return { _id: 'recipient-a', isActive: false, linkedUser: 'account-a' }
    }
    const result = await CareRecipient.archiveRecipient('family-a', 'recipient-a')
    assert.equal(result.linkedUser, 'account-a')
  } finally { CareRecipient.findOneAndUpdate = original }
})
