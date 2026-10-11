// Owner: Marcus
// Define and export the Mongoose Family schema/model here.
// Owner: Sera (package A)
// Shape matches server/seed.js and the "CareCircle database design" doc.
import mongoose from 'mongoose'
import { FAMILY_ROLES, EVENT_TYPES } from '../../constants.js'

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: FAMILY_ROLES, default: 'member' },
    relationship: { type: String, trim: true, default: '' },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
)

const familySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    inviteCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: { type: [memberSchema], default: [] },
    telegram: {
      chatId: { type: String, default: null },
      linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      linkedAt: { type: Date, default: null }
    },
    notifyOn: { type: [{ type: String, enum: EVENT_TYPES }], default: () => [...EVENT_TYPES] }
  },
  { timestamps: true }
)

// "Which families am I in?" (family switcher, GET /api/families)
familySchema.index({ 'members.user': 1 })

export default mongoose.model('Family', familySchema)