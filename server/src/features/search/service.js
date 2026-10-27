// Owner: Marcus (D)
// Family search: tasks, care log notes, people and places that match a word.
//
// Every query is filtered by the family passed in (req.family from requireFamilyMember),
// never by an id from the query string. The search word is escaped before it becomes a
// case-insensitive RegExp, so "(" or ".*" are matched literally.
// There is no $text index yet: a family has at most a few thousand rows, so a regex scan
// on the family's documents is fast enough and needs no migration.
import mongoose from 'mongoose'
import Task from '../tasks/TaskModel.js'
import LogEntry from '../logs/CareLog.model.js'
import CareRecipient from '../recipients/CareRecipient.model.js'
import User from '../auth/User.model.js'
import { TASK_STATUS } from '../../constants.js'

export const SEARCH_TYPES = ['all', 'tasks', 'logs', 'people', 'places']
export const SEARCH_WHEN = ['any', 'upcoming', 'past30', 'past180']
export const SEARCH_STATUS = ['any', 'open', 'claimed', 'completed']
export const SEARCH_SORT = ['best', 'newest', 'oldest']

// Safety cap on matches read per group; counts above this show as the cap
const MAX_MATCHES = 500
const DAY = 24 * 60 * 60 * 1000
const SNIPPET_LENGTH = 120

// "Claimed" includes tasks already under way
const STATUS_FILTERS = {
    open: [TASK_STATUS.OPEN],
    claimed: [TASK_STATUS.CLAIMED, TASK_STATUS.IN_PROGRESS],
    completed: [TASK_STATUS.COMPLETED]
}

const CARE_TYPE_LABELS = {
    elderly: 'Elderly care',
    pregnancy: 'Pregnancy',
    postpartum: 'Postpartum care',
    infant: 'Infant',
    injury: 'Injury recovery',
    other: 'Care recipient'
}

// ---------- Text helpers ----------

export function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 0 = one of the exact fields equals the word, 1 = some field starts with it, 2 = anywhere
function matchTier(exactFields, allFields, q) {
    const word = q.toLowerCase()
    const clean = (text) => (text || '').trim().toLowerCase()
    if (exactFields.some((text) => clean(text) === word)) return 0
    if (allFields.some((text) => clean(text).startsWith(word))) return 1
    return 2
}

// About 120 characters centred on the first match, with "…" where it was cut
export function makeSnippet(text, q, size = SNIPPET_LENGTH) {
    const clean = (text || '').replace(/\s+/g, ' ').trim()
    if (clean.length <= size) return clean

    const at = clean.toLowerCase().indexOf(q.toLowerCase())
    const centre = at < 0 ? 0 : at + q.length / 2
    let end = Math.min(clean.length, Math.max(size, Math.round(centre + size / 2)))
    let start = Math.max(0, end - size)

    // Cut at spaces, never inside the match
    if (start > 0) {
        const space = clean.indexOf(' ', start)
        if (space > -1 && (at < 0 || space < at)) start = space + 1
    }
    if (end < clean.length) {
        const space = clean.lastIndexOf(' ', end)
        if (space > start && (at < 0 || space >= at + q.length)) end = space
    }

    return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`
}

// ---------- Shared shapes ----------

const idOf = (doc) => (doc?._id ?? doc)?.toString()

function recipientRef(recipient) {
    if (!recipient || typeof recipient !== 'object') return null
    return { id: idOf(recipient), name: recipient.nickname || recipient.name }
}

function userRef(user) {
    if (!user || typeof user !== 'object') return null
    return { id: idOf(user), name: user.name }
}

function placeKey(name, address) {
    return `${(name || '').trim().toLowerCase()}|${(address || '').trim().toLowerCase()}`
}

// Date window for a "when" filter, or null for any time
function dateRange(when, now) {
    if (when === 'upcoming') return { $gte: now }
    if (when === 'past30') return { $gte: new Date(now - 30 * DAY), $lte: now }
    if (when === 'past180') return { $gte: new Date(now - 180 * DAY), $lte: now }
    return null
}

const byDate = (field, direction) => (a, b) => direction * (new Date(a[field]) - new Date(b[field]))

// ---------- Tasks ----------

async function searchTasks(familyId, re, { q, recipient, when, status, sort }, now) {
    const filter = {
        family: familyId,
        status: status === 'any' ? { $ne: TASK_STATUS.CANCELLED } : { $in: STATUS_FILTERS[status] },
        $or: [{ title: re }, { description: re }, { 'location.name': re }, { 'location.address': re }]
    }
    if (recipient) filter.recipient = recipient
    const range = dateRange(when, now)
    if (range) filter.startAt = range

    const tasks = await Task.find(filter)
        .populate('recipient', 'name nickname')
        .populate('claimedBy', 'name')
        .limit(MAX_MATCHES)
        .lean()

    const results = tasks.map((task) => ({
        id: idOf(task),
        title: task.title,
        recipient: recipientRef(task.recipient),
        startAt: task.startAt,
        status: task.status,
        needsTransit: Boolean(task.needsTransit),
        place: task.location?.name || task.location?.address || '',
        claimedBy: userRef(task.claimedBy),
        matchTier: matchTier(
            [task.title],
            [task.title, task.description, task.location?.name, task.location?.address],
            q
        )
    }))

    if (sort === 'newest') return results.sort(byDate('startAt', -1))
    if (sort === 'oldest') return results.sort(byDate('startAt', 1))
    // Best: tier, then upcoming (soonest first) before past (latest first)
    return results.sort((a, b) => {
        if (a.matchTier !== b.matchTier) return a.matchTier - b.matchTier
        const aUpcoming = new Date(a.startAt) >= now
        const bUpcoming = new Date(b.startAt) >= now
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
        return aUpcoming ? byDate('startAt', 1)(a, b) : byDate('startAt', -1)(a, b)
    })
}

// ---------- Care log ----------

async function searchLogs(familyId, re, { q, recipient, when, sort }, now) {
    const filter = {
        family: familyId,
        // Original text only; the translations Map is never searched
        $or: [
            { content: re },
            { 'consultation.doctorName': re },
            { 'consultation.clinic': re },
            { 'medicationChanges.name': re },
            { 'medicationChanges.details': re }
        ]
    }
    if (recipient) filter.recipient = recipient
    const range = dateRange(when, now)
    // An upcoming note is a consultation whose next appointment is still ahead
    if (when === 'upcoming') filter['consultation.nextAppointment'] = range
    else if (range) filter.createdAt = range

    const logs = await LogEntry.find(filter)
        .populate('recipient', 'name nickname')
        .populate('author', 'name')
        .limit(MAX_MATCHES)
        .lean()

    const results = logs.map((log) => {
        const changes = log.medicationChanges || []
        const medication = changes.find((change) => re.test(change.name) || re.test(change.details)) || changes[0]
        const doctorName = log.consultation?.doctorName || ''
        const clinic = log.consultation?.clinic || ''

        // Snippet from the note itself, or from whichever field matched
        const snippetSource = [log.content, medication?.details, medication?.name, doctorName, clinic]
            .find((text) => text && re.test(text)) || log.content

        const result = {
            id: idOf(log),
            type: log.type,
            recipient: recipientRef(log.recipient),
            author: userRef(log.author),
            createdAt: log.createdAt,
            snippet: makeSnippet(snippetSource, q),
            matchTier: matchTier(
                [doctorName, ...changes.map((change) => change.name)],
                [log.content, doctorName, clinic, ...changes.flatMap((change) => [change.name, change.details])],
                q
            )
        }
        if (doctorName) result.doctorName = doctorName
        if (clinic) result.clinic = clinic
        if (medication) {
            result.medication = { name: medication.name, change: medication.change, details: medication.details || '' }
        }
        return result
    })

    if (sort === 'oldest') return results.sort(byDate('createdAt', 1))
    if (sort === 'newest') return results.sort(byDate('createdAt', -1))
    return results.sort((a, b) => a.matchTier - b.matchTier || byDate('createdAt', -1)(a, b))
}

// ---------- People ----------

async function searchPeople(family, re, { q, recipient }) {
    const recipientFilter = { family: family._id, isActive: true, $or: [{ name: re }, { nickname: re }] }
    if (recipient) recipientFilter._id = recipient

    const recipients = await CareRecipient.find(recipientFilter)
        .select('name nickname careType profilePicture')
        .limit(MAX_MATCHES)
        .lean()

    // Members aren't "for" a recipient, so a recipient filter leaves them out
    let members = []
    if (!recipient) {
        const roles = new Map(family.members.map((member) => [idOf(member.userId), member.role]))
        const users = await User.find({ _id: { $in: [...roles.keys()] }, name: re })
            .select('name profilePicture')
            .limit(MAX_MATCHES)
            .lean()
        members = users.map((user) => ({
            id: idOf(user),
            kind: 'member',
            name: user.name,
            subtitle: roles.get(idOf(user)) === 'admin' ? 'Family admin' : 'Family member',
            profilePicture: user.profilePicture || '',
            matchTier: matchTier([user.name], [user.name], q)
        }))
    }

    const people = recipients.map((person) => {
        const careLabel = CARE_TYPE_LABELS[person.careType] || CARE_TYPE_LABELS.other
        return {
            id: idOf(person),
            kind: 'recipient',
            name: person.nickname || person.name,
            subtitle: person.nickname ? `${careLabel} · ${person.name}` : careLabel,
            profilePicture: person.profilePicture || '',
            careType: person.careType,
            matchTier: matchTier([person.name, person.nickname], [person.name, person.nickname], q)
        }
    })

    return [...people, ...members].sort((a, b) => a.matchTier - b.matchTier || a.name.localeCompare(b.name))
}

// ---------- Places ----------

// Each recipient's most frequent task place, as Map(placeKey -> { id, name }).
// A place needs at least two tasks to count as someone's usual place.
export async function findFrequentPlaces(familyId) {
    const rows = await Task.aggregate([
        { $match: {
            family: new mongoose.Types.ObjectId(String(familyId)),
            status: { $ne: TASK_STATUS.CANCELLED },
            recipient: { $ne: null },
            $or: [{ 'location.name': { $nin: ['', null] } }, { 'location.address': { $nin: ['', null] } }]
        } },
        { $group: {
            _id: {
                recipient: '$recipient',
                name: { $toLower: { $trim: { input: { $ifNull: ['$location.name', ''] } } } },
                address: { $toLower: { $trim: { input: { $ifNull: ['$location.address', ''] } } } }
            },
            count: { $sum: 1 }
        } },
        { $sort: { count: -1 } },
        { $group: { _id: '$_id.recipient', name: { $first: '$_id.name' }, address: { $first: '$_id.address' }, count: { $first: '$count' } } },
        { $match: { count: { $gte: 2 } } }
    ])

    const recipients = await CareRecipient.find({ _id: { $in: rows.map((row) => row._id) } })
        .select('name nickname')
        .lean()
    const names = new Map(recipients.map((recipient) => [idOf(recipient), recipientRef(recipient)]))

    const usual = new Map()
    for (const row of rows) {
        const key = placeKey(row.name, row.address)
        const who = names.get(idOf(row._id))
        if (who && !usual.has(key)) usual.set(key, who)
    }
    return usual
}

async function searchPlaces(familyId, re, { q, recipient }) {
    const match = {
        family: new mongoose.Types.ObjectId(String(familyId)),
        status: { $ne: TASK_STATUS.CANCELLED },
        $or: [{ 'location.name': re }, { 'location.address': re }]
    }
    if (recipient) match.recipient = new mongoose.Types.ObjectId(recipient)

    const [rows, usual] = await Promise.all([
        Task.aggregate([
            { $match: match },
            { $group: {
                _id: {
                    name: { $toLower: { $trim: { input: { $ifNull: ['$location.name', ''] } } } },
                    address: { $toLower: { $trim: { input: { $ifNull: ['$location.address', ''] } } } }
                },
                name: { $first: '$location.name' },
                address: { $first: '$location.address' },
                postal: { $max: '$location.postal' },
                taskCount: { $sum: 1 }
            } },
            { $limit: MAX_MATCHES }
        ]),
        findFrequentPlaces(familyId)
    ])

    return rows
        .map((row) => ({
            name: row.name || row.address,
            address: row.name ? row.address || '' : '',
            postal: row.postal || '',
            taskCount: row.taskCount,
            usualFor: usual.get(placeKey(row._id.name, row._id.address)) || null,
            matchTier: matchTier([row.name], [row.name, row.address], q)
        }))
        .sort((a, b) => a.matchTier - b.matchTier || b.taskCount - a.taskCount || a.name.localeCompare(b.name))
}

// ---------- Entry point ----------

// family: the Family document from requireFamilyMember
// params: checked by controller.js ({ q, type, when, status, sort, recipient, limit })
export async function runSearch(family, params) {
    const { q, type, limit } = params
    const re = new RegExp(escapeRegExp(q), 'i')
    const now = new Date()

    // Counts are always for every type, so the filter pills can show them
    const [tasks, logs, people, places] = await Promise.all([
        searchTasks(family._id, re, params, now),
        searchLogs(family._id, re, params, now),
        searchPeople(family, re, params),
        searchPlaces(family._id, re, params)
    ])

    const groups = { tasks, logs, people, places }
    const counts = { tasks: tasks.length, logs: logs.length, people: people.length, places: places.length }
    counts.all = counts.tasks + counts.logs + counts.people + counts.places

    const results = {}
    for (const [key, list] of Object.entries(groups)) {
        results[key] = type === 'all' || type === key ? list.slice(0, limit) : []
    }

    return { query: q, counts, results }
}
