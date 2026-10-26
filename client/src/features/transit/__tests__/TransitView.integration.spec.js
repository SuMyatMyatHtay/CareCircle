// Owner: Chaithra (E) · Week 10b: integration test
// The real TransitView page and its real TransitMobile child (phone layout) working together:
// a tap in the child -> the page saves it -> the child shows the saved result.
// Only the HTTP calls (transitApi / myTasksApi) are doubled, with an in-memory "server".
// The map is a stub: OneMap pictures are outside this test.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/transitApi.js', () => ({
    getTask: vi.fn(),
    getTransitSession: vi.fn(),
    postMilestone: vi.fn(),
    removeMilestone: vi.fn(),
    endTransit: vi.fn(),
    resumeTransit: vi.fn(),
    updateLocation: vi.fn(),
    getActiveTransitSessions: vi.fn()
}))
vi.mock('../../my-tasks/services/myTasksApi.js', () => ({
    startTask: vi.fn(),
    getErrorMessage: (error) => error.response?.data?.error || error.message
}))
vi.mock('../../../composables/useActiveFamily.js', async () => {
    const { ref } = await import('vue')
    return { useActiveFamily: () => ({ families: ref([{ id: 'fam1', name: 'Tan family' }]) }) }
})

import * as api from '../services/transitApi.js'
import { startTask } from '../../my-tasks/services/myTasksApi.js'
import TransitView from '../views/TransitView.vue'

const JASMINE = 'u-jasmine'
const ALEX = 'u-alex'
let server // in-memory stand-in for the API's data

function freshServer() {
    return {
        task: {
            _id: 'task1',
            title: 'Physio',
            status: 'claimed',
            needsTransit: true,
            claimedBy: { _id: JASMINE, name: 'Jasmine Tan' },
            recipient: { _id: 'r1', name: 'Grandpa' },
            location: { name: 'Tan Tock Seng Hospital' }
        },
        session: null
    }
}
const copy = (value) => JSON.parse(JSON.stringify(value))
let clock = Date.parse('2026-10-29T02:00:00.000Z')
const nextTime = () => new Date((clock += 60000)).toISOString()

beforeEach(() => {
    server = freshServer()
    api.getTask.mockImplementation(async () => copy(server.task))
    api.getTransitSession.mockImplementation(async () => copy(server.session))
    api.getActiveTransitSessions.mockResolvedValue([])
    startTask.mockImplementation(async () => {
        server.task.status = 'in_progress'
        server.session = { status: 'active', companion: { _id: JASMINE, name: 'Jasmine Tan' }, milestones: [], path: [], startedAt: nextTime() }
        return { task: copy(server.task), transitSession: copy(server.session) }
    })
    api.postMilestone.mockImplementation(async (_f, _t, { type, label }) => {
        server.session.milestones.push({ type, label, at: nextTime() })
        if (type === 'home') {
            server.session.status = 'ended'
            server.task.status = 'completed'
        }
        return copy(server.session)
    })
    api.removeMilestone.mockImplementation(async (_f, _t, at) => {
        server.session.milestones = server.session.milestones.filter((m) => m.at !== at)
        return copy(server.session)
    })
    // Phone-sized screen, so TransitView shows TransitMobile
    window.matchMedia = vi.fn((query) => ({
        media: query, matches: true, addEventListener() {}, removeEventListener() {}
    }))
})

async function openAs(userId) {
    sessionStorage.setItem('user', JSON.stringify({ id: userId }))
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/transit/:familyId/:taskId', name: 'transit', component: TransitView, props: true },
            { path: '/tasks/:familyId/:taskId', name: 'task-detail', component: { template: '<p>Task detail</p>' } }
        ]
    })
    router.push('/transit/fam1/task1')
    await router.isReady()
    const wrapper = mount({ template: '<RouterView />' }, {
        attachTo: document.body,
        global: { plugins: [router], stubs: { OneMapTiles: true } }
    })
    await flushPromises()
    return wrapper
}
const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text().trim() === text)
const steps = (wrapper) => wrapper.findAll('.steps li.done strong').map((s) => s.text())

describe('TestSuite: TransitView + TransitMobile working together', () => {
    it('Test1: the claimer starts the trip and the live trip appears', async () => {
        const wrapper = await openAs(JASMINE)
        await button(wrapper, 'Start the trip').trigger('click')
        await flushPromises()
        expect(startTask).toHaveBeenCalledWith('fam1', 'task1')
        expect(wrapper.text()).toContain('Live')
        expect(wrapper.text()).toContain('Post the next update')
    })

    it('Test2: posting quick and typed updates shows them on the timeline', async () => {
        const wrapper = await openAs(JASMINE)
        await button(wrapper, 'Start the trip').trigger('click')
        await flushPromises()

        await wrapper.findAll('.chip')[0].trigger('click') // "Departed home"
        await flushPromises()
        await wrapper.get('input[aria-label="Your own update"]').setValue('Stuck in traffic')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        expect(steps(wrapper)).toEqual(['Departed home', 'Stuck in traffic'])
        expect(api.postMilestone).toHaveBeenLastCalledWith('fam1', 'task1', { type: 'custom', label: 'Stuck in traffic' })
    })

    it('Test3: × removes a wrong update after the person confirms', async () => {
        const wrapper = await openAs(JASMINE)
        await button(wrapper, 'Start the trip').trigger('click')
        await flushPromises()
        await wrapper.get('input[aria-label="Your own update"]').setValue('asdfgh')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        vi.spyOn(window, 'confirm').mockReturnValue(true)
        await wrapper.get('button[aria-label="Remove asdfgh"]').trigger('click')
        await flushPromises()

        expect(steps(wrapper)).not.toContain('asdfgh')
        expect(wrapper.text()).toContain('Update removed.')
    })

    it('Test4: "safely back home" ends the trip and shows the task is done', async () => {
        const wrapper = await openAs(JASMINE)
        await button(wrapper, 'Start the trip').trigger('click')
        await flushPromises()

        vi.spyOn(window, 'confirm').mockReturnValue(true)
        await button(wrapper, 'Grandpa is safely back home').trigger('click')
        await flushPromises()

        expect(wrapper.text()).toContain('Grandpa is safely back home. The task is done.')
        expect(wrapper.text()).toContain('Ended')
        expect(button(wrapper, 'Grandpa is safely back home')).toBeFalsy()
    })

    it('Test5: another family member only follows along', async () => {
        server.task.status = 'in_progress'
        server.session = {
            status: 'active', companion: { _id: JASMINE, name: 'Jasmine Tan' }, path: [],
            milestones: [{ type: 'departed', label: 'Departed home', at: nextTime() }]
        }
        const wrapper = await openAs(ALEX)
        expect(steps(wrapper)).toEqual(['Departed home'])
        expect(wrapper.text()).toContain('Only Jasmine can post updates')
        expect(button(wrapper, 'Start the trip')).toBeFalsy()
        expect(wrapper.find('.chip').exists()).toBe(false)
    })

    it('Test6: a failed save shows the server\'s message and keeps the timeline', async () => {
        const wrapper = await openAs(JASMINE)
        await button(wrapper, 'Start the trip').trigger('click')
        await flushPromises()
        api.postMilestone.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Only the person on this trip can post updates' } } })

        await wrapper.findAll('.chip')[0].trigger('click')
        await flushPromises()

        expect(wrapper.get('[role="alert"]').text()).toBe('Only the person on this trip can post updates')
        expect(steps(wrapper)).toEqual([])
    })
})
