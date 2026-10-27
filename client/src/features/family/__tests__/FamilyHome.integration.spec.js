import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VueQueryPlugin } from '@tanstack/vue-query'
import FamilyHomeView from '../views/FamilyHomeView.vue'
import TodayTasks from '../components/TodayTasks.vue'
import MobileHomeNavigation from '../components/MobileHomeNavigation.vue'
import MobileTodayTasks from '../components/MobileTodayTasks.vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { http } from '../../../services/http.js'
import { queryClient, queryKeys } from '../../../services/queryClient.js'

let wrapper, router, active, tasks
const findButton = (component, label) => component.findAll('button').find(button => button.text().trim() === label)
beforeEach(async () => {
  sessionStorage.setItem('token', 'test-only')
  sessionStorage.setItem('user', JSON.stringify({ id: 'alex', name: 'Alex Tan' }))
  active = useActiveFamily()
  active.clearFamilies()
  active.families.value = [{ id: 'one', name: 'Tan family', members: [{ userId: 'alex', role: 'admin' }] }]
  active.selectFamily('one')
  const startAt = new Date().toISOString()
  tasks = [
    { _id: 'today', family: 'one', title: 'Buy groceries', startAt, status: 'open' },
    { _id: 'future', family: 'one', title: 'Future appointment', startAt: new Date(Date.now() + 30 * 86400000).toISOString(), status: 'open' },
    { _id: 'done', family: 'one', title: 'Completed walk', startAt, status: 'completed', claimedBy: { _id: 'alex', name: 'Alex Tan' } },
  ]
  queryClient.clear()
  queryClient.setQueryData(queryKeys.tasks('one'), tasks)
  vi.spyOn(http, 'get').mockImplementation(async path => {
    if (path.endsWith('/transit')) return { data: { transitSessions: [] } }
    if (path.endsWith('/notifications')) return { data: { notifications: [] } }
    if (path.endsWith('/tasks')) return { data: { tasks } }
    throw new Error(`Unexpected request: ${path}`)
  })
  const workspace = {
    ...active, user: ref({ id: 'alex', name: 'Alex Tan' }), isPreview: false,
    isAdmin: computed(() => true), recipients: ref([]), recipientsLoading: ref(false), recipientsError: ref(''),
    loadRecipients: async () => {}, homePath: '/home', settingsPath: '/settings',
  }
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/home', name: 'home', component: FamilyHomeView },
    { path: '/family-tasks', redirect: '/home' },
    { path: '/my-tasks', name: 'my-tasks', component: { template: '<p>My tasks</p>' } },
    { path: '/settings', component: { template: '<p>Settings</p>' } },
    { path: '/contributions', component: { template: '<p>Contributions</p>' } },
    { path: '/tasks/new', name: 'task-new', component: { template: '<p>New task</p>' } },
    { path: '/families/:familyId/tasks/:taskId', name: 'task-detail', component: { template: '<p>Task detail</p>' } },
  ] })
  await router.push('/home')
  wrapper = mount({ template: '<RouterView />' }, { global: {
    plugins: [router, [VueQueryPlugin, { queryClient }]],
    provide: { [Symbol.for('carecircle:family-workspace')]: workspace },
  } })
  await flushPromises()
})
afterEach(() => { wrapper?.unmount(); queryClient.clear() })

describe('Family home task board and navigation', () => {
  it('separates expired unclaimed tasks from tasks that still need someone', async () => {
    const past = new Date(Date.now() - 3600000).toISOString()
    queryClient.setQueryData(queryKeys.tasks('one'), [...tasks,
      { _id: 'expired', family: 'one', title: 'Missed appointment', status: 'open', startAt: past },
      { _id: 'already-claimed', family: 'one', title: 'Claimed appointment', status: 'claimed', startAt: past, claimedBy: { _id: 'alex', name: 'Alex' } },
      { _id: 'cancelled', family: 'one', title: 'Cancelled appointment', status: 'cancelled', startAt: past },
    ])
    await flushPromises()
    const board = wrapper.getComponent(TodayTasks)
    await findButton(board, 'Needs someone').trigger('click')
    expect(board.text()).toContain('Future appointment')
    expect(board.text()).not.toContain('Missed appointment')
    await findButton(board, 'Overdue').trigger('click')
    expect(board.text()).toContain('Missed appointment')
    expect(board.text()).toContain('Overdue · Claiming closed')
    expect(board.text()).not.toContain('Future appointment')
    expect(board.text()).not.toContain('Claimed appointment')
    expect(board.text()).not.toContain('Cancelled appointment')
    expect(board.text()).not.toContain('Completed walk')
  })

  it('keeps all task filters and claiming inside the existing home dashboard', async () => {
    const board = wrapper.getComponent(TodayTasks)
    expect(board.text()).toContain('Today across the family')
    expect(board.text()).toContain('Buy groceries')
    expect(board.text()).not.toContain('Future appointment')
    await findButton(board, 'Needs someone').trigger('click')
    expect(board.text()).toContain('Future appointment')
    expect(board.text()).not.toContain('Completed walk')
    vi.spyOn(http, 'post').mockImplementation(async path => {
      expect(path).toBe('/families/one/tasks/future/claim')
      const saved = { ...tasks[1], status: 'claimed', claimedBy: { _id: 'alex', name: 'Alex Tan' } }
      tasks[1] = saved
      return { data: { task: saved } }
    })
    await board.findAll('article').find(row => row.text().includes('Future appointment')).get('button').trigger('click')
    await flushPromises()
    expect(board.text()).not.toContain('Future appointment')
    await findButton(board, 'Claimed').trigger('click')
    expect(board.text()).toContain('Future appointment')
    expect(board.text()).toContain('Alex Tan')
    await findButton(board, 'Completed').trigger('click')
    expect(board.text()).toContain('Completed walk')
    expect(router.currentRoute.value.path).toBe('/home')
    expect(wrapper.text()).toContain('Recent updates')
  })

  it('opens mobile tasks within Home and supports navigating away and back', async () => {
    wrapper.getComponent(MobileHomeNavigation).vm.$emit('select', 'tasks')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/home')
    const lists = wrapper.findAllComponents(MobileTodayTasks)
    expect(lists.some(list => list.text().includes('Future appointment'))).toBe(true)
    await router.push('/my-tasks')
    await flushPromises()
    expect(wrapper.text()).toBe('My tasks')
    await router.push('/home')
    await flushPromises()
    expect(wrapper.text()).toContain('Today across the family')
    expect(wrapper.text()).toContain('Recent updates')
  })
})
