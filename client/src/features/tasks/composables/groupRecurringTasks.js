import { isTaskOverdue } from './useTaskOverdue.js'

// Filter by status/date before grouping so a missed session cannot hide the
// next available session. Keep real occurrence IDs for claim/edit actions.
export function groupRecurringTasks(tasks, now = Date.now()) {
  const groups = new Map()
  const rows = []
  for (const task of [...tasks].sort((a, b) => new Date(a.startAt) - new Date(b.startAt))) {
    const series = task.recurringSeries?._id || task.recurringSeries
    if (!series || task.recurrenceDetached || task.status !== 'open' || isTaskOverdue(task, now)) {
      rows.push(task)
      continue
    }
    const key = String(series)
    const row = groups.get(key)
    if (row) row.upcomingSessionCount++
    else {
      const next = { ...task, upcomingSessionCount: 1 }
      groups.set(key, next)
      rows.push(next)
    }
  }
  return rows
}
