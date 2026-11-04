// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import DeleteFamilyCard from '../components/DeleteFamilyCard.vue'
import { http } from '../../../services/http.js'
const mocks = vi.hoisted(() => ({ push: vi.fn(), loadFamilies: vi.fn(), selectFamily: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('../../../services/http.js', () => ({ http: { delete: vi.fn() } }))
let workspace, wrapper
vi.mock('../../../composables/useActiveFamily.js', () => ({ useActiveFamily: () => ({ ...workspace, ...mocks }) }))
function create(admin = true) {
  sessionStorage.setItem('token', 'test')
  workspace = { selectedFamily: ref({ id: 'family', name: 'Tan family' }), selectedFamilyId: ref('family'), families: ref([{ id: 'family' }]), isAdmin: ref(admin), isPreview: false }
  wrapper = mount(DeleteFamilyCard, { global: { provide: { [Symbol.for('carecircle:family-workspace')]: workspace }, stubs: { CareModal: { template: '<div role="dialog"><slot /></div>' } } } })
}
afterEach(() => { wrapper?.unmount(); vi.resetAllMocks() })
it('hides family deletion from members', () => {
  create(false); expect(wrapper.find('button').exists()).toBe(false)
})
it('requires name and acknowledgement before deleting and removing cached membership', async () => {
  create(); http.delete.mockResolvedValue({ data: { deleted: true } })
  await wrapper.get('button').trigger('click')
  expect(wrapper.get('[role=alert]').text()).toContain('including completed tasks')
  expect(wrapper.get('button[type=submit]').element.disabled).toBe(true)
  await wrapper.get('input:not([type=checkbox])').setValue('Wrong family')
  await wrapper.get('input[type=checkbox]').setValue(true)
  await wrapper.get('form').trigger('submit'); expect(http.delete).not.toHaveBeenCalled()
  await wrapper.get('input:not([type=checkbox])').setValue('Tan family')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(http.delete).toHaveBeenCalledWith('/families/family', expect.objectContaining({ data: { confirmed: true, familyName: 'Tan family' } }))
  expect(workspace.families.value).toEqual([])
  expect(mocks.push).toHaveBeenCalledWith('/home')
})
it('shows server refusal without removing local membership', async () => {
  create(); http.delete.mockRejectedValue({ response: { data: { error: 'Only current admins can delete.' } } })
  await wrapper.get('button').trigger('click')
  await wrapper.get('input:not([type=checkbox])').setValue('Tan family')
  await wrapper.get('input[type=checkbox]').setValue(true)
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).toContain('Only current admins can delete.')
  expect(workspace.families.value).toHaveLength(1)
  expect(mocks.push).not.toHaveBeenCalled()
})
