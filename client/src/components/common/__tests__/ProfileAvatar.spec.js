import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProfileAvatar from '../ProfileAvatar.vue'

async function avatar(props, preview = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/home', component: { template: '<div />' }, meta: { preview } },
    { path: '/profile', component: { template: '<div />' } },
    { path: '/profile/:userId', component: { template: '<div />' } },
    { path: '/recipients/:recipientId/profile', component: { template: '<div />' } },
  ] })
  await router.push('/home')
  const wrapper = mount(ProfileAvatar, { props, global: { plugins: [router] } })
  return { wrapper, router }
}
describe('Avatar profile links', () => {
  it('opens the correct member profile when clicked', async () => {
    const { wrapper, router } = await avatar({ person: { _id: 'jasmine', name: 'Jasmine' } })
    expect(wrapper.get('a').attributes('aria-label')).toBe("View Jasmine's profile")
    await wrapper.get('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/profile/jasmine')
  })
  it('opens my own profile for my avatar', async () => {
    sessionStorage.setItem('user', JSON.stringify({ id: 'alex' }))
    const { wrapper } = await avatar({ person: { id: 'alex', name: 'Alex' } })
    expect(wrapper.get('a').attributes('href')).toBe('/profile')
  })
  it('uses linked account identity instead of the recipient record id', async () => {
    const { wrapper } = await avatar({ recipient: true, person: { _id: 'recipient-one', linkedUser: { _id: 'jasmine' }, name: 'Jasmine' } })
    expect(wrapper.get('a').attributes('href')).toBe('/profile/jasmine')
  })
  it('opens a care profile when the recipient has no account', async () => {
    const { wrapper } = await avatar({ recipient: true, person: { _id: 'grandpa', name: 'Grandpa' } })
    expect(wrapper.get('a').attributes('href')).toBe('/recipients/grandpa/profile')
  })
  it('does not invent links for unidentified people or preview accounts', async () => {
    const unknown = await avatar({ person: { name: 'Family' } })
    expect(unknown.wrapper.find('a').exists()).toBe(false)
    const preview = await avatar({ person: { _id: 'sample', name: 'Sample' } }, true)
    expect(preview.wrapper.find('a').exists()).toBe(false)
  })
})
