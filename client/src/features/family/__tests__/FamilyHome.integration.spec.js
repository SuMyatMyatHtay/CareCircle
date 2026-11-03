import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VueQueryPlugin } from '@tanstack/vue-query'
import FamilyHomeView from '../views/FamilyHomeView.vue'
import TodayTasks from '../components/TodayTasks.vue'
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
  it('shows one future recurring row on desktop and mobile while preserving the missed occurrence', async () => {
    const sessions = [-1, 7, 14, 21, 28].map((days, index) => ({
      _id: `session-${index}`, family: 'one', recurringSeries: 'weekly',
      title: 'Weekly care', status: 'open',
      startAt: new Date(Date.now() + days * 86400000).toISOString(),
    }))
    queryClient.setQueryData(queryKeys.tasks('one'), sessions)
    await flushPromises()
    const board = wrapper.getComponent(TodayTasks)
    await findButton(board, 'Needs someone').trigger('click')
    expect(board.props('tasks').map(task => task._id)).toEqual(['session-1'])
    expect(board.text()).toContain('4 upcoming sessions')
    await findButton(board, 'Overdue').trigger('click')
    expect(board.props('tasks').map(task => task._id)).toEqual(['session-0'])
    wrapper.getComponent(MobileTodayTasks).vm.$emit('see-all')
    await flushPromises()
    await findButton(board, 'Needs someone').trigger('click')
    const mobile = wrapper.findAllComponents(MobileTodayTasks).find(list => list.props('title') === 'Family tasks')
    expect(mobile.props('tasks').map(task => task._id)).toEqual(['session-1'])
    expect(mobile.text()).toContain('4 upcoming sessions')
    await findButton(board, 'Overdue').trigger('click')
    expect(mobile.props('tasks').map(task => task._id)).toEqual(['session-0'])
  })

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
    // Opens on what's coming up, so a task for a later day can be claimed straight away
    expect(board.text()).toContain('Future appointment')
    expect(board.text()).not.toContain('Completed walk')
    await findButton(board, 'Today').trigger('click')
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
    await board.findAll('article').find(row => row.text().includes('Future appointment')).get('.care-claim-button').trigger('click')
    await flushPromises()
    // The claim button shows a check for ~400ms before the row leaves the filtered list
    await vi.waitFor(() => expect(board.text()).not.toContain('Future appointment'))
    await findButton(board, 'Claimed').trigger('click')
    expect(board.text()).toContain('Future appointment')
    expect(board.text()).toContain('Alex Tan')
    await findButton(board, 'Completed').trigger('click')
    expect(board.text()).toContain('Completed walk')
    expect(router.currentRoute.value.path).toBe('/home')
    expect(wrapper.text()).toContain('Recent updates')
  })

  it('opens all family tasks from "See all" on phones and supports navigating away and back', async () => {
    wrapper.findAllComponents(MobileTodayTasks)[0].vm.$emit('see-all')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/home')
    const lists = wrapper.findAllComponents(MobileTodayTasks)
    expect(lists.some(list => list.text().includes('Future appointment'))).toBe(true)
    await router.push('/my-tasks')
    await flushPromises()
    expect(wrapper.text()).toBe('My tasks')
    await router.push('/home')
    await flushPromises()
    expect(wrapper.text()).toContain('Across the family')
    expect(wrapper.text()).toContain('Recent updates')
  })

  it('has no bottom bar on phones: navigation is the left menu only', () => {
    expect(wrapper.find('.care-mobile-home-navigation').exists()).toBe(false)
  })
})

it('selects overdue tasks and sends only selected IDs after confirmation', async () => {
  const board = wrapper.getComponent(TodayTasks)
  await findButton(board, 'Overdue').trigger('click')
  const remove = board.findAll('button').find(button => button.text().includes('Delete selected'))
  expect(remove.element.disabled).toBe(true)
  const checkbox = board.get('input[aria-label="Select Buy groceries for deletion"]')
  await checkbox.setValue(true)
  expect(remove.text()).toContain('(1)')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const request = vi.spyOn(http, 'delete').mockResolvedValue({ data: { deletedCount: 1 } })
  await remove.trigger('click')
  expect(request).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  await remove.trigger('click')
  await flushPromises()
  expect(request).toHaveBeenCalledWith('/families/one/tasks/overdue', expect.objectContaining({ data: { taskIds: ['today'] } }))
  expect(board.text()).toContain('1 overdue task deleted.')
  expect(remove.element.disabled).toBe(true)
})
it('select all includes overdue tasks only and resets when changing filters', async () => {
  const board = wrapper.getComponent(TodayTasks)
  await findButton(board, 'Overdue').trigger('click')
  await board.get('.overdue-select-all input').setValue(true)
  expect(board.get('input[aria-label="Select Buy groceries for deletion"]').element.checked).toBe(true)
  expect(board.text()).toContain('Delete selected (1)')
  await findButton(board, 'All tasks').trigger('click')
  expect(board.find('.overdue-select-all').exists()).toBe(false)
  await findButton(board, 'Overdue').trigger('click')
  expect(board.get('input[aria-label="Select Buy groceries for deletion"]').element.checked).toBe(false)
})

it('assistant deletion refreshes the recorded summary without adding a task-title activity', async () => {
  const previousGet = http.get.getMockImplementation()
  vi.spyOn(http, 'get').mockImplementation(async path => path.endsWith('/notifications')
    ? { data: { notifications: [{ _id: 'summary', text: 'Alex deleted 1 overdue task.', createdAt: new Date().toISOString() }] } }
    : previousGet(path))
  window.dispatchEvent(new CustomEvent('carecircle:task-updated', { detail: { familyId: 'one', action: 'delete', deleted: true, title: 'Private task title' } }))
  await flushPromises()
  expect(wrapper.text()).toContain('Alex deleted 1 overdue task.')
  expect(wrapper.text()).not.toContain('Private task title')
})
