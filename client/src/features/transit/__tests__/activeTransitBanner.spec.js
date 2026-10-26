// Owner: Chaithra (E) · Week 10a: unit tests for plain functions
// toBanner() turns a live trip from the API into the Family Home banner text.
import { describe, it, expect } from 'vitest'
import { toBanner } from '../utils/useActiveTransit.js'
import { TRIP_STEPS, WORDS, extraUpdates } from '../utils/wording.js'

const session = (milestones = [], extra = {}) => ({
    task: {
        _id: 'task1',
        title: 'Physio',
        location: { name: 'Tan Tock Seng Hospital' },
        recipient: { _id: 'r1', name: 'Grandpa', careType: 'elderly' }
    },
    companion: { _id: 'u1', name: 'Jasmine Tan' },
    startedAt: '2026-10-29T02:00:00.000Z',
    milestones,
    ...extra
})
const step = (type, label = type, at = '2026-10-29T02:30:00.000Z') => ({ type, label, at })

describe('TestSuite: toBanner (Family Home live trip banner)', () => {
    it('Test1: says the trip has started when there are no updates yet', () => {
        const banner = toBanner(session(), 'fam1')
        expect(banner.mobileHeadline).toBe("Grandpa's trip has started")
        expect(banner.headline).toBe("Grandpa's trip has started with Jasmine")
        expect(banner.detail).toContain('0 of 5 milestones · next: arrived at clinic')
    })

    it('Test2: shows where they are going after "Departed home"', () => {
        const banner = toBanner(session([step('departed', 'Departed home')]), 'fam1')
        expect(banner.mobileHeadline).toBe('Grandpa is on the way to Tan Tock Seng Hospital')
        expect(banner.detail).toContain('1 of 5 milestones · next: arrived at clinic')
    })

    it('Test3: shows a custom update word for word', () => {
        const banner = toBanner(session([step('departed'), step('custom', 'Collecting medicine')]), 'fam1')
        expect(banner.mobileHeadline).toBe('Grandpa: Collecting medicine')
        // A custom update doesn't count as one of the 5 fixed steps
        expect(banner.detail).toContain('1 of 5 milestones')
    })

    it('Test4: counts fixed steps and names the next one', () => {
        const banner = toBanner(session([step('departed'), step('arrived'), step('consultation_done')]), 'fam1')
        expect(banner.mobileHeadline).toBe("Grandpa's consultation is done")
        expect(banner.detail).toContain('3 of 5 milestones · next: heading home')
    })

    it('Test5: keeps the ids needed to open the trip', () => {
        const banner = toBanner(session(), 'fam1')
        expect(banner).toMatchObject({ familyId: 'fam1', taskId: 'task1' })
    })

    it('Test6: picks the right sample photo by name (not the default face)', () => {
        const banner = toBanner(session(), 'fam1')
        expect(banner.recipient.profilePicture).toBe('/avatars/people/grandpa.png')
        expect(banner.companion.profilePicture).toBe('/avatars/people/jasmine.png')
    })

    it('Test7: keeps a photo the person chose themselves', () => {
        const banner = toBanner(session([], { companion: { name: 'Jasmine', profilePicture: '/me.png' } }), 'fam1')
        expect(banner.companion.profilePicture).toBe('/me.png')
    })

    it('Test8: returns null when there is no trip', () => {
        expect(toBanner(null, 'fam1')).toBeNull()
    })
})

describe('TestSuite: wording shared by the laptop and phone layouts', () => {
    it('Test1: has the 5 fixed trip steps in order, ending with "Safely back home"', () => {
        expect(TRIP_STEPS.map((s) => s.type)).toEqual(['departed', 'arrived', 'consultation_done', 'heading_home', 'home'])
        expect(TRIP_STEPS[4].label).toBe(WORDS.safelyHome)
    })

    it('Test2: names the person in the "Picked up" quick update', () => {
        expect(extraUpdates('Grandpa')).toContain('Picked up Grandpa')
        expect(extraUpdates('')).toContain('Picked up')
        expect(extraUpdates('Grandpa')).toHaveLength(4)
    })
})
