// Owner: SeungHak (F)
import { describe, it, expect } from 'vitest'
import {
    dayKey, shiftMonth, monthGrid, gridRange, monthLabel, dayLabel, timeLabel, shortTime,
    taskState, buildEvents, filterEvents, groupByDay
} from '../calendarDays.js'

describe('calendar dates (Singapore time, weeks start Monday)', () => {
    it('puts a late-night UTC time on the next Singapore day', () => {
        expect(dayKey('2026-10-27T17:30:00Z')).toBe('2026-10-28')
        expect(timeLabel('2026-10-27T06:00:00Z')).toBe('2:00pm')
        expect(shortTime('2:00pm')).toBe('2pm')
        expect(shortTime('2:30pm')).toBe('2:30pm')
    })

    it('moves between months across a year', () => {
        expect(shiftMonth('2026-12', 1)).toBe('2027-01')
        expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    })

    it('builds whole Monday-to-Sunday weeks around the month', () => {
        const days = monthGrid('2026-10') // 1 Oct 2026 is a Thursday, 31 Oct a Saturday
        expect(days[0]).toEqual({ key: '2026-09-28', day: 28, inMonth: false })
        expect(days.at(-1)).toEqual({ key: '2026-11-01', day: 1, inMonth: false })
        expect(days).toHaveLength(35)
        expect(days.filter((d) => d.inMonth)).toHaveLength(31)
        expect(monthGrid('2026-03')).toHaveLength(42) // starts on a Sunday
    })

    it('gives the API the first and last moment on the grid', () => {
        const { from, to } = gridRange('2026-10')
        expect(from.toISOString()).toBe('2026-09-27T16:00:00.000Z')
        expect(to.toISOString()).toBe('2026-11-01T15:59:59.999Z')
    })

    it('labels months and days', () => {
        expect(monthLabel('2026-10')).toBe('October 2026')
        expect(dayLabel('2026-10-27')).toBe('Tuesday 27 October')
    })
})

describe('calendar events', () => {
    const now = new Date('2026-10-27T04:00:00Z').getTime() // noon in Singapore
    const task = (extra) => ({
        _id: 't1', title: 'Eye check', status: 'open', startAt: '2026-10-28T02:00:00Z',
        recipient: { _id: 'r1', name: 'Tan Ah Kow', nickname: 'Grandpa' }, ...extra
    })

    it('marks an open task that already started as missed', () => {
        expect(taskState(task({ startAt: '2026-10-27T01:00:00Z' }), now)).toBe('missed')
        expect(taskState(task(), now)).toBe('open')
        expect(taskState(task({ status: 'claimed', startAt: '2026-10-27T01:00:00Z' }), now)).toBe('claimed')
    })

    it('turns tasks and follow-up appointments into one sorted list', () => {
        const events = buildEvents({
            familyId: 'f1',
            now,
            tasks: [
                task({ _id: 'late', title: 'Physio', startAt: '2026-10-28T08:00:00Z', status: 'claimed', claimedBy: { name: 'Mia Tan' } }),
                task(),
                task({ _id: 'gone', status: 'cancelled' })
            ],
            appointmentNotes: [{
                _id: 'n1',
                recipient: { _id: 'r1', name: 'Tan Ah Kow', nickname: 'Grandpa' },
                consultation: { doctorName: 'Dr Lim', clinic: 'AMK Polyclinic', nextAppointment: '2026-10-28T05:00:00Z' }
            }]
        })

        expect(events.map((e) => e.id)).toEqual(['task-t1', 'appointment-n1', 'task-late'])
        expect(events[0]).toMatchObject({ day: '2026-10-28', time: '10:00am', recipientName: 'Grandpa', state: 'open' })
        expect(events[0].to).toEqual({ name: 'task-detail', params: { familyId: 'f1', taskId: 't1' } })
        expect(events[1]).toMatchObject({ kind: 'appointment', title: 'Follow-up with Dr Lim, AMK Polyclinic', state: 'appointment' })
        expect(events[1].to).toEqual({ name: 'recipient-log', params: { recipientId: 'r1' } })
        expect(events[2]).toMatchObject({ state: 'claimed', who: 'Mia' })
    })

    it('filters by person or household, and groups by day', () => {
        const events = buildEvents({
            familyId: 'f1',
            now,
            tasks: [task(), task({ _id: 'home', recipient: null, startAt: '2026-10-29T02:00:00Z' })]
        })
        expect(filterEvents(events, 'r1').map((e) => e.id)).toEqual(['task-t1'])
        expect(filterEvents(events, 'household').map((e) => e.id)).toEqual(['task-home'])
        expect(filterEvents(events, 'all')).toHaveLength(2)
        expect(Object.keys(groupByDay(events))).toEqual(['2026-10-28', '2026-10-29'])
        expect(events[1].recipientName).toBe('Household')
    })
})
