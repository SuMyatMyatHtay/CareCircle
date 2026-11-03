// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import RemoveRecipientButton from '../components/RemoveRecipientButton.vue'
import { archiveRecipient } from '../services/recipientsApi.js'
import { queryClient, queryKeys } from '../../../services/queryClient.js'

const mocks = vi.hoisted(() => ({ push: vi.fn() }))
let workspace
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('../../../composables/useActiveFamily.js', () => ({ useActiveFamily: () => workspace }))
vi.mock('../services/recipientsApi.js', () => ({ archiveRecipient: vi.fn(), getRecipientErrorMessage: error => error.message }))
let wrapper
const recipient = { _id: 'grandpa', family: 'family', name: 'Grandpa' }
function create(role = 'admin', permission = 'admin', populated = false) {
  sessionStorage.setItem('user', JSON.stringify({ id: 'me' }))
  sessionStorage.setItem('token', 'test')
  workspace = { selectedFamilyId: ref('family'), selectedFamily: ref({ members: [{ userId: populated ? { _id: 'me' } : 'me', role }], recipientDeletion: permission }) }
  wrapper = mount(RemoveRecipientButton, { props: { recipient } })
}
afterEach(() => { wrapper?.unmount(); queryClient.clear(); vi.restoreAllMocks(); vi.resetAllMocks() })

describe('recipient removal', () => {
  it('lets admins remove a recipient and updates the sidebar cache', async () => {
    create()
    queryClient.setQueryData(queryKeys.recipientList('family'), [recipient])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    archiveRecipient.mockResolvedValue({ ...recipient, isActive: false })
    await wrapper.get('button').trigger('click'); await flushPromises()
    expect(archiveRecipient).toHaveBeenCalledWith('family', 'grandpa')
    expect(queryClient.getQueryData(queryKeys.recipientList('family'))).toEqual([])
    expect(mocks.push).toHaveBeenCalledWith('/home')
  })
  it('supports populated admin memberships', () => {
    create('admin', 'admin', true)
    expect(wrapper.get('button').text()).toBe('Remove recipient')
  })
  it('shows member access only when recipient removal is enabled', () => {
    create('member'); expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
    create('member', 'member'); expect(wrapper.find('button').exists()).toBe(true)
  })
  it('cancelling confirmation preserves the recipient', async () => {
    create(); vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('button').trigger('click')
    expect(archiveRecipient).not.toHaveBeenCalled()
  })
  it('shows server errors without leaving the page', async () => {
    create(); vi.spyOn(window, 'confirm').mockReturnValue(true)
    archiveRecipient.mockRejectedValue(new Error('Permission changed. Please refresh.'))
    await wrapper.get('button').trigger('click'); await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('Permission changed')
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
