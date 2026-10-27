// Owner: SeungHak (F)
// Dates and events for the family Calendar. Pure functions, so they are easy to test.
// Everything is in Singapore time (no daylight saving, always +08:00).
// Weeks start on Monday, like the Contributions page.
import { taskRecipientId } from '../../composables/useFamilyTasks.js'
import { displayName } from '../recipients/recipientLabels.js'

const TIME_ZONE = 'Asia/Singapore'
const OFFSET = '+08:00'
const DAY = 24 * 60 * 60 * 1000

// Any date -> "2026-10-27" (its day in Singapore)
export function dayKey(value) {
    return new Date(value).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

// "2026-10-27" -> "2026-10"
export function monthOf(key) {
    return key.slice(0, 7)
}

// Noon keeps the day the same whatever the browser's own time zone is
function noon(key) {
    return new Date(`${key}T12:00:00${OFFSET}`)
}

export function addDays(key, days) {
    return dayKey(noon(key).getTime() + days * DAY)
}

// "2026-10" + 1 -> "2026-11"
export function shiftMonth(month, by) {
    const [year, mon] = month.split('-').map(Number)
    const total = year * 12 + (mon - 1) + by
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

// 0 = Monday ... 6 = Sunday
function weekdayIndex(key) {
    return (noon(key).getUTCDay() + 6) % 7
}

// Whole weeks covering the month: [{ key, day, inMonth }], 35 or 42 days
export function monthGrid(month) {
    const first = `${month}-01`
    const start = addDays(first, -weekdayIndex(first))
    const lastOfMonth = addDays(`${shiftMonth(month, 1)}-01`, -1)
    const end = addDays(lastOfMonth, 6 - weekdayIndex(lastOfMonth))

    const days = []
    for (let key = start; key <= end; key = addDays(key, 1)) {
        days.push({ key, day: Number(key.slice(8)), inMonth: monthOf(key) === month })
    }
    return days
}

// The first and last moment shown on the grid, for the API's from/to
export function gridRange(month) {
    const days = monthGrid(month)
    return {
        from: new Date(`${days[0].key}T00:00:00${OFFSET}`),
        to: new Date(`${days[days.length - 1].key}T23:59:59.999${OFFSET}`)
    }
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// "October 2026"
export function monthLabel(month) {
    return noon(`${month}-01`).toLocaleDateString('en-SG', { month: 'long', year: 'numeric', timeZone: TIME_ZONE })
}

// "Tuesday 27 October"
export function dayLabel(key) {
    return noon(key)
        .toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE })
        .replace(',', '')
}

// "2:30pm"
export function timeLabel(value) {
    return new Date(value)
        .toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE })
        .replace(/\s/g, '')
        .toLowerCase()
}

// "2:00pm" -> "2pm", for the small chips on the grid
export function shortTime(label) {
    return label.replace(':00', '')
}

// ---- Events ----

// What the family needs to know at a glance. "missed": still open after it started.
export function taskState(task, now = Date.now()) {
    if (task.status === 'open' && new Date(task.startAt).getTime() <= now) return 'missed'
    return task.status
}

export const STATE_LABELS = {
    open: 'Needs someone',
    missed: 'Nobody took it',
    claimed: 'Claimed',
    in_progress: 'In progress',
    completed: 'Done',
    cancelled: 'Cancelled',
    appointment: 'Next appointment'
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || ''

// Tasks and "next appointment" notes -> one sorted list of calendar events.
// Cancelled tasks are left out: they won't happen.
export function buildEvents({ tasks = [], appointmentNotes = [], familyId, now = Date.now() }) {
    const events = []

    for (const task of tasks) {
        if (task.status === 'cancelled' || !task.startAt) continue
        const state = taskState(task, now)
        const claimer = typeof task.claimedBy === 'object' ? task.claimedBy?.name : ''
        events.push({
            id: `task-${task._id}`,
            kind: 'task',
            day: dayKey(task.startAt),
            at: new Date(task.startAt).getTime(),
            time: timeLabel(task.startAt),
            endTime: task.endAt ? timeLabel(task.endAt) : '',
            title: task.title,
            recipientId: taskRecipientId(task),
            recipientName: displayName(task.recipient) || 'Household',
            place: task.location?.name || '',
            state,
            who: claimer && ['claimed', 'in_progress', 'completed'].includes(state) ? firstName(claimer) : '',
            to: { name: 'task-detail', params: { familyId, taskId: task._id } }
        })
    }

    for (const note of appointmentNotes) {
        const next = note.consultation?.nextAppointment
        if (!next) continue
        const recipientId = note.recipient?._id ?? note.recipient ?? null
        const where = [note.consultation.doctorName, note.consultation.clinic].filter(Boolean).join(', ')
        events.push({
            id: `appointment-${note._id}`,
            kind: 'appointment',
            day: dayKey(next),
            at: new Date(next).getTime(),
            time: timeLabel(next),
            endTime: '',
            title: where ? `Follow-up with ${where}` : 'Follow-up appointment',
            recipientId,
            recipientName: displayName(note.recipient) || 'Care recipient',
            place: '',
            state: 'appointment',
            who: '',
            to: recipientId ? { name: 'recipient-log', params: { recipientId } } : null
        })
    }

    return events.sort((a, b) => a.at - b.at)
}

// Everyone, one recipient's events, or tasks for nobody in particular ("household")
export function filterEvents(events, recipient) {
    if (!recipient || recipient === 'all') return events
    if (recipient === 'household') return events.filter((event) => event.kind === 'task' && !event.recipientId)
    return events.filter((event) => event.recipientId === recipient)
}

// { "2026-10-27": [events...] }
export function groupByDay(events) {
    const days = {}
    for (const event of events) (days[event.day] ||= []).push(event)
    return days
}
