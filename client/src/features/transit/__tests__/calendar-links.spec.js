import { describe, it, expect } from 'vitest'
import { googleCalendarUrl, outlookCalendarUrl } from '../utils/calendarLinks.js'

const task = { title: 'Eye check & review', startAt: '2026-12-31T23:30:00+08:00',
  description: 'Bring card; call before arrival.', family: { name: 'Tan family' },
  location: { name: 'Clinic A & B', address: '1 Test Road', postal: '123456' } }

describe('Calendar links preserve the task’s time and text', () => {
  it('uses UTC and a one-hour default duration when there is no end time', () => {
    const url = new URL(googleCalendarUrl(task))
    expect(url.origin).toBe('https://calendar.google.com')
    expect(url.searchParams.get('dates')).toBe('20261231T153000Z/20261231T163000Z')
    expect(url.searchParams.get('text')).toBe(task.title)
    expect(url.searchParams.get('location')).toBe('Clinic A & B, 1 Test Road, S123456')
  })

  it('preserves an explicit end time across midnight and URL-encodes special text', () => {
    const url = new URL(outlookCalendarUrl({ ...task, endAt: '2027-01-01T01:15:00+08:00' }))
    expect(url.searchParams.get('startdt')).toBe('2026-12-31T15:30:00.000Z')
    expect(url.searchParams.get('enddt')).toBe('2026-12-31T17:15:00.000Z')
    expect(url.searchParams.get('subject')).toBe(task.title)
    expect(url.searchParams.get('body')).toContain(task.description)
  })
})
