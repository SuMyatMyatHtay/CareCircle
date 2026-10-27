// Owner: Marcus (D)
// State, validation and submit for the New task form. NewTaskModal (md and up) and
// NewTaskView (phones) both use this, so the two layouts always behave the same.
//
//   const form = useTaskForm({ recipientId: 'abc' })   // or {} for "anyone"
//   const form = useTaskForm({ task })                 // edit: fields start from the task, submit saves it
//   form.title.value = 'Eye check-up'
//   const task = await form.submit(familyId)          // null if it failed
//
// Pass save to post somewhere other than the API (the /preview page's sample data):
//   useTaskForm({ save: async (payload) => task })
//
// Validation mirrors TaskModel.js so most problems are caught before posting.
import { ref, computed, watch } from 'vue'
import { createTask, updateTask, getTaskErrorMessage } from '../services/tasksApi.js'
import { useTaskCache } from '../../../composables/useFamilyTasks.js'

const TIME_ZONE = 'Asia/Singapore'
// Singapore has no daylight saving, so the offset is always +08:00
const SG_OFFSET = '+08:00'

export const TASK_CATEGORIES = [
    { value: 'appointment', label: 'Appointment', icon: 'bi-calendar-event' },
    { value: 'therapy', label: 'Therapy', icon: 'bi-activity' },
    { value: 'medication', label: 'Medication', icon: 'bi-capsule' },
    { value: 'companionship', label: 'Company', icon: 'bi-people' },
    { value: 'errand', label: 'Errand', icon: 'bi-bag' },
    { value: 'groceries', label: 'Groceries', icon: 'bi-cart' },
    { value: 'childcare', label: 'Childcare', icon: 'bi-emoji-smile' },
    { value: 'other', label: 'Other', icon: 'bi-three-dots' }
]

const TITLE_MAX = 120
const DESCRIPTION_MAX = 2000

// ---- Dates, always in Singapore time ----

// YYYY-MM-DD for today in Singapore
export function todayKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

export function addDays(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00${SG_OFFSET}`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

// "Wed 21 Oct"
export function dateLabel(dateKey) {
    return new Date(`${dateKey}T12:00:00${SG_OFFSET}`)
        .toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TIME_ZONE })
        .replace(',', '')
}

// "2:30pm"
export function timeLabel(date) {
    return date
        .toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE })
        .replace(' ', '')
}

// Date -> "HH:mm" in Singapore time, for <input type="time">
function timeInput(value) {
    if (!value) return ''
    return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE })
}

// Date + time typed in Singapore time -> Date (sent to the API as an ISO string)
function combine(dateKey, time) {
    if (!dateKey || !time) return null
    const date = new Date(`${dateKey}T${time}:00${SG_OFFSET}`)
    return Number.isNaN(date.getTime()) ? null : date
}

// Today, Tomorrow and the day after, then "Pick a date…"
export function quickDates() {
    const today = todayKey()
    return [
        { value: today, label: 'Today' },
        { value: addDays(today, 1), label: 'Tomorrow' },
        { value: addDays(today, 2), label: dateLabel(addDays(today, 2)) }
    ]
}

// Which input a server message belongs to, e.g. "Title is required" -> title
const SERVER_FIELDS = [
    [/^title/i, 'title'],
    [/start/i, 'startAt'],
    [/^end/i, 'endAt'],
    [/^description/i, 'description'],
    [/^category/i, 'category'],
    [/^recipient/i, 'recipient'],
    [/^location|postal/i, 'location'],
    [/needsTransit/i, 'needsTransit']
]

export function useTaskForm({ recipientId = null, save = null, task = null } = {}) {
    const { upsertTask } = useTaskCache()

    // ---- Fields ----
    const recipient = ref(recipientId)       // recipient id, or null for "Household"
    const title = ref('')
    const category = ref('other')
    const date = ref(todayKey())
    const startTime = ref('')                // "HH:mm" from <input type="time">
    const endTime = ref('')
    const location = ref(null)               // { name, address, postal, lat?, lng? }
    const needsTransit = ref(false)
    const description = ref('')

    // Editing: start from the task as it is now
    if (task) {
        const idOf = (value) => (value && typeof value === 'object' ? value._id : value)
        const place = task.location
        recipient.value = idOf(task.recipient) || null
        title.value = task.title || ''
        category.value = task.category || 'other'
        date.value = new Date(task.startAt).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
        startTime.value = timeInput(task.startAt)
        endTime.value = timeInput(task.endAt)
        location.value = place && (place.name || place.address || place.postal) ? { ...place } : null
        needsTransit.value = Boolean(location.value && task.needsTransit)
        description.value = task.description || ''
    }

    // Transit mode needs somewhere to go
    watch(location, (place) => {
        if (!place) needsTransit.value = false
    })

    const startAt = computed(() => combine(date.value, startTime.value))
    const endAt = computed(() => combine(date.value, endTime.value))

    // ---- Validation (same rules as TaskModel.js) ----
    const errors = computed(() => {
        const result = {}
        const trimmedTitle = title.value.trim()

        if (!trimmedTitle) result.title = 'Add what needs doing'
        else if (trimmedTitle.length > TITLE_MAX) result.title = `Keep it under ${TITLE_MAX} characters`

        if (description.value.length > DESCRIPTION_MAX) {
            result.description = `Notes must be at most ${DESCRIPTION_MAX} characters`
        }
        if (!TASK_CATEGORIES.some((c) => c.value === category.value)) result.category = 'Pick a category'

        if (!startAt.value) result.startAt = 'Add a start time'
        if (startAt.value && endAt.value && endAt.value < startAt.value) {
            result.endAt = 'End time must be after the start time'
        }

        if (location.value && !/^(\d{6})?$/.test(location.value.postal || '')) {
            result.location = 'Postal code must be 6 digits'
        }
        if (needsTransit.value && !location.value) result.needsTransit = 'Pick a place first'

        return result
    })

    const canSubmit = computed(() => Object.keys(errors.value).length === 0)

    // One line for the footer: what's still missing before you can post
    const verb = task ? 'save' : 'post'
    const missingMessage = computed(() => {
        const missingTitle = Boolean(errors.value.title) && !title.value.trim()
        const missingStart = Boolean(errors.value.startAt)
        if (missingTitle && missingStart) return `Add what needs doing and a start time to ${verb}`
        if (missingTitle) return `Add what needs doing to ${verb}`
        if (missingStart) return `Add a start time to ${verb}`
        return Object.values(errors.value)[0] || ''
    })

    function toPayload() {
        const place = location.value
        return {
            title: title.value.trim(),
            description: description.value.trim(),
            category: category.value,
            startAt: startAt.value?.toISOString(),
            endAt: endAt.value ? endAt.value.toISOString() : null,
            recipient: recipient.value || null,
            location: place
                ? {
                    name: place.name || '',
                    address: place.address || '',
                    postal: place.postal || '',
                    ...(Number.isFinite(place.lat) ? { lat: place.lat } : {}),
                    ...(Number.isFinite(place.lng) ? { lng: place.lng } : {})
                }
                : null,
            needsTransit: place ? needsTransit.value : false
        }
    }

    // ---- Submit ----
    const isSubmitting = ref(false)
    const serverErrors = ref({})   // field -> message, shown under the matching input
    const submitError = ref('')    // anything that doesn't belong to one input

    // Errors to show under an input: the server's first, then our own
    function fieldError(field) {
        return serverErrors.value[field] || ''
    }

    function applyServerErrors(error) {
        const messages = error.response?.data?.errors || []
        const byField = {}
        const other = []

        for (const message of messages) {
            const match = SERVER_FIELDS.find(([pattern]) => pattern.test(message))
            if (match && !byField[match[1]]) byField[match[1]] = message
            else other.push(message)
        }

        serverErrors.value = byField
        submitError.value = other.length
            ? other.join(' ')
            : messages.length ? '' : getTaskErrorMessage(error)
    }

    // Posts the task and puts it in the shared task cache. Returns the task, or null.
    async function submit(familyId) {
        if (!canSubmit.value || isSubmitting.value) return null

        isSubmitting.value = true
        serverErrors.value = {}
        submitError.value = ''
        try {
            if (save) return await save(toPayload())
            const saved = task
                ? await updateTask(familyId, task._id, toPayload())
                : await createTask(familyId, toPayload())
            upsertTask(familyId, saved)
            return saved
        } catch (error) {
            applyServerErrors(error)
            return null
        } finally {
            isSubmitting.value = false
        }
    }

    // A field the server complained about is cleared as soon as it is edited
    watch([title, category, startTime, endTime, date, location, recipient, description], () => {
        if (Object.keys(serverErrors.value).length) serverErrors.value = {}
    })

    return {
        recipient,
        title,
        category,
        date,
        startTime,
        endTime,
        location,
        needsTransit,
        description,
        startAt,
        endAt,
        errors,
        canSubmit,
        missingMessage,
        toPayload,
        isSubmitting,
        serverErrors,
        submitError,
        fieldError,
        submit
    }
}
