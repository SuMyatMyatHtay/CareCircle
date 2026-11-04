import mongoose from 'mongoose'
import Family from './Family.model.js'
import Task from '../tasks/TaskModel.js'
import Recipient from '../recipients/CareRecipient.model.js'
import Series from '../tasks/RecurringSeries.model.js'
import Journey from '../journeys/Journey.model.js'
import Log from '../logs/CareLog.model.js'
import Notification from '../notifications/Notifications.model.js'
import Proposal from '../assistant/Proposal.model.js'
import { syncInBackground } from '../calendar-sync/sync.js'

export async function deleteFamily(req, res, next) {
  if (req.body?.confirmed !== true || typeof req.body?.familyName !== 'string' || req.body.familyName !== req.family.name) {
    return res.status(400).json({ error: 'Confirm deletion and enter the exact family name.' })
  }
  let session
  try {
    session = await mongoose.startSession()
    let deleted
    await session.withTransaction(async () => {
      deleted = await Family.findOneAndDelete({ _id: req.family._id, name: req.body.familyName,
        members: { $elemMatch: { userId: req.user.userId, role: 'admin' } } }, { session })
      if (!deleted) throw Object.assign(new Error('Only a current family admin can delete this family.'), { status: 403 })
      // A transaction prevents a partial deletion if any collection fails.
      for (const Model of [Task, Recipient, Series, Journey, Log, Notification, Proposal]) {
        await Model.deleteMany({ family: req.family._id }, { session })
      }
    })
    syncInBackground(...deleted.members.map(member => String(member.userId)))
    return res.json({ deleted: true, familyId: String(deleted._id) })
  } catch (error) {
    if (error.code === 20 || /Transaction numbers are only allowed/.test(error.message)) {
      return res.status(503).json({ error: 'Family deletion requires MongoDB Atlas or a replica set. No changes were saved.' })
    }
    if (error.status) return res.status(error.status).json({ error: error.message })
    next(error)
  } finally { await session?.endSession() }
}
