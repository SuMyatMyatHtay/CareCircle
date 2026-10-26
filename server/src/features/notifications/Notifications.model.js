// The Telegram outbox: one row per message. Nobody writes here directly; everyone calls
// notify() in utils/notify.js, which saves a row and sends it.
import mongoose from 'mongoose'
import { EVENT_TYPES, NOTIFICATION_REF_TYPES, NOTIFICATION_STATUS, NOTIFICATION_STATUSES } from '../../constants.js'
 
const notificationSchema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  eventType: { type: String, enum: EVENT_TYPES, required: true },
  refType: { type: String, enum: NOTIFICATION_REF_TYPES }, // what the event is about (for the deep link)
  refId: { type: mongoose.Schema.Types.ObjectId },
  text: { type: String, required: true }, // the message without its link (the link is added when sending)
  status: { type: String, enum: NOTIFICATION_STATUSES, default: NOTIFICATION_STATUS.PENDING },
  error: { type: String, default: null },
  sentAt: { type: Date, default: null },
}, { timestamps: true, collection: 'notifications' })
 
notificationSchema.index({ family: 1, createdAt: -1 })
notificationSchema.index({ status: 1 })
 
export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
 