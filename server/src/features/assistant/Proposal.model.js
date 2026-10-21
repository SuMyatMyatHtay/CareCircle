import mongoose from 'mongoose'

// Persist confirmation intent across server restarts; never trust a client task payload.
const schema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, enum: ['create', 'update', 'unclaim', 'delete'], required: true },
  deletionAcknowledged: { type: Boolean, default: false },
  taskId: { type: mongoose.Schema.Types.ObjectId, required: true },
  changes: { type: mongoose.Schema.Types.Mixed, required: true },
  expectedUpdatedAt: Date,
  state: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'], default: 'pending' },
  expiresAt: { type: Date, required: true }
}, { timestamps: true })
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export default mongoose.models.AssistantProposal || mongoose.model('AssistantProposal', schema)
