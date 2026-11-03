// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import TaskDeleteMenu from '../components/TaskDeleteMenu.vue'
import { deleteTask } from '../../my-tasks/services/myTasksApi.js'
import { queryClient, queryKeys } from '../../../services/queryClient.js'

vi.mock('../../../composables/useActiveFamily.js', () => ({ useActiveFamily: () => ({ selectedFamilyId: ref('family'), families: ref([{ id: 'family', members: [{ userId: 'admin', role: 'admin' }, { userId: 'creator', role: 'member' }, { userId: 'other', role: 'member' }] }]) }) }))
vi.mock('../../my-tasks/services/myTasksApi.js', () => ({ deleteTask: vi.fn(), getErrorMessage: error => error.message }))
const task = { _id: 'task', family: 'family', createdBy: 'creator', title: 'Doctor appointment', status: 'open', startAt: new Date(Date.now() + 86400000).toISOString() }
let wrapper
function create(user = 'admin', changes = {}) {
  sessionStorage.setItem('user', JSON.stringify({ id: user }))
  sessionStorage.setItem('token', 'test')
  wrapper = mount(TaskDeleteMenu, { props: { task: { ...task, ...changes } }, attachTo: document.body })
  return wrapper
}
afterEach(() => { wrapper?.unmount(); queryClient.clear(); vi.restoreAllMocks(); vi.resetAllMocks() })

describe('task deletion menu', () => {
  it('allows an admin to delete another creators task and removes it from the cache', async () => {
    queryClient.setQueryData(queryKeys.tasks('family'), [task])
    deleteTask.mockResolvedValue({})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    create()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const menuItem = document.querySelector('[role=menuitem]')
    expect(menuItem.textContent).toContain('Delete task')
    menuItem.click(); await flushPromises()
    expect(deleteTask).toHaveBeenCalledWith('family', 'task')
    expect(queryClient.getQueryData(queryKeys.tasks('family'))).toEqual([])
  })
  it('allows the creator but hides controls for unrelated members', () => {
    create('creator'); expect(wrapper.find('button').exists()).toBe(true)
    wrapper.unmount()
    create('other'); expect(wrapper.find('button').exists()).toBe(false)
  })
  it('shows the individual menu for overdue tasks too', () => {
    create('admin', { startAt: new Date(0).toISOString() })
    expect(wrapper.find('button').exists()).toBe(true)
  })
  it('protects completed and in-progress tasks', () => {
    for (const changes of [{ status: 'completed' }, { status: 'in_progress' }]) {
      create('admin', changes)
      expect(wrapper.find('button').exists()).toBe(false)
      wrapper.unmount()
    }
  })
  it('cancelling confirmation does not delete a task', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    create()
    await wrapper.get('button').trigger('click'); await flushPromises()
    document.querySelector('[role=menuitem]').click(); await flushPromises()
    expect(deleteTask).not.toHaveBeenCalled()
  })
  it('explains that recurring deletion affects only the displayed session and shows server errors', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteTask.mockRejectedValue(new Error('Task has already started.'))
    create('admin', { recurringSeries: 'series' })
    await wrapper.get('button').trigger('click'); await flushPromises()
    document.querySelector('[role=menuitem]').click(); await flushPromises()
    expect(confirm.mock.calls[0][0]).toContain('only the displayed session')
    expect(wrapper.get('[role=alert]').text()).toContain('already started')
  })
})
