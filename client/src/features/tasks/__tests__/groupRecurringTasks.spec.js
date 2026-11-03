import { describe, it, expect } from 'vitest'
import { groupRecurringTasks } from '../composables/groupRecurringTasks.js'

const now = Date.parse('2026-11-03T12:00:00+08:00')
const session = (id, date, extra = {}) => ({ _id: id, recurringSeries: 'weekly', title: 'Tuesday care', status: 'open', startAt: `${date}T10:00:00+08:00`, ...extra })

describe('recurring task board rows', () => {
  it('keeps a one-session claim separate and groups the remaining dates from next week', () => {
    const tasks = [session('this-week', '2026-11-03', { status: 'claimed', claimedBy: 'helper', recurrenceDetached: true }), session('next-week', '2026-11-10'), session('later', '2026-11-17')]
    const rows = groupRecurringTasks(tasks, Date.parse('2026-11-03T09:00:00+08:00'))
    expect(rows.map(task => task._id)).toEqual(['this-week', 'next-week'])
    expect(rows[0].claimedBy).toBe('helper')
    expect(rows[1].status).toBe('open')
    expect(rows[1].upcomingSessionCount).toBe(2)
    expect(rows[1].startAt).toBe('2026-11-10T10:00:00+08:00')
  })

  it('keeps the missed Tuesday separate and combines future Tuesdays under the next date', () => {
    const tasks = [session('fourth', '2026-11-24'), session('missed', '2026-11-03'), session('next', '2026-11-10'), session('third', '2026-11-17')]
    const rows = groupRecurringTasks(tasks, now)
    expect(rows.map(task => task._id)).toEqual(['missed', 'next'])
    expect(rows[0].upcomingSessionCount).toBeUndefined()
    expect(rows[1].upcomingSessionCount).toBe(3)
    expect(rows[1].startAt).toBe('2026-11-10T10:00:00+08:00')
    expect(tasks[2].upcomingSessionCount).toBeUndefined()
  })

  it('moves only the next missed session to overdue as the week advances', () => {
    const tasks = [session('first', '2026-11-03'), session('second', '2026-11-10'), session('third', '2026-11-17'), session('fourth', '2026-11-24')]
    const rows = groupRecurringTasks(tasks, Date.parse('2026-11-10T12:00:00+08:00'))
    expect(rows.map(task => task._id)).toEqual(['first', 'second', 'third'])
    expect(rows[2].upcomingSessionCount).toBe(2)
  })

  it('preserves separate series, ordinary tasks, claimed sessions and one-date exceptions', () => {
    const tasks = [session('next', '2026-11-10'), session('exception', '2026-11-11', { recurrenceDetached: true }), session('other', '2026-11-12', { recurringSeries: { _id: 'other' } }), session('claimed', '2026-11-13', { status: 'claimed' }), session('ordinary', '2026-11-14', { recurringSeries: null })]
    expect(groupRecurringTasks(tasks, now)).toHaveLength(5)
  })
})
