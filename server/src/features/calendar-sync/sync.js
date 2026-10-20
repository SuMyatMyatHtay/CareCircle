// Owner: Chaithra (E)
// Keeps a person's Google Calendar in step with the CareCircle tasks they've claimed:
//   - claimed / in progress / done  -> event added (or updated if the time/place changed)
//   - given back, cancelled, deleted, or they left the family -> event removed
// Runs after task changes (see autoSync.js) and when they open My Tasks.
import mongoose from 'mongoose'
import Task from '../tasks/TaskModel.js'
import Family from '../families/Family.model.js'
import GoogleCalendarLink from './GoogleCalendarLink.model.js'
import { isConfigured, accessTokenFor, calendarRequest, appOrigin } from './google.js'

const KEEP_STATUSES = ['claimed', 'in_progress', 'completed']
const LOOK_BACK_DAYS = 30 // older tasks are left alone
const HOUR = 60 * 60 * 1000

function eventFor(task) {
    const start = new Date(task.startAt)
    const end = task.endAt ? new Date(task.endAt) : new Date(start.getTime() + HOUR)
    const loc = task.location || {}
    const who = task.recipient?.nickname || task.recipient?.name
    const done = task.status === 'completed'
    const link = `${appOrigin()}/families/${task.family._id || task.family}/tasks/${task._id}`

    return {
        summary: `${done ? '✓ ' : ''}${task.title}${who ? ` · ${who}` : ''}`,
        location: [loc.name, loc.address, loc.postal ? `S${loc.postal}` : ''].filter(Boolean).join(', '),
        description: [
            task.family?.name ? `${task.family.name} · CareCircle` : 'CareCircle',
            task.description || '',
            `Open in CareCircle: ${link}`
        ].filter(Boolean).join('\n\n'),
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Singapore' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Singapore' },
        reminders: { useDefault: true },
        extendedProperties: { private: { careCircleTaskId: String(task._id) } }
    }
}

// The tasks that should be in this person's calendar right now
async function tasksToShow(userId) {
    const families = await Family.find({ 'members.userId': userId }).select('_id')
    const query = Task.find({
        claimedBy: userId,
        status: { $in: KEEP_STATUSES },
        family: { $in: families.map((f) => f._id) },
        startAt: { $gte: new Date(Date.now() - LOOK_BACK_DAYS * 24 * HOUR) }
    }).populate('family', 'name')
    if (mongoose.models.CareRecipient) query.populate('recipient', 'name nickname')
    return query
}

async function syncNow(userId) {
    const link = await GoogleCalendarLink.findOne({ user: userId }).select('+refreshToken')
    if (!link) return { connected: false }

    let token
    try {
        token = await accessTokenFor(link.refreshToken)
    } catch (error) {
        // invalid_grant: they removed CareCircle's access in their Google account
        if (error.google === 'invalid_grant') {
            await GoogleCalendarLink.deleteOne({ _id: link._id })
            return { connected: false }
        }
        throw error
    }

    const tasks = await tasksToShow(userId)
    const wanted = new Set(tasks.map((t) => String(t._id)))
    const events = new Map(link.events)
    let added = 0
    let updated = 0
    let removed = 0

    for (const task of tasks) {
        const id = String(task._id)
        const body = eventFor(task)
        const eventId = events.get(id)
        if (eventId) {
            try {
                await calendarRequest(token, 'PATCH', eventId, body)
                updated++
                continue
            } catch (error) {
                // They deleted it in Google Calendar themselves: add it again below
                if (![404, 410].includes(error.status)) throw error
            }
        }
        const created = await calendarRequest(token, 'POST', null, body)
        events.set(id, created.id)
        added++
    }

    for (const [taskId, eventId] of events) {
        if (wanted.has(taskId)) continue
        try {
            await calendarRequest(token, 'DELETE', eventId)
        } catch (error) {
            if (![404, 410].includes(error.status)) throw error // already gone is fine
        }
        events.delete(taskId)
        removed++
    }

    link.events = events
    link.lastSyncedAt = new Date()
    link.lastError = ''
    await link.save()
    return { connected: true, added, updated, removed }
}

// One sync per person at a time; a request that comes in during a sync waits for it
// and then runs once more, so the last change always lands.
const running = new Map()
export function syncUser(userId) {
    if (!isConfigured() || !userId) return Promise.resolve({ connected: false })
    const key = String(userId)
    const current = running.get(key)
    if (current) {
        current.again = true
        return current.promise
    }
    const state = { again: false }
    state.promise = (async () => {
        try {
            let result = await syncNow(key)
            while (state.again) {
                state.again = false
                result = await syncNow(key)
            }
            return result
        } catch (error) {
            console.error('Google Calendar sync failed:', error.message)
            await GoogleCalendarLink.updateOne({ user: key }, { $set: { lastError: error.message } }).catch(() => {})
            throw error
        } finally {
            running.delete(key)
        }
    })()
    running.set(key, state)
    return state.promise
}

// Fire-and-forget version for background syncs (never throws)
export function syncInBackground(...userIds) {
    if (!isConfigured()) return
    for (const id of new Set(userIds.filter(Boolean).map(String))) {
        syncUser(id).catch(() => {})
    }
}

// Removes every CareCircle event from their calendar (used when disconnecting)
export async function removeAllEvents(link) {
    const token = await accessTokenFor(link.refreshToken)
    for (const eventId of link.events.values()) {
        await calendarRequest(token, 'DELETE', eventId).catch(() => {})
    }
}
