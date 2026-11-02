// Stable future dates, independent of the host timezone or time of day.
export function recurringTaskPayload({ count = 8, never = false, now = new Date() } = {}) {
  const day = new Date(+now + 8 * 3600000 + 2 * 86400000).toISOString().slice(0, 10)
  return { title: 'Test recurring therapy', category: 'therapy',
    startAt: `${day}T06:30:00.000Z`, endAt: `${day}T07:30:00.000Z`,
    recurrence: { frequency: 'daily', interval: 1, end: never ? { mode: 'never' } : { mode: 'after', count } } }
}
