// Owner: Chaithra (E) · Week 10a: unit tests for plain functions
// "Add to calendar" links: the task's title, time and place must reach the calendar app.
import { describe, it, expect, vi } from 'vitest'
import { googleCalendarUrl, outlookCalendarUrl, openInAppleCalendar } from '../utils/calendarLinks.js'

// 10:00am Singapore time = 02:00 UTC
const task = {
    _id: 'task1',
    title: 'Physio for Grandpa',
    startAt: '2026-10-29T02:00:00.000Z',
    endAt: '2026-10-29T03:30:00.000Z',
    location: { name: 'Tan Tock Seng Hospital', address: '11 Jalan Tan Tock Seng', postal: '308433' },
    family: { name: 'Tan family' },
    description: 'Bring the pink folder'
}
const params = (url) => new URL(url).searchParams

describe('TestSuite: googleCalendarUrl', () => {
    it('Test1: fills in the title, the place and the family', () => {
        const query = params(googleCalendarUrl(task))
        expect(query.get('action')).toBe('TEMPLATE')
        expect(query.get('text')).toBe('Physio for Grandpa')
        expect(query.get('location')).toBe('Tan Tock Seng Hospital, 11 Jalan Tan Tock Seng, S308433')
        expect(query.get('details')).toContain('Tan family')
        expect(query.get('details')).toContain('Bring the pink folder')
    })

    it('Test2: sends the start and end time in UTC', () => {
        expect(params(googleCalendarUrl(task)).get('dates')).toBe('20261029T020000Z/20261029T033000Z')
    })

    it('Test3: makes the event 1 hour long when the task has no end time', () => {
        const query = params(googleCalendarUrl({ ...task, endAt: null }))
        expect(query.get('dates')).toBe('20261029T020000Z/20261029T030000Z')
    })

    it('Test4: leaves the place empty for a task with no location', () => {
        expect(params(googleCalendarUrl({ ...task, location: null })).get('location')).toBe('')
    })
})

describe('TestSuite: outlookCalendarUrl', () => {
    it('Test1: opens Outlook compose with the same title and times', () => {
        const url = outlookCalendarUrl(task)
        expect(url).toContain('https://outlook.live.com/calendar/0/deeplink/compose')
        const query = params(url)
        expect(query.get('subject')).toBe('Physio for Grandpa')
        expect(query.get('startdt')).toBe('2026-10-29T02:00:00.000Z')
        expect(query.get('enddt')).toBe('2026-10-29T03:30:00.000Z')
    })
})

describe('TestSuite: openInAppleCalendar', () => {
    it('Test1: downloads a .ics event with the task details', async () => {
        let saved = null
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { saved = blob; return 'blob:test' })
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
        const clicks = []
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicks.push(this.download) })

        openInAppleCalendar(task)

        expect(clicks).toEqual(['Physio for Grandpa.ics'])
        // jsdom's Blob has no .text(), so read it the older way
        const text = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.readAsText(saved)
        })
        expect(text).toContain('BEGIN:VEVENT')
        expect(text).toContain('SUMMARY:Physio for Grandpa')
        expect(text).toContain('DTSTART:20261029T020000Z')
        // Commas in the place are escaped so calendar apps read it as one value
        expect(text).toContain('LOCATION:Tan Tock Seng Hospital\\, 11 Jalan Tan Tock Seng\\, S308433')
    })
})
