// Owner: Chaithra (E)
// One transit session per appointment task. D's POST /tasks/:taskId/start creates it
// (TaskModel.startTransitSession looks this model up by the name 'TransitSession').
import mongoose from 'mongoose'
import { MILESTONE_TYPES, TRANSIT_STATUS, TRANSIT_STATUSES } from '../../constants.js'

// Default label for each preset step. Custom steps use the text the user typed.
export const MILESTONE_LABELS = {
    departed: 'Departed home',
    arrived: 'Arrived at clinic',
    consultation_done: 'Consultation done',
    heading_home: 'Heading home',
    home: 'Safely back home'
}

const milestoneSchema = new mongoose.Schema({
    type: { type: String, enum: MILESTONE_TYPES, required: true },
    label: {
        type: String,
        trim: true,
        required: [true, 'Label is required'],
        maxlength: [80, 'Label must be at most 80 characters']
    },
    at: { type: Date, default: Date.now }, // always set by the server
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 }
}, { _id: false })

const transitSessionSchema = new mongoose.Schema({
    family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, unique: true },
    companion: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: TRANSIT_STATUSES, default: TRANSIT_STATUS.ACTIVE },
    milestones: { type: [milestoneSchema], default: [] },
    lastLocation: {
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 },
        at: Date
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null }
}, {
    timestamps: true,
    collection: 'transitsessions'
})

// Live banner on Family Home: active sessions in a family
transitSessionSchema.index({ family: 1, status: 1 })

export default mongoose.models.TransitSession ||
    mongoose.model('TransitSession', transitSessionSchema, 'transitsessions')
