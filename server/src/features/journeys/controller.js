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

const USER_FIELDS = 'name telegramUsername'
const TASK_FIELDS = 'title startAt endAt location status category recipient claimedBy'

function populateSession(query) {
    const taskPopulate = { path: 'task', select: TASK_FIELDS }
    // Recipient model belongs to C; only populate once it is registered
    if (mongoose.models.CareRecipient) {
        taskPopulate.populate = { path: 'recipient', select: 'name nickname careType' }
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
// A "home" milestone ends the session and completes the task.
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

        const update = { $push: { milestones: milestone } }
        if (milestone.lat !== undefined) {
            update.$set = { lastLocation: { lat: milestone.lat, lng: milestone.lng, at: milestone.at } }
        }

        // Only matches while still active, so a double tap after "home" can't post twice
        const updated = await TransitSession.findOneAndUpdate(
            { _id: session._id, status: TRANSIT_STATUS.ACTIVE },
            update,
            { new: true, runValidators: true }
        )
        if (!updated) throw httpError(409, 'This trip has already ended')

        if (milestone.type === 'home') {
            try {
                // D's shared function: same rules as POST /tasks/:taskId/complete.
                // It also sets the session status to ended.
                await completeTask({ familyId, taskId, userId, memberRole: req.memberRole })
            } catch (error) {
                // Task couldn't be completed (e.g. cancelled meanwhile): undo the milestone
                await TransitSession.updateOne(
                    { _id: session._id },
                    { $pull: { milestones: { type: 'home', at: milestone.at } } }
                )
                throw error
            }
            await TransitSession.updateOne(
                { _id: session._id },
                { $set: { status: TRANSIT_STATUS.ENDED, endedAt: milestone.at } }
            )
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
