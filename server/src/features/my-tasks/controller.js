// Owner: Chaithra (E)
// GET /api/me/tasks: the logged-in user's claimed tasks across all their families.
// Reads D's tasks collection and extends open-ended recurring schedules.
import mongoose from 'mongoose'
import Task from '../tasks/TaskModel.js'
import { ensureRecurringTasks } from '../tasks/recurringService.js'
import Family from '../families/Family.model.js'
import { TASK_STATUSES } from '../../constants.js'
import { syncInBackground } from '../calendar-sync/sync.js'

// Opening My Tasks also refreshes Google Calendar (at most once a minute per person)
const lastCalendarSync = new Map()
function refreshCalendar(userId) {
    const last = lastCalendarSync.get(userId) || 0
    if (Date.now() - last < 60 * 1000) return
    lastCalendarSync.set(userId, Date.now())
    syncInBackground(userId)
}

const USER_FIELDS = 'name telegramUsername profilePicture'

function parseDate(value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

// Query (all optional): status=claimed,in_progress,completed  from=<date>  to=<date>
export async function getMyTasks(req, res, next) {
    try {
        const userId = req.user.userId
        const { status, from, to } = req.query
        refreshCalendar(userId)
        const errors = []

        // Only families the user still belongs to, so leaving a family hides its tasks
        const families = await Family.find({ 'members.userId': userId }).select('_id')
        for (const family of families) await ensureRecurringTasks(family._id)
        const filter = {
            claimedBy: userId,
            family: { $in: families.map((f) => f._id) }
        }

        if (status !== undefined) {
            const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean)
            if (!statuses.length || statuses.some((s) => !TASK_STATUSES.includes(s))) {
                errors.push(`Status must be one or more of: ${TASK_STATUSES.join(', ')}`)
            } else {
                filter.status = { $in: statuses }
            }
        }

        if (from !== undefined || to !== undefined) {
            filter.startAt = {}
            if (from !== undefined) {
                const fromDate = parseDate(from)
                if (!fromDate) errors.push('from must be a valid date')
                else filter.startAt.$gte = fromDate
            }
            if (to !== undefined) {
                const toDate = parseDate(to)
                if (!toDate) errors.push('to must be a valid date')
                else filter.startAt.$lte = toDate
            }
        }

        if (errors.length) {
            return res.status(400).json({ error: 'Validation failed', errors })
        }

        const query = Task.find(filter)
            .sort({ startAt: 1, createdAt: 1 })
            .populate('family', 'name')
            .populate('createdBy', USER_FIELDS)
            .populate('claimedBy', USER_FIELDS)
        // Recipient model belongs to C; only populate once it is registered
        if (mongoose.models.CareRecipient) query.populate('recipient', 'name nickname careType profilePicture')

        const tasks = await query
        return res.json({ tasks })
    } catch (error) {
        return next(error)
    }
}
