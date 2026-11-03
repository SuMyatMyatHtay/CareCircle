// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import { requestPasswordReset, verifyResetCode, resetPassword } from '../services/authApi.js'

vi.mock('../services/authApi.js', () => ({ requestPasswordReset: vi.fn(), verifyResetCode: vi.fn(), resetPassword: vi.fn() }))
let router
const create = async (path = '/forgot-password') => {
  router = createRouter({ history: createMemoryHistory(), routes: ['/forgot-password', '/forgot-password/verify', '/forgot-password/new-password'].map(path => ({ path, component: ForgotPasswordView })) })
  await router.push(path)
  const mounted = mount({ template: '<RouterView />' }, { global: { plugins: [router], stubs: { AuthShell: { template: '<div><slot /></div>' }, RouterLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return mounted
}
let wrapper
afterEach(() => { wrapper?.unmount(); vi.resetAllMocks() })

describe('forgot password', () => {
  it('requests a code then resets the password without logging the user in', async () => {
    requestPasswordReset.mockResolvedValue({ success: true, message: 'Check your inbox.' })
    resetPassword.mockResolvedValue({ success: true, message: 'Password reset successfully.' })
    wrapper = await create()
    await wrapper.get('#reset-email').setValue('alex@example.com')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(requestPasswordReset).toHaveBeenCalledWith('alex@example.com')
    expect(wrapper.text()).toContain('Check your inbox.')
    expect(wrapper.findAll('button').find(button => button.text().startsWith('Resend')).element.disabled).toBe(true)
    await wrapper.get('#reset-code').setValue('012345')
    expect(wrapper.find('#new-password').exists()).toBe(false)
    verifyResetCode.mockResolvedValue({ resetToken: 'verified-token', message: 'Code verified.' })
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/forgot-password/new-password')
    await wrapper.get('#new-password').setValue('new-password-123')
    await wrapper.get('#confirm-new-password').setValue('new-password-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(resetPassword).toHaveBeenCalledWith('alex@example.com', 'verified-token', 'new-password-123', 'new-password-123')
    expect(wrapper.text()).toContain('Password updated')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('stays on the OTP page when verification fails and hides password fields', async () => {
    requestPasswordReset.mockResolvedValue({ message: 'Check your inbox.' })
    verifyResetCode.mockRejectedValue({ response: { data: { message: 'The code is invalid or expired.' } } })
    wrapper = await create()
    await wrapper.get('#reset-email').setValue('alex@example.com')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/forgot-password/verify')
    await wrapper.get('#reset-code').setValue('123456')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('invalid or expired')
    expect(wrapper.find('#new-password').exists()).toBe(false)
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('redirects direct visits to the password page back to email entry', async () => {
    wrapper = await create('/forgot-password/new-password')
    expect(router.currentRoute.value.path).toBe('/forgot-password')
    expect(wrapper.find('#new-password').exists()).toBe(false)
  })
})
