import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

// Integration tests: the REAL RecipientFormModal, RecipientForm and RecipientProfileView are
// mounted together. Only what is outside this feature is mocked: the network (recipientsApi),
// the router, shared composables, and two generic UI components from components/common.
// Details already covered by the component tests (every field, every message) are not repeated.

const { createRecipient, updateRecipient, archiveRecipient, refresh, push } = vi.hoisted(() => ({
    createRecipient: vi.fn(),
    updateRecipient: vi.fn(),
    archiveRecipient: vi.fn(),
    refresh: vi.fn(),
    push: vi.fn()
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

vi.mock('../services/recipientsApi.js', () => ({
    createRecipient,
    updateRecipient,
    archiveRecipient,
    getRecipientErrorMessage: (error) => error.response?.data?.error || error.message
}))

vi.mock('../../../composables/useRecipients.js', () => ({
    useRecipients: () => ({ refresh })
}))

vi.mock('../../../composables/useActiveFamily.js', async () => {
    const { ref } = await import('vue')
    const selectedFamilyId = ref('f1')
    const selectedFamily = ref({ name: 'Lim Family', members: [{ userId: 'u1', name: 'Jhen', role: 'admin' }] })
    return { useActiveFamily: () => ({ selectedFamilyId, selectedFamily }) }
})

vi.mock('../../../components/common/ProfilePicturePicker.vue', async () => {
    const { h } = await import('vue')
    return {
        default: {
            name: 'ProfilePicturePicker',
            props: ['modelValue', 'careType', 'disabled'],
            render() {
                return h('div')
            }
        }
    }
})

vi.mock('../../../components/common/SectionCard.vue', async () => {
    const { h } = await import('vue')
    return {
        default: {
            name: 'SectionCard',
            props: ['title'],
            render() {
                return h('section', { class: 'section-card' }, [
                    h('h2', this.title),
                    this.$slots.actions?.(),
                    this.$slots.default?.()
                ])
            }
        }
    }
})

import RecipientFormModal from '../components/RecipientFormModal.vue'
import RecipientForm from '../components/RecipientForm.vue'
import RecipientProfileView from '../views/RecipientProfileView.vue'

const recipient = {
    _id: 'r1',
    name: 'Tan Ah Kow',
    nickname: 'Grandpa',
    careType: 'elderly',
    allergies: [],
    conditions: [],
    dietaryRestrictions: [],
    medications: [],
    emergencyContacts: []
}

const buttonByText = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text)
const submit = async (wrapper) => {
    await wrapper.find('form').trigger('submit')
    await flushPromises()
}

beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    sessionStorage.setItem('user', JSON.stringify({ id: 'u1' }))
})

describe('TestSuite: Modal + Form (add a recipient)', () => {
    it('Test1: filling in the form and saving creates the recipient, refreshes the list and closes', async () => {
        const created = { _id: 'new', name: 'Lim Siew Lan', careType: 'pregnancy' }
        createRecipient.mockResolvedValue(created)
        const wrapper = mount(RecipientFormModal)

        await wrapper.find('#recipient-name').setValue('Lim Siew Lan')
        await buttonByText(wrapper, 'Pregnancy').trigger('click')
        await submit(wrapper)

        expect(createRecipient).toHaveBeenCalledWith('f1', expect.objectContaining({
            name: 'Lim Siew Lan', careType: 'pregnancy'
        }))
        expect(refresh).toHaveBeenCalledTimes(1)
        expect(wrapper.emitted('updated')).toEqual([[created]])
        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('Test2: a server error keeps the modal open, and the user can try again', async () => {
        createRecipient.mockRejectedValueOnce({ response: { data: { error: 'Family not found.' } } })
        const wrapper = mount(RecipientFormModal)
        await wrapper.find('#recipient-name').setValue('Lim Siew Lan')
        await buttonByText(wrapper, 'Elderly').trigger('click')
        await submit(wrapper)

        expect(wrapper.find('[role="alert"]').text()).toContain('Family not found.')
        expect(wrapper.emitted('close')).toBeUndefined()

        createRecipient.mockResolvedValueOnce({ _id: 'new' })
        await submit(wrapper)
        expect(wrapper.emitted('close')).toHaveLength(1)
    })
})

describe('TestSuite: Profile + Modal + Form (edit a recipient)', () => {
    const mountProfile = () =>
        mount(RecipientProfileView, { props: { recipient }, global: { stubs: { RouterLink: RouterLinkStub } } })
    const openEditor = (wrapper) => buttonByText(wrapper, 'Edit').trigger('click')

    it('Test1: Edit opens a prefilled form; saving updates, tells the hub, and the profile shows the new data', async () => {
        const saved = { ...recipient, nickname: 'Ah Gong' }
        updateRecipient.mockResolvedValue(saved)
        const wrapper = mountProfile()

        await openEditor(wrapper)
        expect(wrapper.find('#recipient-nickname').element.value).toBe('Grandpa')
        await wrapper.find('#recipient-nickname').setValue('Ah Gong')
        await submit(wrapper)

        expect(updateRecipient).toHaveBeenCalledWith('f1', 'r1', expect.objectContaining({ nickname: 'Ah Gong' }))
        expect(wrapper.emitted('updated')).toEqual([[saved]])
        expect(wrapper.findComponent(RecipientForm).exists()).toBe(false)

        await wrapper.setProps({ recipient: wrapper.emitted('updated')[0][0] }) // what the hub does
        expect(wrapper.text()).toContain('Ah Gong')
        expect(wrapper.text()).not.toContain('Grandpa')
    })

    it('Test2: cancelling or pressing Escape closes the editor without saving anything', async () => {
        const wrapper = mountProfile()

        await openEditor(wrapper)
        await wrapper.find('#recipient-nickname').setValue('Something else')
        await buttonByText(wrapper, 'Cancel').trigger('click')
        expect(wrapper.findComponent(RecipientForm).exists()).toBe(false)

        await openEditor(wrapper)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await flushPromises()
        expect(wrapper.findComponent(RecipientForm).exists()).toBe(false)

        expect(updateRecipient).not.toHaveBeenCalled()
        expect(wrapper.text()).toContain('Grandpa')
    })
})