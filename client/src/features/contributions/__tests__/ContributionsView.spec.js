import { it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ContributionsView from '../ContributionsView.vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { queryKeys } from '../../../services/queryClient.js'

it('links contributor avatars, gives ties distinct ranks, and orders a two-person podium first then second', async () => {
  const active = useActiveFamily()
  active.families.value = [{ id: 'one', name: 'Family' }]
  active.selectFamily('one')
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  const people = ['Alex', 'Jasmine', 'May', 'Mia'].map((name, index) => ({ _id: `user-${index}`, name }))
  const tasks = people.slice(0, 3).map((person, index) => ({ _id: `task-${index}`, family: 'one', title: 'Help out', status: 'completed', claimedBy: person, completedAt: new Date(Date.now() - 1000).toISOString() }))
  client.setQueryData(queryKeys.tasks('one'), tasks)
  client.setQueryData(['contribution-members', 'one'], people.map(user => ({ user })))
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/contributions', component: ContributionsView },
    { path: '/profile/:userId', component: { template: '<div />' } },
    { path: '/families/:familyId/tasks/:taskId', name: 'task-detail', component: { template: '<div />' } },
  ] })
  await router.push('/contributions')
  const wrapper = mount(ContributionsView, { global: {
    plugins: [router, [VueQueryPlugin, { queryClient: client }]],
    provide: { [Symbol.for('carecircle:family-workspace')]: { ...active, user: ref({ id: 'me' }), loadFamilies: vi.fn() } },
  } })
  try {
    await flushPromises()
    expect(wrapper.findAll('.contributions-step').map(node => node.text())).toEqual(['1', '2', '3'])
    expect(wrapper.findAll('.contributions-rank').map(node => node.text())).toEqual(['1', '2', '3', '—'])
    expect(wrapper.get('.contributions-winner a').attributes('href')).toBe('/profile/user-0')
    expect(wrapper.get('.contributions-ranking a').attributes('href')).toBe('/profile/user-0')
    expect(wrapper.get('.contributions-completion a').attributes('href')).toMatch(/^\/profile\//)
    expect(wrapper.findAll('a a')).toHaveLength(0)
    client.setQueryData(queryKeys.tasks('one'), tasks.slice(0, 2))
    await flushPromises()
    expect(wrapper.get('.contributions-podium').classes()).toContain('contributions-podium--compact')
    expect(wrapper.findAll('.contributions-winner strong').map(node => node.text())).toEqual(['Alex', 'Jasmine'])
  } finally { wrapper.unmount(); client.clear(); active.clearFamilies() }
})
