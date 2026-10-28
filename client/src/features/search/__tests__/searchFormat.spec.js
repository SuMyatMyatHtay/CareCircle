import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HighlightText from '../components/HighlightText.vue'
import { highlightParts, dayLabel, describeResult, resultLink, flattenResults } from '../searchFormat.js'

// 10:00 on Thu 29 Oct 2026, Singapore time
const now = new Date('2026-10-29T10:00:00+08:00')

describe('search formatting', () => {
    it('splits every match without treating the word as a pattern', () => {
        expect(highlightParts('Eye check-up for the eye', 'eye')).toEqual([
            { text: 'Eye', match: true },
            { text: ' check-up for the ', match: false },
            { text: 'eye', match: true }
        ])
        expect(highlightParts('Costs $5 (cash)', '(cash)')).toEqual([
            { text: 'Costs $5 ', match: false },
            { text: '(cash)', match: true }
        ])
        expect(highlightParts('anything', '.*')).toEqual([{ text: 'anything', match: false }])
    })

    it('renders highlights as text, never as HTML', () => {
        const wrapper = mount(HighlightText, { props: { text: '<img src=x onerror=alert(1)> eye drops', query: 'eye' } })
        expect(wrapper.find('img').exists()).toBe(false)
        expect(wrapper.find('mark').text()).toBe('eye')
        expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    })

    it('labels task days like the Figma lead tile', () => {
        expect(dayLabel('2026-10-29T15:00:00+08:00', now)).toBe('TODAY')
        expect(dayLabel('2026-10-31T09:00:00+08:00', now)).toBe('SAT')
        expect(dayLabel('2026-10-14T09:00:00+08:00', now)).toBe('14 OCT')
    })

    it('describes care log rows by type', () => {
        const base = { id: 'l1', createdAt: '2026-10-14T03:00:00Z', recipient: { id: 'r1', name: 'Grandpa' }, author: { id: 'u1', name: 'Jasmine' }, snippet: 'continue the eye drops' }
        expect(describeResult('log', { ...base, type: 'consultation', doctorName: 'Dr Lim' }).title).toBe('Consultation · Dr Lim')
        expect(describeResult('log', { ...base, type: 'consultation' }).lead.text).toBe('Dr')
        const medication = describeResult('log', { ...base, type: 'medication_change', medication: { name: 'Eye drops', change: 'added', details: '2 drops' } })
        expect([medication.title, medication.lead.text]).toEqual(['Medication added · Eye drops', 'Rx'])
        expect(describeResult('log', { ...base, type: 'general' }).title).toBe('Note from Jasmine')
    })

    it('links each kind of result to its page', () => {
        expect(resultLink('task', { id: 't1' }, 'f1')).toEqual({ name: 'task-detail', params: { familyId: 'f1', taskId: 't1' } })
        expect(resultLink('log', { id: 'l1', recipient: { id: 'r1' } })).toEqual({ name: 'recipient-log', params: { recipientId: 'r1' }, hash: '#log-l1' })
        expect(resultLink('person', { id: 'r1', kind: 'recipient' }).name).toBe('recipient-overview')
        expect(resultLink('person', { id: 'u1', kind: 'member' }).name).toBe('public-profile')
        expect(resultLink('place', { name: 'TTSH Eye Centre' })).toEqual({ name: 'search', query: { q: 'TTSH Eye Centre', type: 'tasks' } })
    })

    it('flattens results for the page: tiers first, or by date', () => {
        const results = {
            tasks: [{ id: 't1', matchTier: 2, startAt: '2026-10-01' }],
            logs: [{ id: 'l1', matchTier: 0, createdAt: '2026-10-20' }],
            people: [],
            places: [{ name: 'Clinic', matchTier: 1 }]
        }
        expect(flattenResults(results, ['tasks', 'logs', 'places']).map((row) => row.key)).toEqual(['log-l1', 'place-Clinic', 'task-t1'])
        expect(flattenResults(results, ['tasks', 'logs', 'places'], 'newest').map((row) => row.key)).toEqual(['log-l1', 'task-t1', 'place-Clinic'])
        expect(flattenResults(results, ['logs']).map((row) => row.key)).toEqual(['log-l1'])
    })
})
