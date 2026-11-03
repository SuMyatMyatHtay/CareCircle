import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { createRecipient, updateRecipient } = vi.hoisted(() => ({
    createRecipient: vi.fn(),
    updateRecipient: vi.fn()
}))

vi.mock('../services/recipientsApi.js', () => ({
    createRecipient,
    updateRecipient,
    getRecipientErrorMessage: (error) => error.response?.data?.error || error.message || 'Something went wrong.'
}))

vi.mock('../../../composables/useActiveFamily.js', async () => {
    const { ref } = await import('vue')
    return { useActiveFamily: () => ({ selectedFamilyId: ref('fam1') }) }
})

vi.mock('../../../components/common/ProfilePicturePicker.vue', async () => {
    const { h } = await import('vue')
    return {
        default: {
            name: 'ProfilePicturePicker',
            props: ['modelValue', 'careType', 'disabled'],
            render() {
                return h('div', { class: 'picker-stub' })
            }
        }
    }
})

import RecipientForm from '../components/RecipientForm.vue'

// ---------- helpers ----------
const mountForm = (props = {}) => mount(RecipientForm, { props })
const buttonByText = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text)
const byLabel = (wrapper, label) => wrapper.find(`[aria-label="${label}"]`)

async function fillBasics(wrapper, { name = 'Lim Siew Lan', careType = 'Elderly' } = {}) {
    if (name !== null) await wrapper.find('#recipient-name').setValue(name)
    if (careType) await buttonByText(wrapper, careType).trigger('click')
}

async function submit(wrapper) {
    await wrapper.find('form').trigger('submit')
    await flushPromises()
}

const createdPayload = () => createRecipient.mock.calls[0][1]
const updatedPayload = () => updateRecipient.mock.calls[0][2]

const existing = {
    _id: 'r1',
    name: 'Tan Ah Kow',
    nickname: 'Grandpa',
    dateOfBirth: '1944-03-02T00:00:00.000Z',
    careType: 'elderly',
    mobility: { level: 'assisted', notes: 'walking stick' },
    allergies: [{ name: 'Penicillin', severity: 'severe' }],
    conditions: ['Hypertension'],
    dietaryRestrictions: ['Low sodium'],
    medications: [{
        name: 'Aspirin', dosage: '100mg', frequency: 'daily',
        startDate: '2025-01-01', notes: 'with food'
    }],
    emergencyContacts: [{ name: 'Mei', relationship: 'Daughter', phone: '+65 9123 4567' }],
    preferredClinic: { name: 'AMK Polyclinic', address: '21 AMK Central 2', postal: '569666' },
    careNotes: 'Likes tea',
    linkedUser: null
}

beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    sessionStorage.setItem('user', JSON.stringify({ id: 'u1' }))
    createRecipient.mockResolvedValue({ _id: 'new', name: 'Lim Siew Lan' })
    updateRecipient.mockResolvedValue({ ...existing, nickname: 'Updated' })
})

// ---------- validation and saving ----------
describe('TestSuite: RecipientForm saving', () => {
    it('Test1: needs a name and a care type, and only saves once both are given', async () => {
        const wrapper = mountForm()
        await submit(wrapper)
        expect(wrapper.find('[role="alert"]').text()).toContain('Full name is required.')
        expect(wrapper.find('[role="alert"]').text()).toContain('Choose a care type.')

        await fillBasics(wrapper, { name: '   ', careType: 'Elderly' }) // spaces only still count as empty
        await submit(wrapper)
        expect(wrapper.find('[role="alert"]').text()).toContain('Full name is required.')
        expect(createRecipient).not.toHaveBeenCalled()

        await fillBasics(wrapper, { careType: null })
        await submit(wrapper)
        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
        expect(createRecipient).toHaveBeenCalledTimes(1)
    })

    it('Test2: creating sends clean defaults and emits the saved recipient', async () => {
        const wrapper = mountForm()
        await fillBasics(wrapper)
        await submit(wrapper)

        expect(createRecipient.mock.calls[0][0]).toBe('fam1')
        expect(createdPayload()).toEqual({
            profilePicture: '', name: 'Lim Siew Lan', nickname: '', careType: 'elderly',
            dateOfBirth: null, mobility: null, allergies: [], conditions: [], dietaryRestrictions: [],
            medications: [], emergencyContacts: [], preferredClinic: null, careNotes: '', linkedUser: null
        })
        expect(wrapper.emitted('saved')[0][0]).toEqual({ _id: 'new', name: 'Lim Siew Lan' })
    })

    it('Test3: editing prefills the form, updates (not creates), and keeps fields the form does not show', async () => {
        const wrapper = mountForm({ recipient: existing })
        expect(wrapper.find('#recipient-name').element.value).toBe('Tan Ah Kow')
        expect(wrapper.find('#recipient-dob').element.value).toBe('1944-03-02')
        expect(wrapper.text()).toContain('Penicillin')

        await wrapper.find('#recipient-clinic').setValue('Yishun Polyclinic')
        await submit(wrapper)

        expect(updateRecipient.mock.calls[0].slice(0, 2)).toEqual(['fam1', 'r1'])
        expect(createRecipient).not.toHaveBeenCalled()
        // medication startDate/notes and clinic postal are not editable here, but must not be wiped
        expect(updatedPayload().medications[0]).toMatchObject({ startDate: '2025-01-01', notes: 'with food' })
        expect(updatedPayload().preferredClinic).toEqual({
            name: 'Yishun Polyclinic', address: '21 AMK Central 2', postal: '569666'
        })
    })

    it('Test4: blocks double-submits while saving', async () => {
        let finish
        createRecipient.mockReturnValue(new Promise((resolve) => { finish = resolve }))
        const wrapper = mountForm()
        await fillBasics(wrapper)
        await wrapper.find('form').trigger('submit')

        expect(wrapper.find('button[type="submit"]').text()).toContain('Saving...')
        expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

        finish({ _id: 'new' })
        await flushPromises()
        expect(wrapper.find('button[type="submit"]').text()).toBe('Save recipient')
    })

    it('Test5: a failed save shows the server message, re-enables the button and emits nothing', async () => {
        createRecipient.mockRejectedValue({ response: { data: { error: 'Family not found.' } } })
        const wrapper = mountForm()
        await fillBasics(wrapper)
        await submit(wrapper)

        expect(wrapper.find('[role="alert"]').text()).toContain('Family not found.')
        expect(wrapper.emitted('saved')).toBeUndefined()
        expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    })

    it('Test6: Cancel emits cancel, saves nothing and never changes the original recipient', async () => {
        const recipient = JSON.parse(JSON.stringify(existing))
        const wrapper = mountForm({ recipient })
        await byLabel(wrapper, 'New condition').setValue('Diabetes')
        await byLabel(wrapper, 'New condition').trigger('keydown.enter')
        await buttonByText(wrapper, 'Cancel').trigger('click')

        expect(wrapper.emitted('cancel')).toHaveLength(1)
        expect(updateRecipient).not.toHaveBeenCalled()
        expect(recipient.conditions).toEqual(['Hypertension'])
    })
})

// ---------- details ----------
describe('TestSuite: RecipientForm details', () => {
    it('Test1: allergies, conditions and diet can be added and removed; blanks and duplicates are ignored', async () => {
        const wrapper = mountForm({ recipient: existing })
        const allergy = byLabel(wrapper, 'New allergy')
        await allergy.setValue('Dust')
        await byLabel(wrapper, 'Severity').setValue('severe')
        await allergy.trigger('keydown.enter')
        await allergy.setValue('   ')
        await allergy.trigger('keydown.enter')

        const condition = byLabel(wrapper, 'New condition')
        await condition.setValue('Hypertension') // duplicate
        await condition.trigger('keydown.enter')
        await condition.setValue('  Diabetes ')
        await condition.trigger('keydown.enter')

        await byLabel(wrapper, 'Remove Penicillin').trigger('click')
        await submit(wrapper)

        expect(updatedPayload().allergies).toEqual([{ name: 'Dust', severity: 'severe' }])
        expect(updatedPayload().conditions).toEqual(['Hypertension', 'Diabetes'])
        expect(createRecipient).not.toHaveBeenCalled()
    })

    it('Test2: mobility level can be picked and un-picked, and notes can be sent alone', async () => {
        const wrapper = mountForm()
        await fillBasics(wrapper)
        const chip = buttonByText(wrapper, 'Assisted')
        await chip.trigger('click')
        await chip.trigger('click')
        expect(chip.attributes('aria-pressed')).toBe('false')
        await submit(wrapper)
        expect(createdPayload().mobility).toBeNull()

        createRecipient.mockClear()
        await buttonByText(wrapper, 'Wheelchair').trigger('click')
        await byLabel(wrapper, 'Mobility notes').setValue('Needs a ramp')
        await submit(wrapper)
        expect(createdPayload().mobility).toEqual({ level: 'wheelchair', notes: 'Needs a ramp' })
    })

    it('Test3: blank medication and contact rows are dropped, and a cleared clinic becomes null', async () => {
        const wrapper = mountForm()
        await fillBasics(wrapper)
        await buttonByText(wrapper, 'Add medication').trigger('click')
        await buttonByText(wrapper, 'Add medication').trigger('click')
        await wrapper.findAll('[aria-label="Medication name"]')[0].setValue('Metformin')
        await wrapper.findAll('[aria-label="Dosage"]')[1].setValue('orphan dosage') // no name, so dropped

        await buttonByText(wrapper, 'Add contact').trigger('click')
        await buttonByText(wrapper, 'Add contact').trigger('click')
        await wrapper.findAll('[aria-label="Phone"]')[0].setValue('+65 9123 4567') // phone alone is enough
        await submit(wrapper)

        expect(createdPayload().medications).toEqual([
            { name: 'Metformin', dosage: '', frequency: '', startDate: null, notes: '' }
        ])
        expect(createdPayload().emergencyContacts).toEqual([{ name: '', relationship: '', phone: '+65 9123 4567' }])
        expect(createdPayload().preferredClinic).toBeNull()
    })
})

// ---------- linked account ----------
describe('TestSuite: RecipientForm linked account', () => {
    it('Test1: "This is me" links the current user, but an infant is never linked', async () => {
        const wrapper = mountForm()
        await fillBasics(wrapper, { careType: 'Elderly' })
        await wrapper.find('#recipient-link-me').setValue(true)
        await submit(wrapper)
        expect(createdPayload().linkedUser).toBe('u1')

        createRecipient.mockClear()
        await buttonByText(wrapper, 'Infant').trigger('click')
        expect(wrapper.text()).not.toContain('Linked account')
        await submit(wrapper)
        expect(createdPayload().linkedUser).toBeNull()
    })

    it('Test2: a link to someone else is kept unless the user clicks Unlink', async () => {
        const linked = { ...existing, linkedUser: { _id: 'u2', name: 'Mei Lim' } }

        const kept = mountForm({ recipient: linked })
        expect(kept.text()).toContain("Linked to Mei Lim's account")
        await submit(kept)
        expect(updatedPayload().linkedUser).toBe('u2')

        updateRecipient.mockClear()
        const unlinked = mountForm({ recipient: linked })
        await buttonByText(unlinked, 'Unlink').trigger('click')
        await submit(unlinked)
        expect(updatedPayload().linkedUser).toBeNull()
    })
})