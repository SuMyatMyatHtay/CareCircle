import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('../../../composables/useRecipients.js', () => ({
    useRecipients: () => ({ refresh })
}))

vi.mock('../components/RecipientForm.vue', async () => {
    const { h } = await import('vue')
    return {
        default: {
            name: 'RecipientForm',
            props: ['recipient'],
            emits: ['saved', 'cancel'],
            render() {
                return h('div', { class: 'form-stub' })
            }
        }
    }
})

import RecipientFormModal from '../components/RecipientFormModal.vue'

const recipient = { _id: 'r1', name: 'Tan Ah Kow' }

const pressKey = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
const formOf = (wrapper) => wrapper.findComponent({ name: 'RecipientForm' })

beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
})

describe('TestSuite: RecipientFormModal', () => {
    it('Test1: titles itself for adding or editing and gives the form the recipient', () => {
        expect(mount(RecipientFormModal).find('h2').text()).toBe('Add care recipient')

        const wrapper = mount(RecipientFormModal, { props: { recipient } })
        expect(wrapper.find('h2').text()).toBe('Edit care recipient')
        expect(formOf(wrapper).props('recipient')).toEqual(recipient)
    })

    it('Test2: a saved recipient refreshes the list, emits updated, then closes', () => {
        const wrapper = mount(RecipientFormModal, { props: { recipient } })
        const saved = { _id: 'r1', name: 'Updated' }
        formOf(wrapper).vm.$emit('saved', saved)

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(wrapper.emitted('updated')).toEqual([[saved]])
        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('Test3: Cancel in the form closes without refreshing', () => {
        const wrapper = mount(RecipientFormModal)
        formOf(wrapper).vm.$emit('cancel')

        expect(wrapper.emitted('close')).toHaveLength(1)
        expect(refresh).not.toHaveBeenCalled()
    })

    it('Test4: X, Escape and the backdrop close it, but clicking inside the panel or other keys do not', async () => {
        const wrapper = mount(RecipientFormModal)
        await wrapper.find('.modal-panel').trigger('click')
        pressKey('Enter')
        expect(wrapper.emitted('close')).toBeUndefined()

        await wrapper.find('[aria-label="Close"]').trigger('click')
        pressKey('Escape')
        await wrapper.find('.modal-overlay').trigger('click')
        expect(wrapper.emitted('close')).toHaveLength(3)
    })

    it('Test5: locks page scrolling while open, and cleans up after itself when removed', () => {
        const wrapper = mount(RecipientFormModal)
        expect(document.body.style.overflow).toBe('hidden')

        wrapper.unmount()
        expect(document.body.style.overflow).toBe('')
        pressKey('Escape')
        expect(wrapper.emitted('close')).toBeUndefined()
    })
})