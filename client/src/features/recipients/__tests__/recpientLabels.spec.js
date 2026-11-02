import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    careTypeLabel, careTypeChip, mobilityLabel, mobilityChip,
    displayName, initials, ageLabel, formatDate, dateKey
} from '../recipientLabels.js'

describe('TestSuite: names and labels', () => {
    it('Test1: displayName prefers the nickname, then the full name, and copes with nothing', () => {
        expect(displayName({ name: 'Tan Ah Kow', nickname: 'Grandpa' })).toBe('Grandpa')
        expect(displayName({ name: 'Tan Ah Kow', nickname: '' })).toBe('Tan Ah Kow')
        expect(displayName(null)).toBe('')
    })

    it('Test2: care type and mobility map to labels, with safe fallbacks for unknown values', () => {
        expect(careTypeLabel('injury')).toBe('Injury recovery')
        expect(careTypeChip('elderly')).toBe('Elderly care')
        expect(careTypeLabel('alien')).toBe('Other')
        expect(mobilityLabel('bedbound')).toBe('Bed-bound')
        expect(mobilityChip('wheelchair')).toBe('Wheelchair user')
        // unknown mobility is empty so the card can hide it
        expect(mobilityChip(undefined)).toBeFalsy()
    })

    it('Test3: initials come from the first two words, upper-cased', () => {
        expect(initials('tan ah kow')).toBe('TA')
        expect(initials('  Alice ')).toBe('A')
        expect(initials()).toBe('')
    })
})

describe('TestSuite: ageLabel', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-31T04:00:00Z')) // noon, 31 Oct 2026, Singapore
    })
    afterEach(() => vi.useRealTimers())

    it('Test1: babies are shown in months (singular for 1) and from 24 months in years', () => {
        expect(ageLabel('2026-09-30')).toBe('1 month')
        expect(ageLabel('2026-05-31')).toBe('5 months')
        expect(ageLabel('2024-11-30')).toBe('23 months')
        expect(ageLabel('2024-10-31')).toBe('2')
        expect(ageLabel('1944-03-02')).toBe('82')
    })

    it('Test2: a birthday or day-of-month that has not happened yet does not count', () => {
        expect(ageLabel('1944-12-25')).toBe('81')
        vi.setSystemTime(new Date('2026-10-10T04:00:00Z'))
        expect(ageLabel('2026-08-15')).toBe('1 month')
    })

    it('Test3: no date of birth, or one in the future, gives an empty string', () => {
        expect(ageLabel('')).toBe('')
        expect(ageLabel(undefined)).toBe('')
        expect(ageLabel('2027-01-01')).toBe('')
    })

    it('Test4: uses Singapore time, not UTC, near midnight', () => {
        vi.setSystemTime(new Date('2026-10-30T17:00:00Z')) // already 31 Oct in Singapore
        expect(ageLabel('2025-10-31T00:00:00Z')).toBe('12 months')
    })
})

describe('TestSuite: dates', () => {
    it('Test1: dateKey and formatDate use Singapore time and cope with no value', () => {
        expect(dateKey('2026-01-01T15:00:00Z')).toBe('2026-01-01')
        expect(dateKey('2026-01-01T17:00:00Z')).toBe('2026-01-02')
        expect(formatDate('2026-01-01T17:00:00Z', { day: 'numeric' })).toBe('2')
        expect(formatDate('')).toBe('')
    })
})