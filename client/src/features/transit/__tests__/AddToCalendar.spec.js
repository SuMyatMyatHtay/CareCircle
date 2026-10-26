// Owner: Chaithra (E) · Week 10b: component test ("Add to calendar" pop-up on its own)
// Only the Google sync status call is doubled; the calendar links are the real ones.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../../my-tasks/services/googleCalendarApi.js', () => ({ getGoogleStatus: vi.fn() }))
import { getGoogleStatus } from '../../my-tasks/services/googleCalendarApi.js'

const task = (extra = {}) => ({
    _id: 'task1',
    title: 'Physio',
    startAt: '2026-10-29T02:00:00.000Z',
    status: 'claimed',
    claimedBy: 'me1',
    location: { name: 'Tan Tock Seng Hospital' },
    family: { name: 'Tan family' },
    ...extra
})

// The component reads who is logged in when it loads, so import it after setting that
async function render(props) {
    vi.resetModules()
    const { default: AddToCalendar } = await import('../components/AddToCalendar.vue')
    const wrapper = mount(AddToCalendar, { attachTo: document.body, props: { modelValue: false, ...props } })
    if (props.modelValue) {
        await wrapper.setProps({ modelValue: false })
        await wrapper.setProps({ modelValue: true }) // opening runs the sync check
        await flushPromises()
    }
    return wrapper
}
const dialog = () => document.querySelector('[role="dialog"]')

beforeEach(() => {
    sessionStorage.setItem('user', JSON.stringify({ id: 'me1' }))
    getGoogleStatus.mockResolvedValue({ connected: false })
})

describe('TestSuite: AddToCalendar pop-up', () => {
    it('Test1: shows nothing while closed', async () => {
        await render({ modelValue: false, tasks: [task()] })
        expect(dialog()).toBeNull()
    })

    it('Test2: one task shows Google, Apple and Outlook with the task filled in', async () => {
        await render({ modelValue: true, tasks: [task()] })
        const text = dialog().textContent
        expect(text).toContain('Physio')
        expect(text).toContain('Tan Tock Seng Hospital')
        expect(text).toContain('Google Calendar')
        expect(text).toContain('Apple Calendar')
        expect(text).toContain('Outlook')
        const google = [...dialog().querySelectorAll('a')].find((a) => a.textContent.includes('Google Calendar'))
        expect(google.getAttribute('href')).toContain('calendar.google.com')
        expect(google.getAttribute('href')).toContain('text=Physio')
    })

    it('Test3: Escape and the close button both ask to close', async () => {
        const wrapper = await render({ modelValue: true, tasks: [task()] })
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        dialog().querySelector('button[aria-label="Close"]').click()
        expect(wrapper.emitted('update:modelValue')).toEqual([[false], [false]])
    })

    it('Test4: several tasks show one row each with the three apps', async () => {
        await render({ modelValue: true, tasks: [task(), task({ _id: 'task2', title: 'Collect medicine' })] })
        const rows = dialog().querySelectorAll('li')
        expect(rows).toHaveLength(2)
        expect(rows[1].textContent).toContain('Collect medicine')
        expect(rows[1].querySelector('a[aria-label="Add Collect medicine to Google Calendar"]')).not.toBeNull()
    })

    it('Test5: with Google sync on, my claimed task says it is already added', async () => {
        getGoogleStatus.mockResolvedValue({ connected: true })
        await render({ modelValue: true, tasks: [task()] })
        expect(dialog().textContent).toContain('Already added automatically (sync is on)')
    })

    it('Test6: with Google sync on, someone else\'s task still gets the Google link', async () => {
        getGoogleStatus.mockResolvedValue({ connected: true })
        await render({ modelValue: true, tasks: [task({ claimedBy: 'someone-else' })] })
        expect(dialog().textContent).not.toContain('Already added automatically')
    })

    it('Test7: says so when there are no tasks to add', async () => {
        await render({ modelValue: true, tasks: [] })
        expect(dialog().textContent).toContain('No upcoming tasks to add.')
    })
})
