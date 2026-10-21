import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from '../../../App.vue'
import FamilySettingsView from '../views/FamilySettingsView.vue'
import FamilyHomeView from '../../family/views/FamilyHomeView.vue'
import FamilyMembersCard from '../components/FamilyMembersCard.vue'
import LanguagePreferencesCard from '../components/LanguagePreferencesCard.vue'
import AppearanceSettingsCard from '../components/AppearanceSettingsCard.vue'
import MobilePreferencesPanel from '../components/MobilePreferencesPanel.vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { http } from '../../../services/http.js'
import { queryKeys } from '../../../services/queryClient.js'

// Real views, panels, router and settings adapters collaborate. Only HTTP is
// doubled at this layer. The Playwright suite also runs against the real API/DB.
let wrapper, router, client, profile
const button = (component, label) => component.findAll('button').find(node => node.text().trim() === label)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(async () => {
  profile = { id: 'alex', name: 'Alex Tan', email: 'alex@example.test', phone: '', preferredLang: 'en', telegramUsername: '', isCaretaker: true }
  sessionStorage.setItem('token', 'component-test-only')
  sessionStorage.setItem('user', JSON.stringify(profile))
  const active = useActiveFamily()
  active.clearFamilies()
  active.families.value = [{ id: 'family-one', name: 'Tan family', inviteCode: 'AABBCCDDEE', members: [{ userId: 'alex', role: 'admin' }] }]
  active.selectFamily('family-one')
  const user = ref({ ...profile })
  const workspace = {
    ...active, user, isPreview: false,
    isAdmin: computed(() => true),
    refreshUser: () => { user.value = JSON.parse(sessionStorage.getItem('user')) },
    recipients: ref([]), recipientsLoading: ref(false), recipientsError: ref(''),
    loadRecipients: async () => {}, homePath: '/home', settingsPath: '/settings',
  }
  vi.spyOn(http, 'get').mockImplementation(async path => {
    if (path === '/auth/me') return { data: { user: { ...profile } } }
    if (path === '/families/family-one/members') return { data: { members: [
      { user: { _id: 'alex', name: 'Alex Tan', preferredLang: 'en' }, role: 'admin' },
      { user: { _id: 'jasmine', name: 'Jasmine', preferredLang: 'en' }, role: 'member' },
    ] } }
    throw new Error(`Unexpected request: ${path}`)
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(queryKeys.tasks('family-one'), [])
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/settings', component: FamilySettingsView },
    { path: '/home', component: FamilyHomeView },
  ] })
  await router.push('/settings')
  await router.isReady()
  wrapper = mount(App, { attachTo: document.body, global: {
    plugins: [router, [VueQueryPlugin, { queryClient: client }]],
    provide: { [Symbol.for('carecircle:family-workspace')]: workspace },
  } })
  await flushPromises()
  await button(wrapper.getComponent(AppearanceSettingsCard), 'Light').trigger('click')
})
afterEach(() => client?.clear())

describe('Settings panels and page integration', () => {
  it('keeps the selected desktop language and roster visible while saving', async () => {
    const request = deferred()
    vi.spyOn(http, 'patch').mockReturnValue(request.promise)
    const language = wrapper.getComponent(LanguagePreferencesCard)
    await button(language, '中文').trigger('click')
    await flushPromises()
    expect(button(language, '中文').attributes('aria-pressed')).toBe('true')
    expect(wrapper.getComponent(FamilyMembersCard).text()).toContain('Jasmine')
    expect(wrapper.getComponent(FamilyMembersCard).text()).not.toContain('Loading family members')
    request.resolve({ data: { user: { ...profile, preferredLang: 'zh' } } })
    await flushPromises()
    expect(wrapper.getComponent(FamilyMembersCard).text()).toContain('中文')
    expect(wrapper.text()).toContain('Your language preference has been saved.')
    expect(router.currentRoute.value.path).toBe('/settings')
  })

  it('keeps a mobile selection during saving and rolls back a failed save', async () => {
    const request = deferred()
    vi.spyOn(http, 'patch').mockReturnValue(request.promise)
    const select = wrapper.getComponent(MobilePreferencesPanel).get('select')
    await select.setValue('zh')
    await flushPromises()
    expect(select.element.value).toBe('zh')
    expect(wrapper.getComponent(FamilyMembersCard).text()).toContain('Alex Tan')
    request.reject(new Error('Unable to save right now'))
    await flushPromises()
    expect(select.element.value).toBe('en')
    expect(wrapper.text()).toContain('Unable to save right now')
    expect(wrapper.getComponent(FamilyMembersCard).text()).toContain('Jasmine')
  })

  it('shares a theme change from Settings with Home after navigation', async () => {
    await button(wrapper.getComponent(AppearanceSettingsCard), 'Dark').trigger('click')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.bsTheme).toBe('dark')
    expect(localStorage.getItem('carecircle:appearance')).toBe('dark')
    await router.push('/home')
    await flushPromises()
    expect(wrapper.getComponent(FamilyHomeView).text()).toContain('Alex')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
