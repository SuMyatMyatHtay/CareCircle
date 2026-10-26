// Owner: Chaithra (E) · Week 10b: component test (phone Transit mode on its own)
// TransitMobile only shows the trip and sends events up; TransitView does the saving.
// The map is replaced by a stub (it needs OneMap pictures, which aren't part of this test).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TransitMobile from '../components/TransitMobile.vue'

const task = {
    _id: 'task1',
    title: 'Physio',
    status: 'in_progress',
    location: { name: 'Tan Tock Seng Hospital', lat: 1.3214, lng: 103.8458 }
}
const step = (type, label, at = '2026-10-29T02:30:00.000Z') => ({ type, label, at })
const activeSession = (milestones = []) => ({ status: 'active', milestones, path: [] })

function render(props = {}) {
    return mount(TransitMobile, {
        props: { task, who: 'Grandpa', companionFirst: 'Jasmine', ...props },
        global: { stubs: { OneMapTiles: true } }
    })
}
const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text().trim() === text)
const chipLabels = (wrapper) => wrapper.findAll('.chip').map((c) => c.text())

describe('TestSuite: TransitMobile (phone Transit mode)', () => {
    it('Test1: before the trip, the claimer sees "Start the trip"', async () => {
        const wrapper = render({ session: null, canStart: true })
        expect(wrapper.text()).toContain('Transit not started yet')
        await button(wrapper, 'Start the trip').trigger('click')
        expect(wrapper.emitted('start')).toHaveLength(1)
    })

    it('Test2: family members following along cannot post updates', () => {
        const wrapper = render({ session: activeSession([step('departed', 'Departed home')]), isCompanion: false })
        expect(wrapper.text()).toContain('Only Jasmine can post updates')
        expect(wrapper.find('.chip').exists()).toBe(false)
        expect(wrapper.find('button[aria-label^="Remove"]').exists()).toBe(false)
    })

    it('Test3: suggests the next fixed step first and hides updates already posted', () => {
        const wrapper = render({
            session: activeSession([step('departed', 'Departed home'), step('custom', 'Picked up Grandpa')]),
            isCompanion: true
        })
        const chips = chipLabels(wrapper)
        expect(chips[0]).toBe('Arrived at clinic')
        expect(chips).not.toContain('Picked up Grandpa')
        expect(chips).toHaveLength(4)
    })

    it('Test4: tapping a quick update sends it to be posted', async () => {
        const wrapper = render({ session: activeSession(), isCompanion: true })
        await wrapper.findAll('.chip')[0].trigger('click')
        expect(wrapper.emitted('post')[0]).toEqual([{ type: 'departed', label: 'Departed home' }])
    })

    it('Test5: posts a typed update and clears the box; a blank one cannot be sent', async () => {
        const wrapper = render({ session: activeSession(), isCompanion: true })
        const send = wrapper.get('button[aria-label="Post update"]')
        expect(send.element.disabled).toBe(true)

        await wrapper.get('input[aria-label="Your own update"]').setValue('  Waiting at pharmacy  ')
        await wrapper.get('form').trigger('submit')
        expect(wrapper.emitted('post')[0]).toEqual([{ type: 'custom', label: 'Waiting at pharmacy' }])
        expect(wrapper.get('input[aria-label="Your own update"]').element.value).toBe('')
    })

    it('Test6: "safely back home" asks first, and only posts after OK', async () => {
        const wrapper = render({ session: activeSession(), isCompanion: true })
        const confirm = vi.spyOn(window, 'confirm')

        confirm.mockReturnValueOnce(false)
        await button(wrapper, 'Grandpa is safely back home').trigger('click')
        expect(wrapper.emitted('post')).toBeUndefined()

        confirm.mockReturnValueOnce(true)
        await button(wrapper, 'Grandpa is safely back home').trigger('click')
        expect(wrapper.emitted('post')[0]).toEqual([{ type: 'home', label: 'Safely back home' }])
    })

    it('Test7: the companion can remove a wrong update with ×', async () => {
        const wrong = step('custom', 'asdfgh')
        const wrapper = render({ session: activeSession([step('departed', 'Departed home'), wrong]), isCompanion: true })
        await wrapper.get('button[aria-label="Remove asdfgh"]').trigger('click')
        expect(wrapper.emitted('remove')[0]).toEqual([{ ...wrong, done: true }])
    })

    it('Test8: a finished trip shows the done message and no × on "Safely back home"', () => {
        const wrapper = render({
            task: { ...task, status: 'completed' },
            session: { status: 'ended', path: [], milestones: [step('departed', 'Departed home'), step('home', 'Safely back home')] },
            isCompanion: true
        })
        expect(wrapper.text()).toContain('Grandpa is safely back home. The task is done.')
        expect(wrapper.text()).toContain('Ended')
        expect(wrapper.find('button[aria-label="Remove Safely back home"]').exists()).toBe(false)
        expect(wrapper.find('.chip').exists()).toBe(false)
    })

    it('Test9: an ended trip that is not done can be resumed', async () => {
        const wrapper = render({
            session: { status: 'ended', path: [], milestones: [step('departed', 'Departed home')] },
            isCompanion: true,
            canResume: true
        })
        expect(wrapper.text()).toContain('Trip ended. The task is still in progress.')
        await button(wrapper, 'Resume the trip').trigger('click')
        expect(wrapper.emitted('resume')).toHaveLength(1)
    })

    it('Test10: shows other family trips and opens one when tapped', async () => {
        const trip = { taskId: 'task2', companion: { name: 'Alex Tan' }, mobileHeadline: 'Grandma is heading home' }
        const wrapper = render({ session: activeSession(), otherTrips: [trip] })
        expect(wrapper.text()).toContain('Also on a trip:')
        expect(wrapper.text()).toContain('Alex · Grandma is heading home')
        await wrapper.get('.also-live-chip').trigger('click')
        expect(wrapper.emitted('open-trip')[0]).toEqual([trip])
    })
})
