import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import TaskPermissionsCard from '../components/TaskPermissionsCard.vue'
import { http } from '../../../services/http.js'

let workspace
function render() {
  return mount(TaskPermissionsCard, {
    global: { provide: { [Symbol.for('carecircle:family-workspace')]: workspace } },
  })
}
beforeEach(() => {
  sessionStorage.setItem('token', 'component-test-only')
  workspace = {
    selectedFamily: ref({ id: 'one', name: 'Tan family' }),
    selectedFamilyId: ref('one'), isAdmin: ref(true), isPreview: false,
  }
})

describe('Overdue task deletion permissions card', () => {
  it('defaults to admins only when older family records have no preference', () => {
    const wrapper = render()
    expect(wrapper.get('input[value="admin"]').element.checked).toBe(true)
    expect(wrapper.get('input[value="member"]').element.checked).toBe(false)
  })

  it('saves a permission and updates the shared family only after success', async () => {
    let finish
    const save = vi.spyOn(http, 'patch').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = render()
    await wrapper.get('input[value="member"]').setValue()
    expect(wrapper.get('input[value="member"]').element.checked).toBe(true)
    expect(wrapper.get('fieldset').element.disabled).toBe(true)
    expect(workspace.selectedFamily.value.overdueTaskDeletion).toBeUndefined()
    expect(save).toHaveBeenCalledWith('/families/one/task-permissions', { overdueTaskDeletion: 'member' }, expect.any(Object))
    finish({ data: { overdueTaskDeletion: 'member' } })
    await flushPromises()
    expect(workspace.selectedFamily.value.overdueTaskDeletion).toBe('member')
    expect(wrapper.get('fieldset').element.disabled).toBe(false)
    expect(wrapper.text()).toContain('Task permissions saved.')
  })

  it('restores the saved selection after a failure and permits a retry', async () => {
    const save = vi.spyOn(http, 'patch').mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValue({ data: { overdueTaskDeletion: 'member' } })
    const wrapper = render()
    await wrapper.get('input[value="member"]').setValue()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Connection lost')
    expect(wrapper.get('input[value="admin"]').element.checked).toBe(true)
    expect(workspace.selectedFamily.value.overdueTaskDeletion).toBeUndefined()
    await wrapper.get('input[value="member"]').setValue()
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(workspace.selectedFamily.value.overdueTaskDeletion).toBe('member')
  })

  it('does not send a write if an ordinary member bypasses the disabled fieldset', async () => {
    workspace.isAdmin.value = false
    const save = vi.spyOn(http, 'patch')
    const wrapper = render()
    expect(wrapper.get('fieldset').element.disabled).toBe(true)
    await wrapper.get('input[value="member"]').trigger('change')
    expect(save).not.toHaveBeenCalled()
    expect(workspace.selectedFamily.value.overdueTaskDeletion).toBeUndefined()
  })

  it('does not apply a late save to a different family', async () => {
    let finish
    vi.spyOn(http, 'patch').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = render()
    await wrapper.get('input[value="member"]').setValue()
    workspace.selectedFamilyId.value = 'two'
    workspace.selectedFamily.value = { id: 'two', overdueTaskDeletion: 'admin' }
    finish({ data: { overdueTaskDeletion: 'member' } })
    await flushPromises()
    expect(workspace.selectedFamily.value.overdueTaskDeletion).toBe('admin')
    expect(wrapper.text()).not.toContain('Task permissions saved.')
  })
})
