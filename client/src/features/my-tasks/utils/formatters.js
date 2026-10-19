// Owner: Chaithra (E)
// Shared helpers for My Tasks and Transit. The API sends UTC; we show Singapore time.
export const TIME_ZONE = 'Asia/Singapore'

// "10:00am"
export function formatTime(value) {
    return new Date(value)
        .toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE })
        .replace(/\s/g, '')
        .toLowerCase()
}

// "Fri 9 Oct"
export function formatDay(value) {
    return new Date(value).toLocaleDateString('en-SG', {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: TIME_ZONE
    })
}

// "2026-10-09" in Singapore time, for grouping by day
export function dayKey(value) {
    return new Date(value).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

export function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

// recipient is null for household tasks, and only an id until C's model populates it
export function recipientName(task) {
    const recipient = task?.recipient
    return recipient && typeof recipient === 'object' ? recipient.nickname || recipient.name : ''
}

// Same family always gets the same pill colour
const FAMILY_COLOURS = ['green', 'purple', 'blue', 'orange']
export function familyColour(familyId = '') {
    let sum = 0
    for (const char of String(familyId)) sum += char.charCodeAt(0)
    return FAMILY_COLOURS[sum % FAMILY_COLOURS.length]
}
