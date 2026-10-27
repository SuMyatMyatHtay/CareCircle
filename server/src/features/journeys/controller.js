// Owner: Chaithra (E)
// Handlers for transit sessions. See docs/API-CONTRACT.md (section E).
//
// requireAuth + requireFamilyMember run before every handler, so these are always set:
//   req.user.userId, req.family, req.memberRole
import mongoose from 'mongoose'
import TransitSession, { MILESTONE_LABELS, PATH_LIMIT } from './Journey.model.js'
import { completeTask } from '../tasks/controller.js'
import { syncInBackground } from '../calendar-sync/sync.js'
import { MILESTONE_TYPES, TRANSIT_STATUS, EVENTS } from '../../constants.js'
import { notify } from '../../utils/notify.js'
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
// replaced
async function announce(eventType, transitSession) {
     await notify(transitSession.family, eventType, transitSession)
}

const USER_FIELDS = 'name telegramUsername profilePicture'
const TASK_FIELDS = 'title startAt endAt location status category recipient claimedBy'

function populateSession(query) {
    const taskPopulate = { path: 'task', select: TASK_FIELDS }
    // Recipient model belongs to C; only populate once it is registered
    if (mongoose.models.CareRecipient) {
        taskPopulate.populate = { path: 'recipient', select: 'name nickname careType profilePicture linkedUser' }
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
        const point = milestone.lat !== undefined ? { lat: milestone.lat, lng: milestone.lng, at: milestone.at } : null
        const location = point ? { lastLocation: point } : {}
        const trail = point ? { path: { $each: [point], $slice: -PATH_LIMIT } } : {}

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
            syncInBackground(userId) // shows as done (✓) in their Google Calendar

            const finish = {
                $push: { milestones: milestone, ...trail },
                $set: { status: TRANSIT_STATUS.ENDED, endedAt: milestone.at, ...location }
            }
            try {
                await TransitSession.updateOne({ _id: session._id }, finish, { runValidators: true })
            } catch (error) {
                console.error('Retrying home milestone:', error.message)
                await TransitSession.updateOne({ _id: session._id }, finish, { runValidators: true })
            }
        } else {
            const update = { $push: { milestones: milestone, ...trail } }
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
        await announce(EVENTS.TRANSIT_MILESTONE, transitSession)
        return res.status(201).json({ transitSession })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// DELETE /api/families/:familyId/tasks/:taskId/transit/milestones?at=<the step's at>   (companion only)
// Remove a step posted by mistake (e.g. a typo in a custom update). Steps have no id, so
// the step's own `at` time picks it. "Safely back home" can't be removed: it completed the task.
export async function removeMilestone(req, res, next) {
    try {
        const taskId = getTaskId(req)
        const at = new Date(req.query.at)
        if (!req.query.at || Number.isNaN(at.getTime())) {
            throw httpError(400, 'Validation failed', ['at must be the time of the step to remove'])
        }

        const session = await TransitSession.findOne({ task: taskId, family: req.family._id })
        if (!session) throw httpError(404, 'Transit session not found')
        if (session.companion.toString() !== req.user.userId) {
            throw httpError(403, 'Only the person on this trip can remove updates')
        }

        const step = session.milestones.find((m) => m.at && m.at.getTime() === at.getTime())
        if (!step) throw httpError(404, 'Update not found')
        if (step.type === 'home') throw httpError(409, '"Safely back home" finished the task, so it can\'t be removed')

        await TransitSession.updateOne(
            { _id: session._id },
            { $pull: { milestones: { at, type: { $ne: 'home' } } } }
        )

        const transitSession = await populateSession(TransitSession.findById(session._id))
        return res.json({ transitSession })
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

// ---------- Trail helpers ----------

// Straight-line distance in metres between two { lat, lng }
function metres(a, b) {
    const R = 6371000
    const rad = (d) => (d * Math.PI) / 180
    const dLat = rad(b.lat - a.lat)
    const dLng = rad(b.lng - a.lng)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
}

// Road points between two places (without the two ends), or [] if the lookup fails
async function roadBetween(a, b) {
    try {
        const url = `${OSRM_URL}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
        const data = await response.json()
        const coords = data.routes?.[0]?.geometry?.coordinates || []
        return thinLine(coords, 60).slice(1, -1).map(([lng, lat]) => ({ lat, lng, at: b.at }))
    } catch {
        return []
    }
}

// How a new position is added to the trail (and saved as lastLocation):
//  - an impossible jump (over 2 km at more than 120 km/h, e.g. a phone that had no GPS fix,
//    or switching devices) starts the trail again from here instead of drawing a straight
//    line across Singapore
//  - a gap of over 150 m (e.g. the page was closed for a while) is filled in along the roads
//  - otherwise the point is simply added
// Returns the whole MongoDB update, including the new lastLocation.
async function trailUpdate(path, point) {
    const last = path?.length ? path[path.length - 1] : null
    const add = (points) => ({
        $set: { lastLocation: point },
        $push: { path: { $each: points, $slice: -PATH_LIMIT } }
    })
    if (!last) return add([point])

    const gap = metres(last, point)
    const seconds = Math.max(1, (point.at - new Date(last.at)) / 1000)
    if (gap > 2000 && gap / seconds > 33) return { $set: { lastLocation: point, path: [point] } }

    const between = gap > 150 ? await roadBetween(last, point) : []
    return add([...between, point])
}

// PATCH /api/families/:familyId/tasks/:taskId/transit/location   (companion only)
// Body: { lat, lng }. The companion's browser sends this every ~20 s while the trip is
// active, so the family's map shows where they are and the trail they've travelled.
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

        // Only while active, so a late update can't land after the trip ended.
        // The point also goes on the trail (oldest points drop off after PATH_LIMIT),
        // following the roads from the previous point (see trailUpdate).
        const point = { lat, lng, at: new Date() }
        const updated = await TransitSession.findOneAndUpdate(
            { _id: session._id, status: TRANSIT_STATUS.ACTIVE },
            await trailUpdate(session.path, point),
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

// ---------- Road helpers (OSRM) ----------
// OSRM is the free routing service on OpenStreetMap data (no API key). Only used to
// fill a gap in the trail along the roads (see trailUpdate).
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

function thinLine(coords, max = 300) {
    if (coords.length <= max) return coords
    const step = Math.ceil(coords.length / max)
    const kept = coords.filter((_, i) => i % step === 0)
    kept.push(coords[coords.length - 1])
    return kept
}
