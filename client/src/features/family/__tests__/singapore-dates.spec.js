import { describe, it, expect, vi } from 'vitest'
import { singaporeDay } from '../composables/useFamilyDashboard.js'
import { ageLabel, dateKey } from '../../recipients/recipientLabels.js'

describe('Singapore dates used by the family dashboard', () => {
  it.each([
    ['2026-10-20T15:59:59Z', '2026-10-20'],
    ['2026-10-20T16:00:00Z', '2026-10-21'],
    ['2026-12-31T16:00:00Z', '2027-01-01'],
  ])('groups %s under %s, regardless of the computer timezone', (input, day) => {
    expect(singaporeDay(input)).toBe(day)
    expect(dateKey(input)).toBe(day)
  })

  it('changes a baby’s age on the Singapore birthday boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T16:30:00Z'))
    expect(ageLabel('2026-09-20T16:00:00Z')).toBe('1 month')
    expect(ageLabel('2024-10-20T16:00:00Z')).toBe('2')
  })

  it('does not show an age for a missing or future birth date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T16:30:00Z'))
    expect(ageLabel(null)).toBe('')
    expect(ageLabel('2026-10-22T00:00:00Z')).toBe('')
  })
})
