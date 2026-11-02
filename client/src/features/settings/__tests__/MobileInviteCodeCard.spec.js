import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MobileInviteCodeCard from '../components/MobileInviteCodeCard.vue'

let share, writeText
const render = (props = {}) => mount(MobileInviteCodeCard, {
  props: { code: 'AABBCCDDEE', familyName: 'Tan family', isAdmin: true, ...props },
})
const shareButton = wrapper => wrapper.findAll('button')[0]
const regenerateButton = wrapper => wrapper.get('button[aria-label="Regenerate invite code"]')

beforeEach(() => {
  share = vi.fn().mockResolvedValue(undefined)
  writeText = vi.fn().mockResolvedValue(undefined)
  // Only browser sharing/clipboard APIs are doubled; the component is real.
  vi.stubGlobal('navigator', { share, clipboard: { writeText } })
})
afterEach(() => vi.unstubAllGlobals())

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

  it('disables sharing until a code is available', async () => {
    const wrapper = render({ code: '' })
    expect(wrapper.text()).toContain('Unavailable')
    expect(shareButton(wrapper).element.disabled).toBe(true)
    await shareButton(wrapper).trigger('click')
    expect(share).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('shares the current family and code after the parent updates its props', async () => {
    const wrapper = render()
    await wrapper.setProps({ familyName: 'Lee family', code: '1122334455' })
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(share).toHaveBeenCalledWith({
      title: 'Lee family on CareCircle',
      text: 'Join Lee family on CareCircle. Invite code: 1122334455',
    })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('prevents a second share while the native share sheet is pending', async () => {
    let finish
    share.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = render()
    await shareButton(wrapper).trigger('click')
    expect(shareButton(wrapper).element.disabled).toBe(true)
    expect(shareButton(wrapper).text()).toBe('Sharing…')
    await shareButton(wrapper).trigger('click')
    expect(share).toHaveBeenCalledTimes(1)
    finish()
    await flushPromises()
    expect(shareButton(wrapper).element.disabled).toBe(false)
  })

  it('treats cancelling the native share sheet as a normal action', async () => {
    share.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
    const wrapper = render()
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(shareButton(wrapper).element.disabled).toBe(false)
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(share).toHaveBeenCalledTimes(2)
  })

  it('shows manual-copy instructions after a failure and clears them on retry', async () => {
    share.mockRejectedValueOnce(new Error('Share unavailable'))
    const wrapper = render()
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Select and copy the code above')
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(share).toHaveBeenCalledTimes(2)
  })

  it('falls back to the clipboard and clears its temporary success feedback', async () => {
    vi.useFakeTimers()
    navigator.share = undefined
    const wrapper = render()
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('AABBCCDDEE')
    expect(wrapper.get('[role="status"]').text()).toContain('Invite code copied')
    expect(shareButton(wrapper).text()).toBe('Copied!')
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(shareButton(wrapper).text()).toBe('Share')
  })

  it('copies a preview code without opening the device share sheet', async () => {
    const wrapper = render({ preview: true })
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('AABBCCDDEE')
  })

  it('recovers when clipboard permission is denied', async () => {
    navigator.share = undefined
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    const wrapper = render()
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Select and copy')
    await shareButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('Invite code copied')
  })
})
