// Owner: Chaithra (E) · Week 10b: component test (MyTaskCard on its own)
// Checks what the user sees and which event each button sends to My Tasks.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MyTaskCard from '../components/MyTaskCard.vue'

const baseTask = {
    _id: 'task1',
    title: 'Physio',
    startAt: '2026-10-29T02:00:00.000Z',
    status: 'claimed',
    needsTransit: true,
    location: { name: 'Tan Tock Seng Hospital' },
    recipient: { _id: 'r1', name: 'Grandpa' },
    family: { _id: 'fam1', name: 'Tan family' }
}
function render(task = {}, props = {}) {
    return mount(MyTaskCard, {
        props: { task: { ...baseTask, ...task }, expanded: true, ...props },
        global: { stubs: { RouterLink: { props: ['to'], template: '<a class="router-link"><slot /></a>' } } }
    })
}
const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text)

describe('TestSuite: MyTaskCard', () => {
    it('Test1: shows the title, family, Singapore time, place and who it is for', () => {
        const text = render().text()
        expect(text).toContain('Physio')
        expect(text).toContain('Tan family')
        expect(text).toContain('10:00am')
        expect(text).toContain('Tan Tock Seng Hospital')
        expect(text).toContain('for Grandpa')
    })

    it('Test2: a claimed trip offers "Give back" and "Start the trip"', async () => {
        const wrapper = render()
        expect(button(wrapper, 'Give back')).toBeTruthy()
        await button(wrapper, 'Start the trip').trigger('click')
        expect(wrapper.emitted('start')).toHaveLength(1)
        await button(wrapper, 'Give back').trigger('click')
        expect(wrapper.emitted('give-back')).toHaveLength(1)
    })

    it('Test3: a claimed task with no travel says "Start task" instead', () => {
        const wrapper = render({ needsTransit: false })
        expect(button(wrapper, 'Start task')).toBeTruthy()
        expect(button(wrapper, 'Start the trip')).toBeFalsy()
    })

    it('Test4: a trip in progress shows "In transit", "Open the trip" and "Mark as done"', async () => {
        const wrapper = render({ status: 'in_progress' })
        expect(wrapper.text()).toContain('In transit')
        await button(wrapper, 'Open the trip').trigger('click')
        expect(wrapper.emitted('open-trip')).toHaveLength(1)
        await button(wrapper, 'Mark as done').trigger('click')
        expect(wrapper.emitted('complete')).toHaveLength(1)
    })

    it('Test5: a finished trip shows "Done" and only "View trip"', () => {
        const wrapper = render({ status: 'completed' })
        expect(wrapper.text()).toContain('Done')
        expect(button(wrapper, 'View trip')).toBeTruthy()
        expect(button(wrapper, 'Mark as done')).toBeFalsy()
        expect(button(wrapper, 'Give back')).toBeFalsy()
    })

    it('Test6: buttons are disabled while a request is being saved', () => {
        const wrapper = render({}, { busy: true })
        expect(button(wrapper, 'Start the trip').element.disabled).toBe(true)
        expect(button(wrapper, 'Give back').element.disabled).toBe(true)
    })

    it('Test7: a closed card hides the buttons; tapping it asks to open', async () => {
        const wrapper = render({}, { expanded: false })
        expect(button(wrapper, 'Start the trip')).toBeFalsy()
        await wrapper.get('button[aria-expanded="false"]').trigger('click')
        expect(wrapper.emitted('toggle')).toHaveLength(1)
    })

    it('Test8: shows a reminder instead of the status when one is given', () => {
        // Closed card, so the progress row (Claimed · In transit · Done) isn't showing
        const wrapper = render({}, { expanded: false, reminder: { type: 'soon', label: 'In 30 min' } })
        expect(wrapper.text()).toContain('In 30 min')
        expect(wrapper.text()).not.toContain('Claimed')
    })
})
