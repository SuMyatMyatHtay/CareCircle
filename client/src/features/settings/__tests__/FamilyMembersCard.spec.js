import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FamilyMembersCard from '../components/FamilyMembersCard.vue'

const member = (id, name, role) => ({ user: { _id: id, name, email: `${id}@example.test`, preferredLang: 'en' }, role })
const alex = member('alex', 'Alex Tan', 'admin')
const jasmine = member('jasmine', 'Jasmine', 'admin')
function render(members = [alex, jasmine], extra = {}) {
  return mount(FamilyMembersCard, { attachTo: document.body, props: { members, userId: 'alex', isAdmin: true, ...extra } })
}
const action = (wrapper, text) => wrapper.findAll('button').find(button => button.text() === text)

describe('Family member management', () => {
  it('offers admins a role action and emits the selected member and new role', async () => {
    const wrapper = render()
    await wrapper.get('button[aria-label="Manage Jasmine"]').trigger('click')
    await action(wrapper, 'Change to member').trigger('click')
    expect(wrapper.emitted('change-role')[0]).toEqual([jasmine, 'member'])
    expect(wrapper.text()).not.toContain('Change to member')
  })

  it('closes the menu when the user clicks elsewhere on the page', async () => {
    const wrapper = render()
    const toggle = wrapper.get('button[aria-label="Manage Jasmine"]')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('Change to member')
  })

  it('closes on Escape and returns focus to the menu button', async () => {
    const wrapper = render()
    const toggle = wrapper.get('button[aria-label="Manage Jasmine"]')
    await toggle.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle.element)
  })

  it('prevents the last admin from being demoted or removed', async () => {
    const wrapper = render([alex, member('may', 'Aunt May', 'member')])
    await wrapper.get('button[aria-label="Manage Alex Tan"]').trigger('click')
    expect(action(wrapper, 'Change to member').element.disabled).toBe(true)
    expect(action(wrapper, 'Leave family').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('At least one admin must stay.')
  })

  it('does not expose admin controls to an ordinary member', () => {
    const wrapper = render([alex, jasmine], { isAdmin: false })
    expect(wrapper.findAll('button[aria-label^="Manage"]')).toHaveLength(0)
    expect(action(wrapper, 'Invite member').element.disabled).toBe(true)
  })

  it('renders an error with a retry action instead of an empty list', async () => {
    const wrapper = render([], { error: 'Unable to load members' })
    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to load members')
    await action(wrapper, 'Try again').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
