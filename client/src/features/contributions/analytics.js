const DAY = 86400000
const idOf = person => String(person?._id || person?.id || person || '')
// Singapore calendar days keep periods and streaks consistent across devices.
export const dayKey = date => new Date(new Date(date).getTime() + 8 * 3600000).toISOString().slice(0, 10)
const dayNumber = date => Date.parse(dayKey(date)) / DAY

export function contributionPoints(task) {
  const delay = new Date(task.claimedAt) - new Date(task.createdAt)
  return 1 + Number(task.category === 'appointment' && task.needsTransit === true)
    + Number(Boolean(task.claimedAt && task.createdAt) && delay >= 0 && delay <= 3600000)
}

export function analyzeContributions(tasks, members, familyId, period = 'month', now = new Date()) {
  const today = dayNumber(now)
  const start = period === 'week' ? today - ((new Date(today * DAY).getUTCDay() + 6) % 7)
    : period === 'month' ? Date.parse(`${dayKey(now).slice(0, 7)}-01`) / DAY : -Infinity
  const completed = tasks.filter(task => idOf(task.family) === String(familyId)
    && task.status === 'completed' && task.completedAt && task.claimedBy
    && Number.isFinite(new Date(task.completedAt).getTime()) && new Date(task.completedAt) <= now)
  const recent = completed.filter(task => dayNumber(task.completedAt) >= start)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
  const people = new Map(members.filter(m => m.user).map(m => {
    const id = idOf(m.user)
    return [id, { id, person: m.user, count: 0, points: 0, appointments: 0, quick: 0, evenings: 0, streak: 0 }]
  }))
  for (const task of recent) {
    const id = idOf(task.claimedBy)
    if (!people.has(id)) people.set(id, { id, person: typeof task.claimedBy === 'object' ? task.claimedBy : { name: 'Former member' }, count: 0, points: 0, appointments: 0, quick: 0, evenings: 0, streak: 0 })
    const row = people.get(id)
    row.count++
    row.points += contributionPoints(task)
    row.appointments += Number(task.category === 'appointment')
    const delay = new Date(task.claimedAt) - new Date(task.createdAt)
    row.quick += Number(Boolean(task.claimedAt && task.createdAt) && delay >= 0 && delay <= 3600000)
    row.evenings += Number(new Date(new Date(task.completedAt).getTime() + 8 * 3600000).getUTCHours() >= 18)
  }
  for (const row of people.values()) {
    const days = new Set(completed.filter(t => idOf(t.claimedBy) === row.id).map(t => dayNumber(t.completedAt)))
    let cursor = days.has(today) ? today : today - 1
    while (days.has(cursor)) { row.streak++; cursor-- }
    row.share = recent.length ? Math.round(row.count / recent.length * 100) : 0
    row.badges = [row.appointments >= 3 && 'Appointment hero', row.quick >= 3 && 'Quick to help', row.evenings >= 5 && 'Night owl'].filter(Boolean)
  }
  const rows = [...people.values()].sort((a, b) => b.points - a.points || b.count - a.count || (a.person.name || '').localeCompare(b.person.name || '') || a.id.localeCompare(b.id))
  rows.forEach((row, i) => { row.rank = row.count > 0 ? i + 1 : null })
  return { rows, recent, total: recent.length, points: rows.reduce((sum, row) => sum + row.points, 0), helpers: rows.filter(row => row.count > 0).length }
}
