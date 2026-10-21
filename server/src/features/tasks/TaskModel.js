// Owner: Marcus (D)
import mongoose from 'mongoose'
import { TASK_CATEGORIES, TASK_STATUS, TASK_STATUSES, TRANSIT_STATUS } from '../../constants.js'

// Where the task happens. lat/lng are optional (filled in by OneMap later).
const locationSchema = new mongoose.Schema({
    name: { type: String, trim: true, maxlength: 120, default: '' },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    postal: { type: String, trim: true, match: /^(\d{6})?$/, default: '' },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 }
}, { _id: false })

const taskSchema = new mongoose.Schema({
    family: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Family',
        required: true
    },

    // Optional: household tasks have no recipient
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CareRecipient',
        default: null
    },

    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [120, 'Title must be at most 120 characters']
    },

    description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description must be at most 2000 characters'],
        default: ''
    },

    category: {
        type: String,
        enum: TASK_CATEGORIES,
        default: 'other'
    },

    startAt: {
        type: Date,
        required: [true, 'Start time is required']
    },

    endAt: {
        type: Date,
        default: null,
        validate: {
            validator(value) {
                // In update queries `this` is the Query, so only check on documents
                if (!value || !(this instanceof mongoose.Document)) return true
                return value >= this.startAt
            },
            message: 'End time must be after the start time'
        }
    },

    location: {
        type: locationSchema,
        default: null
    },

    needsTransit: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: TASK_STATUSES,
        default: TASK_STATUS.OPEN
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    claimedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null }
}, {
    timestamps: true,
    collection: 'tasks'
})

// Family task board, sorted by start time
taskSchema.index({ family: 1, startAt: 1 })
// Recipient tasks tab
taskSchema.index({ family: 1, recipient: 1, startAt: 1 })
// My Tasks (E): a user's claimed tasks across families
taskSchema.index({ claimedBy: 1, status: 1, startAt: 1 })

// ---------- Database operations ----------
// Every query on tasks lives here; controller.js only calls these statics.

// Tasks in these statuses can't be edited
export const LOCKED_STATUSES = [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED]
// Tasks in these statuses can't be deleted (cancel them instead)
export const UNDELETABLE_STATUSES = [TASK_STATUS.IN_PROGRESS, TASK_STATUS.COMPLETED]

const USER_FIELDS = 'name telegramUsername profilePicture'
const RECIPIENT_FIELDS = 'name nickname careType profilePicture'

// Models owned by other packages. Looked up by name so this file still works
// before they exist: no recipient populate / transit session until they are registered.
const recipientModel = () => mongoose.models.CareRecipient
const transitModel = () => mongoose.models.TransitSession

function populatePeople(query) {
    query.populate('createdBy', USER_FIELDS).populate('claimedBy', USER_FIELDS)
    if (recipientModel()) query.populate('recipient', RECIPIENT_FIELDS)
    return query
}

taskSchema.statics.getTasksByFamily = function (familyId, filter = {}) {
    return populatePeople(
        this.find({ ...filter, family: familyId }).sort({ startAt: 1, createdAt: 1 })
    )
}

taskSchema.statics.getTaskInFamily = function (familyId, taskId) {
    return this.findOne({ _id: taskId, family: familyId })
}

taskSchema.statics.getTaskById = function (taskId) {
    return this.findById(taskId)
}

taskSchema.statics.getPopulatedTaskById = function (taskId) {
    return populatePeople(this.findById(taskId))
}

taskSchema.statics.createTask = function (taskData) {
    return this.create(taskData)
}

// Returns null if the task was completed or cancelled in the meantime
taskSchema.statics.updateEditableTask = function (familyId, taskId, changes) {
    return this.findOneAndUpdate(
        { _id: taskId, family: familyId, status: { $nin: LOCKED_STATUSES } },
        { $set: changes },
        { new: true, runValidators: true }
    )
}

// Resolves to { deletedCount: 0 } if the task was started or completed in the meantime
taskSchema.statics.deleteDeletableTask = function (familyId, taskId) {
    return this.deleteOne({
        _id: taskId,
        family: familyId,
        status: { $nin: UNDELETABLE_STATUSES }
    })
}

// Only applies if the status and claimer are still what they were when `task`
// was read, so two people claiming at once can't both succeed. Returns null otherwise.
taskSchema.statics.updateTaskStatus = function (task, changes) {
    return this.findOneAndUpdate(
        { _id: task._id, family: task.family, status: task.status, claimedBy: task.claimedBy },
        { $set: changes },
        { new: true }
    )
}

// True if the recipient belongs to this family (always true until C's model exists)
taskSchema.statics.recipientInFamily = async function (recipientId, familyId) {
    const CareRecipient = recipientModel()
    if (!CareRecipient) return true
    return Boolean(await CareRecipient.exists({ _id: recipientId, family: familyId }))
}

// One session per task: reused if the task is started again after an unclaim.
// Starting again is a new journey, so the old steps and location are cleared.
taskSchema.statics.startTransitSession = async function (task) {
    const TransitSession = transitModel()
    if (!TransitSession || !task.needsTransit) return null

    return TransitSession.findOneAndUpdate(
        { task: task._id },
        {
            $set: {
                companion: task.claimedBy,
                status: TRANSIT_STATUS.ACTIVE,
                milestones: [],
                startedAt: new Date(),
                endedAt: null
            },
            $unset: { lastLocation: '' },
            $setOnInsert: { family: task.family, task: task._id }
        },
        { upsert: true, new: true }
    )
}

taskSchema.statics.endTransitSession = async function (task) {
    const TransitSession = transitModel()
    if (!TransitSession) return

    await TransitSession.updateOne(
        { task: task._id, status: TRANSIT_STATUS.ACTIVE },
        { $set: { status: TRANSIT_STATUS.ENDED } }
    )
}

export default mongoose.models.Task ||
    mongoose.model('Task', taskSchema, 'tasks')
