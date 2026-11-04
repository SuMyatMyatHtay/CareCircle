import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import MyTasksView from '../views/MyTasksView.vue'
import { getMyTasks, unclaimTask } from '../services/myTasksApi.js'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../utils/useIsMobile.js', async () => {
    const { ref } = await import('vue')
    return { useIsMobile: () => ref(false) }
})
vi.mock('../services/myTasksApi.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getMyTasks: vi.fn(),
    unclaimTask: vi.fn()
}))

const family = { _id: 'family-1', name: 'Tan family' }
const task = (id, title) => ({
    _id: id,
    title,
    family,
    status: 'claimed',
    startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
})

// Shows each task's title and whether it's open, without the full card
const MyTaskCard = {
    props: ['task', 'expanded'],
    emits: ['toggle', 'give-back'],
    template: `<article class="card" :data-expanded="expanded">
        {{ task.title }}
        <button class="toggle" @click="$emit('toggle')"></button>
        <button class="give-back" @click="$emit('give-back')"></button>
    </article>`
}

describe('MyTasksView caching', () => {
    let client

    function open() {
        return mount(MyTasksView, {
            global: {
                plugins: [[VueQueryPlugin, { queryClient: client }]],
                stubs: {
                    MyTaskCard,
                    TransitionGroup: { template: '<div><slot /></div>' },
                    WeekStrip: true,
                    GoogleCalendarSync: true,
                    AddToCalendar: true,
                    RouterLink: true
                }
            }
        })
    }

    beforeEach(() => {
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    afterEach(() => client.clear())

    it('shows the cached list straight away on a revisit and updates it from the background fetch', async () => {
        getMyTasks.mockResolvedValueOnce([task('a', 'Physio')])
        const first = open()
        await flushPromises()
        first.unmount()

        let finishFetch
        getMyTasks.mockReturnValueOnce(new Promise((resolve) => { finishFetch = resolve }))
        const second = open()
        await flushPromises()

        // Still fetching: the old list is on screen, with no loading message
        expect(getMyTasks).toHaveBeenCalledTimes(2)
        expect(second.text()).toContain('Physio')
        expect(second.text()).not.toContain('Loading your tasks')

        finishFetch([task('b', 'Groceries')])
        await flushPromises()
        expect(second.text()).toContain('Groceries')
        expect(second.text()).not.toContain('Physio')
        second.unmount()
    })

    it('keeps the list when a background refresh fails', async () => {
        getMyTasks.mockResolvedValueOnce([task('a', 'Physio')])
        const wrapper = open()
        await flushPromises()

        getMyTasks.mockRejectedValueOnce(new Error('Network down'))
        window.dispatchEvent(new CustomEvent('carecircle:task-updated'))
        await flushPromises()

        expect(wrapper.text()).toContain('Physio')
        expect(wrapper.text()).not.toContain('Network down')
        wrapper.unmount()
    })

    it('shows an error with a retry when there is nothing cached', async () => {
        getMyTasks.mockRejectedValueOnce(new Error('Network down'))
        const wrapper = open()
        await flushPromises()
        expect(wrapper.get('[role="alert"]').text()).toContain('Network down')

        getMyTasks.mockResolvedValueOnce([task('a', 'Physio')])
        await wrapper.get('[role="alert"] button').trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('Physio')
        wrapper.unmount()
    })

    it('leaves your open or closed task alone when the list refreshes', async () => {
        const rows = [task('a', 'Physio'), task('b', 'Groceries')]
        getMyTasks.mockResolvedValue(rows)
        const wrapper = open()
        await flushPromises()
        const expanded = () => wrapper.findAll('.card').map((card) => card.attributes('data-expanded'))
        expect(expanded()).toEqual(['true', 'false'])

        const refresh = async () => {
            window.dispatchEvent(new CustomEvent('carecircle:task-updated'))
            await flushPromises()
        }

        // Open the second task
        await wrapper.findAll('.toggle')[1].trigger('click')
        getMyTasks.mockResolvedValue(rows.map((row) => ({ ...row })))
        await refresh()
        expect(expanded()).toEqual(['false', 'true'])

        // Close it: a refresh doesn't reopen anything
        await wrapper.findAll('.toggle')[1].trigger('click')
        getMyTasks.mockResolvedValue(rows.map((row) => ({ ...row })))
        await refresh()
        expect(expanded()).toEqual(['false', 'false'])
        wrapper.unmount()
    })

    it('removes a given-back task immediately and opens the next one', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        getMyTasks.mockResolvedValue([task('a', 'Physio'), task('b', 'Groceries')])
        unclaimTask.mockResolvedValue({ task: { _id: 'a', status: 'open' } })
        const wrapper = open()
        await flushPromises()

        await wrapper.findAll('.give-back')[0].trigger('click')
        await flushPromises()

        expect(wrapper.text()).not.toContain('Physio')
        expect(wrapper.findAll('.card').map((card) => card.attributes('data-expanded'))).toEqual(['true'])
        wrapper.unmount()
    })
})
