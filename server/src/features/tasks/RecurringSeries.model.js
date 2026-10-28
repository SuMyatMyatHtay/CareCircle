import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rule: { type: mongoose.Schema.Types.Mixed, required: true },
  template: { type: mongoose.Schema.Types.Mixed, required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, default: null },
  usualHelper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  helperClaimedAt: { type: Date, default: null },
  paused: { type: Boolean, default: false },
  generatedThrough: { type: Date, default: null },
  generatedAll: { type: Boolean, default: false },
  revision: { type: Number, default: 0 },
  deletedOccurrences: { type: [Number], default: [] },
  revisions: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true, collection: 'recurringseries' })
schema.index({ family: 1, paused: 1 })
export default mongoose.models.RecurringSeries || mongoose.model('RecurringSeries', schema)
