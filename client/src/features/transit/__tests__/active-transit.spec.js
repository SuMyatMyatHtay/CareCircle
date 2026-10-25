import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import TransitBanner from '../../family/components/TransitBanner.vue'
import { useActiveTransit } from '../utils/useActiveTransit.js'
import { getActiveTransitSessions } from '../services/transitApi.js'

vi.mock('../services/transitApi.js', () => ({ getActiveTransitSessions: vi.fn() }))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const trip = (id, name = 'Grandpa') => ({ _id: `session-${id}`, task: { _id: id, recipient: { name }, location: { name: 'Clinic' } },
  companion: { name: 'Jasmine' }, startedAt: '2026-10-26T02:00:00Z', milestones: [{ type: 'arrived', at: '2026-10-26T02:10:00Z' }] })
async function render(options = {}) {
  const family = ref('family-a')
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<p>Home</p>' } },
    { path: '/transit/:familyId/:taskId', name: 'transit', component: { template: '<p>Trip</p>' } },
  ] })
  await router.push('/')
  const Host = defineComponent({ components: { TransitBanner }, setup() {
    return useActiveTransit(family, options)
  }, template: '<TransitBanner v-for="banner in liveTransits" :key="banner.taskId" :session="banner" @view="openLiveTransit(banner)" />' })
  const wrapper = mount(Host, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, family, router }
}

describe('Live trips follow the selected family', () => {
  it('renders the real banner and opens its family-scoped trip', async () => {
    getActiveTransitSessions.mockResolvedValue([trip('trip-a')])
    const { wrapper, router } = await render()
    expect(wrapper.text()).toContain('Grandpa arrived at Clinic with Jasmine')
    expect(wrapper.text()).toContain('1 of 5 milestones')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/transit/family-a/trip-a')
  })

  it('ignores a previous family’s late reply after switching families', async () => {
    const old = deferred()
    getActiveTransitSessions.mockReturnValueOnce(old.promise).mockResolvedValueOnce([trip('trip-b', 'Grandma')])
    const { wrapper, family } = await render()
    family.value = 'family-b'
    await flushPromises()
    old.resolve([trip('trip-a')])
    await flushPromises()
    expect(wrapper.text()).toContain('Grandma')
    expect(wrapper.text()).not.toContain('Grandpa')
  })

  it('keeps banners empty when a family is cleared before its reply arrives', async () => {
    const old = deferred()
    getActiveTransitSessions.mockReturnValue(old.promise)
    const { wrapper, family } = await render()
    family.value = ''
    await flushPromises()
    old.resolve([trip('trip-a')])
    await flushPromises()
    expect(wrapper.find('[aria-label="Active transit"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Grandpa')
  })

  it('never fetches real trips in an isolated preview', async () => {
    const { wrapper } = await render({ enabled: false })
    expect(getActiveTransitSessions).not.toHaveBeenCalled()
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('refreshes visible banners on a poll and stops polling after unmount', async () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    getActiveTransitSessions.mockResolvedValueOnce([trip('trip-a')]).mockResolvedValue([])
    const { wrapper } = await render()
    expect(wrapper.text()).toContain('Grandpa')
    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()
    expect(wrapper.find('button').exists()).toBe(false)
    expect(getActiveTransitSessions).toHaveBeenCalledTimes(2)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(45000)
    expect(getActiveTransitSessions).toHaveBeenCalledTimes(2)
  })
})
