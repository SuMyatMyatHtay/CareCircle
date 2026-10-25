import bcrypt from 'bcryptjs'
import { assertTestDatabase, mongoose } from './database.js'
import User from '../../src/features/auth/User.model.js'
import Family from '../../src/features/families/Family.model.js'
import Recipient from '../../src/features/recipients/CareRecipient.model.js'
import Task from '../../src/features/tasks/TaskModel.js'
import Log from '../../src/features/logs/CareLog.model.js'

export const password = 'CareCircle-test-only-123'
export const ids = {
  alex: '000000000000000000000101', jasmine: '000000000000000000000102',
  may: '000000000000000000000103', outsider: '000000000000000000000104',
  family: '000000000000000000000001', otherFamily: '000000000000000000000002',
  grandpa: '000000000000000000000201', otherRecipient: '000000000000000000000202',
  task: '000000000000000000000301',
  log: '000000000000000000000401',
}
export const accounts = {
  alex: 'alex@carecircle.test', jasmine: 'jasmine@carecircle.test',
  may: 'may@carecircle.test', outsider: 'outsider@carecircle.test',
}
let hash

export async function resetFixtures() {
  assertTestDatabase()
  // Collections belong exclusively to the generated test mongod. The shared
  // seed.js is deliberately never imported or executed.
  // Include newly introduced collections (transit, assistant proposals, calendar
  // links), even when this worker hasn't imported their Mongoose models yet.
  const collections = await mongoose.connection.db.collections()
  await Promise.all(collections.map(collection => collection.deleteMany({})))
  hash ||= await bcrypt.hash(password, 4)
  await User.create(Object.entries(accounts).map(([key, email]) => ({
    _id: ids[key], email, passwordHash: hash, preferredLang: 'en',
    name: { alex: 'Alex Tan', jasmine: 'Jasmine', may: 'Aunt May', outsider: 'Other User' }[key],
    isCaretaker: true,
  })))
  await Family.create([
    { _id: ids.family, name: 'Tan family', inviteCode: 'AABBCCDDEE', createdBy: ids.alex, createdAt: new Date('2026-02-01'), members: [
      { userId: ids.alex, role: 'admin' }, { userId: ids.jasmine, role: 'admin' }, { userId: ids.may, role: 'member' },
    ] },
    { _id: ids.otherFamily, name: 'Lee family', inviteCode: '1122334455', createdBy: ids.outsider, createdAt: new Date('2026-01-01'), members: [
      { userId: ids.outsider, role: 'admin' }, { userId: ids.alex, role: 'admin' },
    ] },
  ])
  await Recipient.create([
    { _id: ids.grandpa, family: ids.family, name: 'Grandpa', careType: 'elderly', createdBy: ids.alex, mobility: { level: 'assisted', notes: 'Uses a walking frame' } },
    { _id: ids.otherRecipient, family: ids.otherFamily, name: 'Lee recipient', careType: 'other', createdBy: ids.outsider },
  ])
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date())
  await Task.create({ _id: ids.task, family: ids.family, recipient: ids.grandpa,
    title: 'Collect medicine', startAt: new Date(`${day}T14:00:00+08:00`), createdBy: ids.jasmine })
  await Log.create({ _id: ids.log, family: ids.family, recipient: ids.grandpa, author: ids.alex,
    type: 'general', content: 'Sample note in the isolated test database.' })
  await Promise.all([User, Family, Recipient, Task, Log].map(Model => Model.init()))
}
