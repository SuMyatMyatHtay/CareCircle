import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MobileInviteCodeCard from '../components/MobileInviteCodeCard.vue'

let share, writeText
const render = (props = {}) => mount(MobileInviteCodeCard, {
  props: { code: 'AABBCCDDEE', isAdmin: true, ...props },
})
const copyButton = wrapper => wrapper.findAll('button')[0]
const regenerateButton = wrapper => wrapper.get('button[aria-label="Regenerate invite code"]')

beforeEach(() => {
  share = vi.fn().mockResolvedValue(undefined)
  writeText = vi.fn().mockResolvedValue(undefined)
  // Only browser sharing/clipboard APIs are doubled; the component is real.
  vi.stubGlobal('navigator', { share, clipboard: { writeText } })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Mobile invite code component contract', () => {
  it('renders the code prop and emits regenerate once when an admin clicks', async () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('AABBCCDDEE')
    await regenerateButton(wrapper).trigger('click')
    expect(wrapper.emitted('regenerate')).toEqual([[]])
  })

  test.each([
    { isAdmin: false, busy: false },
    { isAdmin: true, busy: true },
  ])('blocks regeneration with isAdmin=$isAdmin and busy=$busy', async props => {
    const wrapper = render(props)
    expect(regenerateButton(wrapper).element.disabled).toBe(true)
    await regenerateButton(wrapper).trigger('click')
    expect(wrapper.emitted('regenerate')).toBeUndefined()
  })

  it('disables copying until a code is available', async () => {
    const wrapper = render({ code: '' })
    expect(wrapper.text()).toContain('Unavailable')
    expect(copyButton(wrapper).element.disabled).toBe(true)
    await copyButton(wrapper).trigger('click')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the code like the desktop card, never opening the share sheet', async () => {
    vi.useFakeTimers()
    const wrapper = render()
    expect(copyButton(wrapper).text()).toBe('Copy code')
    await copyButton(wrapper).trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('AABBCCDDEE')
    expect(share).not.toHaveBeenCalled()
    expect(copyButton(wrapper).text()).toBe('Copied!')
    expect(wrapper.get('[role="status"]').text()).toContain('Invite code copied')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(copyButton(wrapper).text()).toBe('Copy code')
  })

  it('copies the current code after the parent updates its props', async () => {
    const wrapper = render()
    await wrapper.setProps({ code: '1122334455' })
    await copyButton(wrapper).trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('1122334455')
  })

  it('shows manual-copy instructions when clipboard permission is denied, and clears them on retry', async () => {
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    const wrapper = render()
    await copyButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Select and copy the code above')
    await copyButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('Invite code copied')
  })
})
