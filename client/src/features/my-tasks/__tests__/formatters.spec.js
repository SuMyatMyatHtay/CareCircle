// Owner: Chaithra (E) · Week 10a: unit tests for plain functions
// The API sends UTC times; My Tasks and Transit must always show Singapore time.
import { describe, it, expect } from 'vitest'
import { formatTime, formatDay, dayKey, initials, recipientName, familyColour } from '../utils/formatters.js'

describe('TestSuite: formatTime', () => {
    it('Test1: shows UTC 02:00 as 10:00am Singapore time', () => {
        expect(formatTime('2026-10-29T02:00:00.000Z')).toBe('10:00am')
    })

    it('Test2: shows an afternoon time with pm', () => {
        expect(formatTime('2026-10-29T06:30:00.000Z')).toBe('2:30pm')
    })
})

describe('TestSuite: formatDay and dayKey', () => {
    it('Test1: shows the short day name, date and month', () => {
        expect(formatDay('2026-10-29T02:00:00.000Z')).toContain('29 Oct')
        expect(formatDay('2026-10-29T02:00:00.000Z')).toContain('Thu')
    })

    it('Test2: puts 16:30 UTC on the next Singapore day (00:30am)', () => {
        // Grouping by day must follow Singapore midnight, not UTC midnight
        expect(dayKey('2026-10-28T16:30:00.000Z')).toBe('2026-10-29')
        expect(dayKey('2026-10-28T15:30:00.000Z')).toBe('2026-10-28')
    })
})

describe('TestSuite: initials', () => {
    it('Test1: takes the first letter of the first two names', () => {
        expect(initials('Jasmine Tan')).toBe('JT')
        expect(initials('aunt may lim')).toBe('AM')
    })

    it('Test2: returns an empty string for no name', () => {
        expect(initials('')).toBe('')
        expect(initials()).toBe('')
    })
})

describe('TestSuite: recipientName', () => {
    it('Test1: prefers the nickname, then the name', () => {
        expect(recipientName({ recipient: { name: 'Tan Ah Kow', nickname: 'Grandpa' } })).toBe('Grandpa')
        expect(recipientName({ recipient: { name: 'Baby Emma' } })).toBe('Baby Emma')
    })

    it('Test2: is empty for a household task or an unpopulated id', () => {
        expect(recipientName({ recipient: null })).toBe('')
        expect(recipientName({ recipient: '6ac8...' })).toBe('')
        expect(recipientName(null)).toBe('')
    })
})

describe('TestSuite: familyColour', () => {
    it('Test1: always gives the same family the same colour', () => {
        const colour = familyColour('6ac889894757422a93937345')
        expect(familyColour('6ac889894757422a93937345')).toBe(colour)
        expect(['green', 'purple', 'blue', 'orange']).toContain(colour)
    })
})
