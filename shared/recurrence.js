// Shared browser/server calendar arithmetic: Singapore UTC+08, no daylight saving.
const DAY = 86400000, OFFSET = 8 * 3600000
export const MAX_SESSIONS = 500
const fail = message => { throw Object.assign(new Error(message), { status: 400 }) }
export const sgDay = value => new Date(+new Date(value) + OFFSET).toISOString().slice(0, 10)
export function parseRecurrence(input, startAt) {
  if (input == null || input.frequency === 'none') return null
  if (typeof input !== 'object' || Array.isArray(input)) fail('Repeat settings must be an object')
  const { frequency, interval = 1, weekdays, end = { mode: 'never' } } = input
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) fail('Choose a valid repeat frequency')
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) fail('Repeat interval must be between 1 and 365')
  const weekday = (new Date(+new Date(startAt) + OFFSET).getUTCDay() + 6) % 7
  const days = frequency === 'weekly' ? (weekdays ?? [weekday]) : []
  if (!Array.isArray(days) || (frequency === 'weekly' && !days.length) || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) fail('Choose at least one valid repeat weekday')
  if (!end || !['never', 'on', 'after'].includes(end.mode)) fail('Choose how the repeating task ends')
  const ending = { mode: end.mode }
  if (end.mode === 'after') {
    if (!Number.isInteger(end.count) || end.count < 1 || end.count > MAX_SESSIONS) fail(`Repeat count must be between 1 and ${MAX_SESSIONS}`)
    ending.count = end.count
  }
  if (end.mode === 'on') {
    if (typeof end.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(end.until)) fail('Choose a valid repeat end date')
    const until = new Date(`${end.until}T00:00:00Z`)
    if (!Number.isFinite(+until) || until.toISOString().slice(0, 10) !== end.until || end.until < sgDay(startAt)) fail('Repeat end date must be on or after the first session')
    if (+until - Date.parse(sgDay(startAt)) > 366 * 5 * DAY) fail('Repeat end date must be within five years')
    ending.until = end.until
  }
  return { frequency, interval, weekdays: [...new Set(days)].sort((a, b) => a - b), end: ending }
}

export function recurrenceDates(rule, startAt, endAt, through) {
  const first = new Date(startAt), local = new Date(+first + OFFSET)
  const firstDay = Date.parse(sgDay(first)), time = (+local % DAY + DAY) % DAY
  const firstWeekday = (local.getUTCDay() + 6) % 7
  const duration = endAt ? +new Date(endAt) - +first : null
  const result = [], count = rule.end.mode === 'after' ? rule.end.count : Infinity
  const last = rule.end.mode === 'on' ? Date.parse(rule.end.until) + DAY - 1 - OFFSET : +new Date(through)
  if (!Number.isFinite(last) && rule.end.mode !== 'after') fail('A generation horizon is required')
  // Bounded even for sparse monthly/custom schedules; no unbounded request loops.
  for (let day = 0; day <= 366 * 500 && result.length < count; day++) {
    const candidateDay = firstDay + day * DAY
    const at = candidateDay + time - OFFSET
    if (at > last && rule.end.mode !== 'after') break
    let matches = false
    if (rule.frequency === 'daily') matches = day % rule.interval === 0
    if (rule.frequency === 'weekly') matches = Math.floor((day + firstWeekday) / 7) % rule.interval === 0 && rule.weekdays.includes((firstWeekday + day) % 7)
    if (rule.frequency === 'monthly') {
      const date = new Date(candidateDay)
      const months = (date.getUTCFullYear() - local.getUTCFullYear()) * 12 + date.getUTCMonth() - local.getUTCMonth()
      matches = months % rule.interval === 0 && date.getUTCDate() === local.getUTCDate()
    }
    if (!matches) continue
    if (result.length >= MAX_SESSIONS && rule.end.mode !== 'never') fail(`A recurring task can contain at most ${MAX_SESSIONS} sessions`)
    // Long-running "Never" series are paged by time, rather than total history.
    result.push({ index: result.length, startAt: new Date(at), endAt: duration == null ? null : new Date(at + duration) })
  }
  if (!result.length) fail('The repeat settings do not include any sessions')
  if (rule.end.mode === 'after' && result.length < count) fail('This repeat interval and count extend too far into the future')
  return result
}

export function recurrenceLabel(rule) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[rule.frequency]
  return `Every ${rule.interval === 1 ? '' : `${rule.interval} `}${unit}${rule.interval > 1 ? 's' : ''}${rule.frequency === 'weekly' ? ` on ${rule.weekdays.map(day => names[day]).join(', ')}` : ''}`
}

export function generationHorizon(startAt, now = new Date()) {
  return new Date(Math.max(Date.parse(sgDay(now)), Date.parse(sgDay(startAt))) + 29 * DAY - 1 - OFFSET)
}
