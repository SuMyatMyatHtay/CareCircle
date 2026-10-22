// Owner: Chaithra (E)
// One per user who connected Google Calendar. Keeps the Google refresh token (so the
// server can add events without the person being there) and which Google event
// belongs to which CareCircle task, so events can be updated or removed later.
import mongoose from 'mongoose'

const googleCalendarLinkSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    refreshToken: { type: String, required: true, select: false }, // secret: never sent to the browser
    googleEmail: { type: String, default: '' },
    // taskId -> Google event id
    events: { type: Map, of: String, default: {} },
    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: null },
    lastError: { type: String, default: '' }
}, {
    timestamps: true,
    collection: 'googlecalendarlinks'
})

export default mongoose.models.GoogleCalendarLink ||
    mongoose.model('GoogleCalendarLink', googleCalendarLinkSchema, 'googlecalendarlinks')
