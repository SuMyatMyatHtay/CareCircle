// Owner: Chaithra (E)
// Handlers for transit sessions. See docs/API-CONTRACT.md (section E).
//
// requireAuth + requireFamilyMember run before every handler, so these are always set:
//   req.user.userId, req.family, req.memberRole
import mongoose from 'mongoose'
import TransitSession, { MILESTONE_LABELS } from './Journey.model.js'
import { completeTask } from '../tasks/controller.js'
import { MILESTONE_TYPES, TRANSIT_STATUS, EVENTS } from '../../constants.js'

// ---------- Helpers ----------

function httpError(status, message, errors) {
    return Object.assign(new Error(message), { status, errors })
}

function handleError(error, res, next) {
    if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
            error: 'Validation failed',
            errors: Object.values(error.errors).map((e) => e.message)
        })
    }
    if (error.status) {
        const body = { error: error.message }
        if (error.errors) body.errors = error.errors
        return res.status(error.status).json(body)
    }
    return next(error)
}

// Placeholder until F adds utils/notify.js and Socket.IO exists.
// Replace the body with: notify(familyId, eventType, payload)
function announce(_eventType, _transitSession) {}

const USER_FIELDS = 'name telegramUsername profilePicture'
const TASK_FIELDS = 'title startAt endAt location status category recipient claimedBy'

function populateSession(query) {
    const taskPopulate = { path: 'task', select: TASK_FIELDS }
    // Recipient model belongs to C; only populate once it is registered
    if (mongoose.models.CareRecipient) {
        taskPopulate.populate = { path: 'recipient', select: 'name nickname careType profilePicture' }
    }
    return query.populate('companion', USER_FIELDS).populate(taskPopulate)
}

function getTaskId(req) {
    const { taskId } = req.params
    // A malformed id is treated as not found
    if (!mongoose.isValidObjectId(taskId)) throw httpError(404, 'Transit session not found')
    return taskId
}

// Body: { type, label?, lat?, lng? }
function parseMilestone(body) {
    const input = body && typeof body === 'object' ? body : {}
    const errors = []

    if (!MILESTONE_TYPES.includes(input.type)) {
        errors.push(`Type must be one of: ${MILESTONE_TYPES.join(', ')}`)
    }

    let label = typeof input.label === 'string' ? input.label.trim() : ''
    if (input.type === 'custom' && !label) errors.push('Please type what is happening')
    if (input.type !== 'custom' && !label) label = MILESTONE_LABELS[input.type] || ''
    if (label.length > 80) errors.push('Label must be at most 80 characters')

    const milestone = { type: input.type, label, at: new Date() }

    // Optional position from the browser's geolocation
    const hasLat = typeof input.lat === 'number' && Number.isFinite(input.lat)
    const hasLng = typeof input.lng === 'number' && Number.isFinite(input.lng)
    if (hasLat && hasLng) {
        milestone.lat = input.lat
        milestone.lng = input.lng
    }

    if (errors.length) throw httpError(400, 'Validation failed', errors)
    return milestone
}

// ---------- Handlers ----------

// GET /api/families/:familyId/tasks/:taskId/transit
export async function getTransitSession(req, res, next) {
    try {
        const taskId = getTaskId(req)
        const transitSession = await populateSession(
            TransitSession.findOne({ task: taskId, family: req.family._id })
        )
        if (!transitSession) throw httpError(404, 'Transit session not found')
        return res.json({ transitSession })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/tasks/:taskId/transit/milestones   (companion only)
// A "home" milestone completes the task and ends the session (see the comments inside).
export async function addMilestone(req, res, next) {
    try {
        const taskId = getTaskId(req)
        const familyId = req.family._id
        const userId = req.user.userId

        const session = await TransitSession.findOne({ task: taskId, family: familyId })
        if (!session) throw httpError(404, 'Transit session not found')

        if (session.companion.toString() !== userId) {
            throw httpError(403, 'Only the person on this trip can post updates')
        }
        if (session.status !== TRANSIT_STATUS.ACTIVE) {
            throw httpError(409, 'This trip has already ended')
        }

        const milestone = parseMilestone(req.body)
        const location = milestone.lat !== undefined
            ? { lastLocation: { lat: milestone.lat, lng: milestone.lng, at: milestone.at } }
            : {}

        if (milestone.type === 'home') {
            // "Safely back home" changes two things: the task (completed) and the session
            // (home step + ended). Order matters so a failure never leaves them disagreeing:
            //  1. Complete the task with D's shared function. It checks the same rules as
            //     POST /tasks/:taskId/complete and ends the session. If it fails, nothing
            //     has been written yet, so the error is returned and the trip carries on.
            //  2. Add the home step and set endedAt in ONE atomic update. If that fails, it is
            //     retried once. Even if it still fails, the task is completed and the session
            //     is ended, which is consistent; only the "home" line is missing.
            await completeTask({ familyId, taskId, userId, memberRole: req.memberRole })

            const finish = {
                $push: { milestones: milestone },
                $set: { status: TRANSIT_STATUS.ENDED, endedAt: milestone.at, ...location }
            }
            try {
                await TransitSession.updateOne({ _id: session._id }, finish, { runValidators: true })
            } catch (error) {
                console.error('Retrying home milestone:', error.message)
                await TransitSession.updateOne({ _id: session._id }, finish, { runValidators: true })
            }
        } else {
            const update = { $push: { milestones: milestone } }
            if (location.lastLocation) update.$set = location

            // Only matches while still active, so a step can't land after the trip ended
            const updated = await TransitSession.findOneAndUpdate(
                { _id: session._id, status: TRANSIT_STATUS.ACTIVE },
                update,
                { new: true, runValidators: true }
            )
            if (!updated) throw httpError(409, 'This trip has already ended')
        }

        const transitSession = await populateSession(TransitSession.findById(session._id))
        announce(EVENTS.TRANSIT_MILESTONE, transitSession)
        return res.status(201).json({ transitSession })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// GET /api/families/:familyId/transit?status=active
// For the live banner on Family Home.
export async function listTransitSessions(req, res, next) {
    try {
        const filter = { family: req.family._id }
        const { status } = req.query

        if (status !== undefined) {
            if (!Object.values(TRANSIT_STATUS).includes(status)) {
                throw httpError(400, 'Validation failed', ['Status must be active or ended'])
            }
            filter.status = status
        }

        const transitSessions = await populateSession(
            TransitSession.find(filter).sort({ startedAt: -1 })
        )
        return res.json({ transitSessions })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/tasks/:taskId/transit/end   (companion only)
// "End transit": stops the trip without completing the task (e.g. the appointment was
// called off on the way). The task stays in progress, so it can still be marked done or
// cancelled from My Tasks / Task Detail. "Safely back home" is the normal way to finish.
export async function endTransit(req, res, next) {
    try {
        const taskId = getTaskId(req)
        const session = await TransitSession.findOne({ task: taskId, family: req.family._id })
        if (!session) throw httpError(404, 'Transit session not found')

        if (session.companion.toString() !== req.user.userId) {
            throw httpError(403, 'Only the person on this trip can end it')
        }

        const ended = await TransitSession.findOneAndUpdate(
            { _id: session._id, status: TRANSIT_STATUS.ACTIVE },
            { $set: { status: TRANSIT_STATUS.ENDED, endedAt: new Date() } },
            { new: true }
        )
        if (!ended) throw httpError(409, 'This trip has already ended')

        const transitSession = await populateSession(TransitSession.findById(session._id))
        return res.json({ transitSession })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// PATCH /api/families/:familyId/tasks/:taskId/transit/location   (companion only)
// Body: { lat, lng }. The companion's browser sends this every ~20 s while the trip is
// active, so the family's map shows where they are. Only the latest position is kept.
export async function updateLocation(req, res, next) {
    try {
        const taskId = getTaskId(req)
        const { lat, lng } = req.body || {}
        const errors = []
        if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
            errors.push('lat must be a number between -90 and 90')
        }
        if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
            errors.push('lng must be a number between -180 and 180')
        }
        if (errors.length) throw httpError(400, 'Validation failed', errors)

        const session = await TransitSession.findOne({ task: taskId, family: req.family._id })
        if (!session) throw httpError(404, 'Transit session not found')

        if (session.companion.toString() !== req.user.userId) {
            throw httpError(403, 'Only the person on this trip can share their location')
        }

        // Only while active, so a late update can't land after the trip ended
        const updated = await TransitSession.findOneAndUpdate(
            { _id: session._id, status: TRANSIT_STATUS.ACTIVE },
            { $set: { lastLocation: { lat, lng, at: new Date() } } },
            { new: true }
        )
        if (!updated) throw httpError(409, 'This trip has already ended')

        return res.json({ lastLocation: updated.lastLocation })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/tasks/:taskId/transit/resume   (companion only)
// Undo an accidental "End transit": the same trip carries on with its steps so far.
// Only while the task is still in progress (a completed or cancelled task can't resume).
export async function resumeTransit(req, res, next) {
    try {
        const taskId = getTaskId(req)
        const session = await TransitSession.findOne({ task: taskId, family: req.family._id })
        if (!session) throw httpError(404, 'Transit session not found')

        if (session.companion.toString() !== req.user.userId) {
            throw httpError(403, 'Only the person on this trip can resume it')
        }

        const Task = mongoose.models.Task
        const task = Task ? await Task.findOne({ _id: taskId, family: req.family._id }).select('status claimedBy') : null
        if (!task || task.status !== 'in_progress' || String(task.claimedBy) !== req.user.userId) {
            throw httpError(409, 'Only a trip for a task that is still in progress can be resumed')
        }

        const resumed = await TransitSession.findOneAndUpdate(
            { _id: session._id, status: TRANSIT_STATUS.ENDED },
            { $set: { status: TRANSIT_STATUS.ACTIVE, endedAt: null } },
            { new: true }
        )
        if (!resumed) throw httpError(409, 'This trip is already active')

        const transitSession = await populateSession(TransitSession.findById(session._id))
        return res.json({ transitSession })
    } catch (error) {
        return handleError(error, res, next)
    }
}
