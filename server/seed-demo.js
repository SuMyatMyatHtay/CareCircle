import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import User from './src/features/auth/User.model.js'
import Family from './src/features/families/Family.model.js'
import Recipient from './src/features/recipients/CareRecipient.model.js'
import Task from './src/features/tasks/TaskModel.js'
import Log from './src/features/logs/CareLog.model.js'

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) })
const password = 'CareCircleDemo123!'
const id = n => new mongoose.Types.ObjectId(`ccde${n.toString(16).padStart(20, '0')}`)
const family = id(10)
const now = new Date()
const day = new Date(+now + 8 * 3600000)
const at = (offset, hour = 10) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + offset, hour - 8))
const hours = offset => new Date(+now + offset * 3600000)
const clinic = { name: 'Ang Mo Kio Polyclinic', address: '21 Ang Mo Kio Central 2', postal: '569666', lat: 1.3746, lng: 103.8457 }

async function main() {
  const passwordHash = await bcrypt.hash(password, 10)
  const users = [
    ['Ethan Lim', 'ethan.demo@carecircle.test', 'admin'],
    ['Priya Kumar', 'priya.demo@carecircle.test', 'admin'],
    ['Daniel Wong', 'daniel.demo@carecircle.test', 'member'],
    ['Chloe Lee', 'chloe.demo@carecircle.test', 'member'],
  ].map(([name, email, role], index) => ({ _id: id(index + 1), name, email, role, passwordHash, preferredLang: 'en', isCaretaker: true }))
  const recipients = [
    { _id: id(20), name: 'Tan Ah Kow', nickname: 'Grandpa', careType: 'elderly', dateOfBirth: new Date('1944-03-12'), mobility: { level: 'assisted', notes: 'Uses a walking stick; take the lift.' }, conditions: ['Type 2 diabetes'], dietaryRestrictions: ['Low sugar'], allergies: [{ name: 'Penicillin', severity: 'severe' }], careNotes: 'Fictional demo profile. Prefers morning appointments and a quiet waiting area.' },
    { _id: id(21), name: 'Lim Siew Lan', nickname: 'Grandma', careType: 'elderly', dateOfBirth: new Date('1947-08-30'), mobility: { level: 'independent', notes: 'Short walks with rest stops.' }, conditions: ['Knee pain'], careNotes: 'Fictional demo profile. Enjoys gardening and evening walks.' },
    { _id: id(22), name: 'Emma Tan', nickname: 'Baby Emma', careType: 'infant', dateOfBirth: at(-120), careNotes: 'Fictional demo profile. Bring the stroller, spare clothes and feeding supplies for outings.' },
  ].map(recipient => ({ ...recipient, family, isActive: true, preferredClinic: clinic }))
  const tasks = [
    ['Collect prescription refill', 20, 'medication', hours(2), 'open', null],
    ['Buy groceries for the household', null, 'groceries', hours(4), 'open', null],
    ['Read stories with Baby Emma', 22, 'childcare', hours(3), 'open', null],
    ['Accompany Grandpa to the clinic', 20, 'appointment', at(1), 'claimed', 1],
    ['Take Grandma to physiotherapy', 21, 'therapy', at(2), 'claimed', 2],
    ['Prepare feeding supplies', 22, 'childcare', hours(5), 'claimed', 3],
    ['Evening walk with Grandma', 21, 'companionship', hours(6), 'claimed', 4],
    ['Organise Grandpa care folder', 20, 'other', hours(-1), 'in_progress', 1],
    ['Check the stroller and outing bag', 22, 'errand', at(-1), 'completed', 2],
    ['Pick up fresh vegetables', 21, 'groceries', at(-2), 'completed', 3],
    ['Confirm the next clinic appointment', 20, 'errand', at(-1), 'open', null],
    ['Replace the night-light batteries', null, 'errand', at(-2), 'open', null],
    ['Baby Emma routine check-up', 22, 'appointment', at(5), 'open', null],
    ['Garden visit with Grandma', 21, 'companionship', at(3, 16), 'open', null],
    ['Cancelled shopping trip', null, 'errand', at(-1), 'cancelled', null],
  ].map(([title, recipient, category, startAt, status, helper], index) => ({
    _id: id(100 + index), family, recipient: recipient ? id(recipient) : null,
    title, category, startAt, endAt: new Date(+startAt + 3600000), status,
    description: 'Classroom demo task. Use this to explore task details, assignment and status changes.',
    createdBy: id(index % 4 + 1), claimedBy: helper ? id(helper) : null,
    claimedAt: helper ? hours(-2) : null,
    completedAt: status === 'completed' ? new Date(+startAt + 3600000) : null,
    cancelledAt: status === 'cancelled' ? hours(-3) : null,
    needsTransit: category === 'appointment', location: category === 'appointment' || category === 'therapy' ? clinic : null,
  }))
  // Distinct contribution histories, including recent completions for every
  // member and older work so week/month/all-time filters have useful differences.
  const historyKinds = [
    ['Accompanied Grandpa to a clinic review', 20, 'appointment'],
    ['Prepared Grandma lunch', 21, 'other'],
    ['Restocked Baby Emma supplies', 22, 'childcare'],
    ['Collected household groceries', null, 'groceries'],
    ['Walked with Grandma', 21, 'companionship'],
    ['Organised Grandpa medication box', 20, 'medication'],
  ]
  for (const [member, count] of [[1, 18], [2, 15], [3, 12], [4, 9]]) {
    for (let index = 0; index < count; index++) {
      const [title, recipient, category] = historyKinds[(index + member) % historyKinds.length]
      const completedAt = index === 0 ? hours(-1 - member / 10) : at(-(index < 4 ? index : 4 + (index * 3 + member) % 25), index % 2 ? 19 : 11)
      const startAt = new Date(+completedAt - 3600000)
      const createdAt = new Date(+startAt - 2 * 86400000)
      tasks.push({
        _id: id(1000 + member * 100 + index), family,
        recipient: recipient ? id(recipient) : null,
        title, category, status: 'completed', createdBy: id(1), claimedBy: id(member),
        createdAt, updatedAt: completedAt,
        claimedAt: new Date(+createdAt + (index % 3 === 0 ? 30 : 120) * 60000),
        startAt, endAt: completedAt, completedAt,
        needsTransit: category === 'appointment', location: category === 'appointment' ? clinic : null,
        description: 'Fictional completed care task for the classroom contribution history.',
      })
    }
  }
  const logs = [
    { recipient: id(20), author: id(1), type: 'consultation', content: 'Demo consultation note: discussed the next review and brought the care folder. This is fictional classroom data.', consultation: { doctorName: 'Dr Demo', clinic: clinic.name, nextAppointment: at(7) } },
    { recipient: id(21), author: id(2), type: 'general', content: 'Grandma enjoyed a short garden walk today. Took a rest on a bench before returning home.' },
    { recipient: id(22), author: id(3), type: 'general', content: 'Emma settled after story time. Spare clothes and feeding supplies are ready for the next outing.' },
    { recipient: id(20), author: id(4), type: 'diet', content: 'Prepared a low-sugar breakfast and restocked the pantry. Demo care note for browsing and editing.' },
  ].map((log, index) => ({ ...log, _id: id(200 + index), family, originalLang: 'en', createdAt: at(-index - 1), updatedAt: at(-index - 1) }))
  const groups = [
    [User, users.map(({ role, ...user }) => user)],
    [Family, [{ _id: family, name: 'Class Demo Family', inviteCode: 'CCDE202601', createdBy: id(1), recipientDeletion: 'admin', members: users.map(user => ({ userId: user._id, role: user.role, joinedAt: at(-7) })), telegram: {}, notifyOn: [], reminders: { beforeTask: false, dailySummary: false, unclaimedTask: false } }]],
    [Recipient, recipients], [Task, tasks], [Log, logs],
  ]
  // Validate every document before performing any writes.
  for (const [Model, rows] of groups) for (const row of rows) await new Model(row).validate()
  if (process.argv.includes('--check')) {
    console.log(`Demo data validated: 4 users, 1 family, 3 recipients, ${tasks.length} tasks, 4 care notes. No database writes.`)
    return
  }
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env first.')
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  console.log(`Adding demo data to database: ${mongoose.connection.name}`)
  // Preflight unique fields so an unrelated account/family is never reused.
  for (const user of users) {
    const existing = await User.findOne({ email: user.email })
    if (existing && !existing._id.equals(user._id)) throw new Error(`Demo email already belongs to another account: ${user.email}`)
  }
  const existingFamily = await Family.findOne({ inviteCode: 'CCDE202601' })
  if (existingFamily && !existingFamily._id.equals(family)) throw new Error('Demo invite code already belongs to another family.')
  for (const [Model, rows] of groups) {
    let added = 0
    for (const row of rows) {
      // Existing demo records (including edits made by classmates) are preserved.
      if (await Model.exists({ _id: row._id })) continue
      await new Model(row).save()
      added++
    }
    console.log(`${Model.modelName}: ${added} added; ${rows.length - added} already present`)
  }
  for (const user of users) {
    const saved = await User.findById(user._id).select('+passwordHash')
    if (!await bcrypt.compare(password, saved.passwordHash)) throw new Error(`Demo password was changed for ${user.email}; existing account preserved.`)
  }
  console.log(`Demo ready. Password for all four accounts: ${password}`)
  console.log(users.map(user => `${user.email} (${user.role})`).join('\n'))
}

try { await main() }
catch (error) { console.error(`Demo seed failed: ${error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[database URI]')}`); process.exitCode = 1 }
finally { await mongoose.disconnect() }
