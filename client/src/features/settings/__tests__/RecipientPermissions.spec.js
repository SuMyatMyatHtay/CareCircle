// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import TaskPermissionsCard from '../components/TaskPermissionsCard.vue'
import { http } from '../../../services/http.js'

vi.mock('../../../services/http.js', () => ({ http: { patch: vi.fn() } }))
let wrapper
afterEach(() => { wrapper?.unmount(); vi.resetAllMocks() })
function create(admin) {
  sessionStorage.setItem('token', 'test-only')
  const workspace = { selectedFamily: ref({ id: 'family', overdueTaskDeletion: 'member' }), selectedFamilyId: ref('family'), isAdmin: ref(admin), isPreview: false }
  wrapper = mount(TaskPermissionsCard, { global: { provide: { [Symbol.for('carecircle:family-workspace')]: workspace } } })
  return workspace
}
describe('recipient removal permissions', () => {
  it('defaults to admins and saves the new recipient setting without task permissions', async () => {
    const workspace = create(true)
    expect(wrapper.text()).toContain('Who can remove care recipients?')
    expect(wrapper.get('input[value=admin]').element.checked).toBe(true)
    http.patch.mockResolvedValue({ data: { recipientDeletion: 'member' } })
    await wrapper.get('input[value=member]').setValue()
    await flushPromises()
    expect(http.patch).toHaveBeenCalledWith('/families/family/recipient-permissions', { recipientDeletion: 'member' }, expect.any(Object))
    expect(workspace.selectedFamily.value.recipientDeletion).toBe('member')
    expect(wrapper.text()).toContain('Recipient permissions saved.')
  })
  it('keeps the setting read-only for members', () => {
    create(false)
    expect(wrapper.get('fieldset').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Ask a family admin')
  })
})
