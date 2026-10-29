// Owner: Su Myat Myat Htay
import mongoose from 'mongoose'

// A user belonging to a family
const memberSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'member'],
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false })

// Family document
const familySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },

    inviteCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    members: {
        type: [memberSchema],
        default: []
    },

    telegram: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },

    notifyOn: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    reminders: {
    beforeTask: { type: Boolean, default: false },
    dailySummary: { type: Boolean, default: false },
    unclaimedTask: { type: Boolean, default: false },
    lastSummaryDay: { type: String, default: '' }
    }

}, {
    timestamps: true,
    collection: 'families'
})

export default mongoose.models.Family ||
    mongoose.model('Family', familySchema)
