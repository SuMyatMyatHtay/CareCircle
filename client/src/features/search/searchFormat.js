// Owner: Marcus (D)
// Turns search results into what a row shows: lead tile, title, meta line, status and link.
// Pure functions, shared by the search bar dropdown and the search page.

const TIME_ZONE = 'Asia/Singapore'
const DAY = 24 * 60 * 60 * 1000

// Group order in the dropdown and on the page
export const GROUPS = [
    { key: 'tasks', kind: 'task', label: 'Tasks', heading: 'Tasks', show: 'Tasks', more: (n) => `${n} more ${n === 1 ? 'task' : 'tasks'}` },
    { key: 'logs', kind: 'log', label: 'Care log', heading: 'Care log', show: 'Care log notes', more: (n) => `${n} more in the care log` },
    { key: 'people', kind: 'person', label: 'People', heading: 'People', show: 'People', more: (n) => `${n} more ${n === 1 ? 'person' : 'people'}` },
    { key: 'places', kind: 'place', label: 'Places', heading: 'Places', show: 'Places', more: (n) => `${n} more ${n === 1 ? 'place' : 'places'}` }
]

// ---------- Dates (Singapore time, like the rest of the app) ----------

const singaporeDay = (date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(date))

function format(date, options) {
    return new Date(date).toLocaleString('en-SG', { timeZone: TIME_ZONE, ...options })
}

// "10:00am"
export function timeText(date) {
    return format(date, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase()
}

// "14 Oct"
export function shortDate(date) {
    return format(date, { day: 'numeric', month: 'short' })
}

// "Thu 29 Oct"
function dayDate(date) {
    return `${format(date, { weekday: 'short' })} ${shortDate(date)}`
}

function daysFromToday(date, now) {
    return Math.round((Date.parse(singaporeDay(date)) - Date.parse(singaporeDay(now))) / DAY)
}

// Lead tile for a task: TODAY, a weekday for the coming week (THU), otherwise 14 OCT
export function dayLabel(date, now = new Date()) {
    const days = daysFromToday(date, now)
    if (days === 0) return 'TODAY'
    if (days > 0 && days < 7) return format(date, { weekday: 'short' }).toUpperCase()
    return shortDate(date).toUpperCase()
}

// ---------- Rows ----------

const join = (parts) => parts.filter((part) => part && (part.text ?? part))

// A meta part; `mark` parts get the search word highlighted
const plain = (text) => ({ text })
const marked = (text) => ({ text, mark: true })

function taskRow(task, { variant }, now) {
    const page = variant === 'page'
    const days = daysFromToday(task.startAt, now)
    const isPast = new Date(task.startAt) < now && days !== 0
    const isDone = task.status === 'completed'
    // Coral: still needs someone. Green: today or someone has it. Grey: past or done.
    const tone = isDone || isPast ? 'grey' : task.status === 'open' && days !== 0 ? 'coral' : 'green'

    let who = ''
    if (isDone && task.claimedBy) who = `done by ${task.claimedBy.name}`
    else if (task.claimedBy) who = `${task.claimedBy.name} has it`

    let when
    if (page) when = days === 0 ? `today ${timeText(task.startAt)}` : dayDate(task.startAt)
    else if (variant === 'card') when = days === 0 ? `today ${timeText(task.startAt)}` : format(task.startAt, { weekday: 'short' })
    else when = isDone ? '' : timeText(task.startAt)

    return {
        lead: { text: dayLabel(task.startAt, now), tone },
        title: task.title,
        meta: join([page && plain('Task'), task.recipient && plain(task.recipient.name), when && plain(when),
            task.place && marked(task.place), who && plain(who)]),
        status: task.status
    }
}

const MEDICATION_WORDS = { added: 'added', stopped: 'stopped', dosage_changed: 'changed' }

export function logTitle(log) {
    if (log.type === 'consultation') return log.doctorName ? `Consultation · ${log.doctorName}` : 'Consultation'
    if (log.type === 'medication_change' && log.medication) {
        return `Medication ${MEDICATION_WORDS[log.medication.change] || 'changed'} · ${log.medication.name}`
    }
    if (log.type === 'diet') return 'Diet note'
    if (log.type === 'symptom') return 'Symptom note'
    return log.author ? `Note from ${log.author.name}` : 'Note'
}

function logRow(log, { variant }) {
    const isMedication = log.type === 'medication_change'
    const lead = log.type === 'consultation'
        ? { text: 'Dr', tone: 'green' }
        : isMedication ? { text: 'Rx', tone: 'amber' } : { text: 'Nt', tone: 'green' }
    const quote = log.snippet ? marked(`“${log.snippet}”`) : null
    const detail = isMedication ? marked(log.medication?.details || log.snippet) : quote
    const date = plain(shortDate(log.createdAt))
    const recipient = log.recipient && plain(log.recipient.name)
    const author = log.author && plain(log.author.name)

    let meta
    if (variant === 'page') meta = [plain('Care log'), isMedication && plain('medication'), detail, date]
    // Phone cards show the quote on its own line (`quote` below)
    else if (variant === 'card') meta = isMedication ? [recipient, detail] : [recipient, author, date]
    else meta = isMedication ? [recipient, detail, date] : [quote, recipient, author, date]

    return {
        lead,
        title: logTitle(log),
        quote: variant === 'card' && !isMedication && log.snippet ? `“${log.snippet}”` : '',
        meta: join(meta)
    }
}

function personRow(person) {
    return {
        avatar: { name: person.name, profilePicture: person.profilePicture, careType: person.careType },
        title: person.name,
        meta: join([plain(person.subtitle)])
    }
}

function placeRow(place, { variant }) {
    const page = variant === 'page'
    const tasks = `${place.taskCount} ${place.taskCount === 1 ? 'task' : 'tasks'}`
    return {
        lead: { text: 'PIN', tone: 'grey' },
        title: place.name,
        meta: page
            ? join([plain('Place'), place.address && marked(place.address), place.postal && plain(`S${place.postal}`), plain(tasks)])
            : join([plain(`${tasks} here`), place.usualFor && plain(`${place.usualFor.name}'s usual place`)])
    }
}

// kind: 'task' | 'log' | 'person' | 'place'
// variant: 'compact' (dropdown), 'page' (results page, longer meta) or 'card' (phone cards)
export function describeResult(kind, item, { variant = 'compact', now = new Date() } = {}) {
    if (kind === 'task') return taskRow(item, { variant }, now)
    if (kind === 'log') return logRow(item, { variant })
    if (kind === 'person') return personRow(item)
    return placeRow(item, { variant })
}

// Where a result goes when it's opened
export function resultLink(kind, item, familyId) {
    if (kind === 'task') return { name: 'task-detail', params: { familyId, taskId: item.id } }
    if (kind === 'log') return { name: 'recipient-log', params: { recipientId: item.recipient?.id }, hash: `#log-${item.id}` }
    if (kind === 'person') {
        return item.kind === 'recipient'
            ? { name: 'recipient-overview', params: { recipientId: item.id } }
            : { name: 'public-profile', params: { userId: item.id } }
    }
    return { name: 'search', query: { q: item.name, type: 'tasks' } }
}

export const resultKey = (kind, item) => `${kind}-${item.id || item.name}`

// ---------- Highlighting ----------

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "Eye check-up", "eye" -> [{ text: 'Eye', match: true }, { text: ' check-up', match: false }]
// Rendered as text nodes and <mark>, never as HTML.
export function highlightParts(text, query) {
    const value = String(text ?? '')
    const word = String(query ?? '').trim()
    if (!value || word.length < 2) return value ? [{ text: value, match: false }] : []

    return value
        .split(new RegExp(`(${escapeRegExp(word)})`, 'gi'))
        .filter(Boolean)
        .map((part) => ({ text: part, match: part.toLowerCase() === word.toLowerCase() }))
}

// ---------- Results page ----------

const dateOf = (kind, item) => (kind === 'task' ? item.startAt : kind === 'log' ? item.createdAt : null)

// One flat list for the results page. shown: the group keys ticked under SHOW.
// Best match keeps the server's order inside each tier; newest/oldest put undated rows last.
export function flattenResults(results, shown, sort = 'best') {
    const rows = GROUPS.filter((group) => shown.includes(group.key)).flatMap((group) =>
        (results[group.key] || []).map((item, index) => ({ kind: group.kind, item, index, key: resultKey(group.kind, item) }))
    )

    if (sort === 'best') return rows.sort((a, b) => (a.item.matchTier ?? 2) - (b.item.matchTier ?? 2))

    const direction = sort === 'oldest' ? 1 : -1
    return rows.sort((a, b) => {
        const aDate = dateOf(a.kind, a.item)
        const bDate = dateOf(b.kind, b.item)
        if (!aDate || !bDate) return (aDate ? -1 : 0) + (bDate ? 1 : 0)
        return direction * (new Date(aDate) - new Date(bDate))
    })
}
