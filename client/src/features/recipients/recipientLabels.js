// Owner: Jhen (C)
// Labels and small formatters shared by the recipient pages, the sidebar and Family home.
// Values match CARE_TYPES / MOBILITY_LEVELS / ALLERGY_SEVERITIES in server/src/constants.js.

const TIME_ZONE = 'Asia/Singapore'

export const CARE_TYPES = [
    { value: 'elderly', label: 'Elderly', chip: 'Elderly care' },
    { value: 'pregnancy', label: 'Pregnancy', chip: 'Pregnancy care' },
    { value: 'postpartum', label: 'Postpartum', chip: 'Postpartum care' },
    { value: 'infant', label: 'Infant', chip: 'Infant care' },
    { value: 'injury', label: 'Injury recovery', chip: 'Injury recovery' },
    { value: 'other', label: 'Other', chip: 'Other care' }
]

export const MOBILITY_LEVELS = [
    { value: 'independent', label: 'Independent', chip: 'Independent' },
    { value: 'assisted', label: 'Assisted', chip: 'Assisted mobility' },
    { value: 'wheelchair', label: 'Wheelchair', chip: 'Wheelchair user' },
    { value: 'bedbound', label: 'Bed-bound', chip: 'Bed-bound' }
]

export const ALLERGY_SEVERITIES = ['mild', 'severe']

export function careTypeLabel(value) {
    return CARE_TYPES.find((t) => t.value === value)?.label || 'Other'
}

export function careTypeChip(value) {
    return CARE_TYPES.find((t) => t.value === value)?.chip || 'Other care'
}

export function mobilityLabel(value) {
    return MOBILITY_LEVELS.find((m) => m.value === value)?.label || ''
}

export function mobilityChip(value) {
    return MOBILITY_LEVELS.find((m) => m.value === value)?.chip || ''
}

// What the family calls them, falling back to the full name
export function displayName(recipient) {
    return recipient?.nickname || recipient?.name || ''
}

export function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

// Calendar parts of a date in Singapore time, so ages don't shift near midnight UTC
function sgParts(date) {
    const [year, month, day] = date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }).split('-').map(Number)
    return { year, month, day }
}

// "82", or "4 months" for babies under 2
export function ageLabel(dateOfBirth) {
    if (!dateOfBirth) return ''
    const born = sgParts(new Date(dateOfBirth))
    const today = sgParts(new Date())

    let months = (today.year - born.year) * 12 + (today.month - born.month)
    if (today.day < born.day) months -= 1
    if (months < 0) return ''
    if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'}`
    return String(Math.floor(months / 12))
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!value) return ''
    return new Date(value).toLocaleDateString('en-SG', { ...options, timeZone: TIME_ZONE })
}

// YYYY-MM-DD in Singapore time, for grouping and for <input type="date">
export function dateKey(value) {
    return new Date(value).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}
