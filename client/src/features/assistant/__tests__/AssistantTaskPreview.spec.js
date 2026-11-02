// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AssistantTaskPreview from '../components/AssistantTaskPreview.vue'

const proposal = { action: 'create', task: { title: 'Eye check', location: { name: 'Eye Centre', address: '123 Clinic Road' } }, changes: {} }
const button = (wrapper, text) => wrapper.findAll('button').find(item => item.text() === text)

describe('new task location review', () => {
  it('blocks confirmation while editing and requests a revised proposal without saving', async () => {
    const wrapper = mount(AssistantTaskPreview, { props: { proposal } })
    await button(wrapper, 'Change location').trigger('click')
    expect(wrapper.find('input').element.value).toBe('Eye Centre, 123 Clinic Road')
    expect(button(wrapper, 'Confirm task').attributes('disabled')).toBeDefined()
    await wrapper.find('input').setValue('456 New Clinic Road')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('change-location')).toEqual([['456 New Clinic Road']])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('can cancel an edit and explicitly approve the existing location', async () => {
    const wrapper = mount(AssistantTaskPreview, { props: { proposal } })
    await button(wrapper, 'Change location').trigger('click')
    await wrapper.find('input').setValue('Another place')
    await button(wrapper, 'Cancel edit').trigger('click')
    expect(wrapper.emitted('change-location')).toBeUndefined()
    await button(wrapper, 'Confirm task').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('hides location editing after a task is saved', () => {
    const wrapper = mount(AssistantTaskPreview, { props: { proposal, state: 'saved' } })
    expect(button(wrapper, 'Change location')).toBeUndefined()
  })
})
