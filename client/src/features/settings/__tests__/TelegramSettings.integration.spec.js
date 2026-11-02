import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import TelegramSettingsCard from '../components/TelegramSettingsCard.vue'
import NotificationToggle from '../components/NotificationToggle.vue'
import { http } from '../../../services/http.js'

// Keep the card, child switches, composable and HTTP adapter real. Only HTTP
// transport is doubled, so this checks their integration without sending Telegram.
let workspace, settings
const path = '/families/one/notify-settings'
const eventLabels = ['A task is posted', 'Someone claims or gives back a task', 'A transit milestone is marked', 'A note or medication change is added', 'A task is completed']
const switchFor = (wrapper, label) => wrapper.get(`input[aria-label="${label}"]`)
const button = (wrapper, label) => wrapper.findAll('button').find(node => node.text().trim() === label)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function render(props = {}) {
  const wrapper = mount(TelegramSettingsCard, {
    props: {
      inviteCode: 'AABBCCDDEE',
      // Local preview defaults deliberately differ from saved live settings.
      preferences: { taskPosted: true, taskClaimed: true, transitMilestone: true, careNote: true, taskCompleted: true },
      ...props,
    },
    global: { provide: { [Symbol.for('carecircle:family-workspace')]: workspace } },
  })
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  sessionStorage.setItem('token', 'component-test-only')
  workspace = { selectedFamilyId: ref('one'), isAdmin: ref(true) }
  settings = {
    notifyOn: [], reminders: { beforeTask: false, unclaimedTask: true, dailySummary: false },
    telegram: { linked: true, linkedAt: '2026-10-01T00:00:00Z', linkedBy: { name: 'Alex Tan' } },
  }
  vi.spyOn(http, 'get').mockImplementation(async url => {
    if (!url.endsWith('/notify-settings')) throw new Error(`Unexpected GET ${url}`)
    return { data: settings }
  })
})

describe('Telegram card, switches and settings adapter', () => {
  it('renders server preferences through real child props instead of preview defaults', async () => {
    const wrapper = await render()
    expect(wrapper.findAllComponents(NotificationToggle)).toHaveLength(8)
    for (const label of eventLabels) expect(switchFor(wrapper, label).element.checked).toBe(false)
    expect(switchFor(wrapper, 'Alert the group if a task is still unclaimed 24 hours before').element.checked).toBe(true)
    expect(wrapper.text()).toContain('linked by Alex Tan')
  })

  it('optimistically updates a child switch, saves its full event group and blocks extra writes', async () => {
    const request = deferred()
    const save = vi.spyOn(http, 'patch').mockReturnValue(request.promise)
    const wrapper = await render()
    await switchFor(wrapper, 'A task is posted').setValue(true)
    expect(switchFor(wrapper, 'A task is posted').element.checked).toBe(true)
    expect(save).toHaveBeenCalledWith(path, {
      notifyOn: ['task.created', 'task.updated', 'task.deleted'],
    }, expect.objectContaining({ headers: { Authorization: 'Bearer component-test-only' } }))
    for (const input of wrapper.findAll('input[role="switch"]')) expect(input.element.disabled).toBe(true)
    await switchFor(wrapper, 'A task is completed').setValue(false)
    expect(save).toHaveBeenCalledTimes(1)
    request.resolve({ data: { notifyOn: ['task.created', 'task.updated', 'task.deleted'] } })
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('Telegram preferences saved.')
    expect(switchFor(wrapper, 'A task is posted').element.disabled).toBe(false)
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('rolls a failed save back and allows retry without reloading the roster or page', async () => {
    const request = deferred()
    const save = vi.spyOn(http, 'patch').mockReturnValueOnce(request.promise)
      .mockResolvedValue({ data: { notifyOn: ['task.created', 'task.updated', 'task.deleted'] } })
    const wrapper = await render()
    await switchFor(wrapper, 'A task is posted').setValue(true)
    request.reject(new Error('Network disconnected'))
    await flushPromises()
    expect(switchFor(wrapper, 'A task is posted').element.checked).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Network disconnected')
    await switchFor(wrapper, 'A task is posted').setValue(true)
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(switchFor(wrapper, 'A task is posted').element.checked).toBe(true)
  })

  it('saves a reminder separately and renders the returned flags', async () => {
    const save = vi.spyOn(http, 'patch').mockResolvedValue({ data: {
      reminders: { beforeTask: false, unclaimedTask: true, dailySummary: true },
    } })
    const wrapper = await render()
    await switchFor(wrapper, 'Daily summary at 8am').setValue(true)
    await flushPromises()
    expect(save).toHaveBeenCalledWith(path, { reminders: { dailySummary: true } }, expect.any(Object))
    expect(switchFor(wrapper, 'Daily summary at 8am').element.checked).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toBe('Reminder preferences saved.')
  })

  it('disables all editing for a non-admin and hides test/unlink actions', async () => {
    workspace.isAdmin.value = false
    const wrapper = await render()
    for (const input of wrapper.findAll('input[role="switch"]')) expect(input.element.disabled).toBe(true)
    expect(button(wrapper, 'Send test message')).toBeUndefined()
    expect(button(wrapper, 'Unlink group')).toBeUndefined()
  })

  it('does not let an old family response replace the newly selected family settings', async () => {
    const old = deferred()
    http.get.mockReturnValueOnce(old.promise).mockResolvedValue({ data: {
      notifyOn: ['task.claimed', 'task.unclaimed'], reminders: {}, telegram: { linked: false },
    } })
    const wrapper = await render()
    workspace.selectedFamilyId.value = 'two'
    await flushPromises()
    expect(switchFor(wrapper, 'Someone claims or gives back a task').element.checked).toBe(true)
    old.resolve({ data: settings })
    await flushPromises()
    expect(switchFor(wrapper, 'Someone claims or gives back a task').element.checked).toBe(true)
    expect(wrapper.text()).toContain('No Telegram group is linked yet.')
    expect(wrapper.text()).not.toContain('linked by Alex Tan')
  })

  it('cancels unlinking, then unlinks after confirmation through the real adapter', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const unlink = vi.spyOn(http, 'delete').mockResolvedValue({ status: 204 })
    const wrapper = await render()
    await button(wrapper, 'Unlink group').trigger('click')
    expect(unlink).not.toHaveBeenCalled()
    await button(wrapper, 'Unlink group').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(unlink).toHaveBeenCalledWith(`${path}/telegram`, expect.any(Object))
    expect(wrapper.get('[role="status"]').text()).toBe('Telegram group unlinked.')
    expect(button(wrapper, 'Unlink group')).toBeUndefined()
  })

  it('emits preview changes without requesting or writing real family settings', async () => {
    const save = vi.spyOn(http, 'patch')
    const wrapper = await render({ preview: true })
    await switchFor(wrapper, 'A task is posted').setValue(false)
    expect(wrapper.emitted('change')).toEqual([['taskPosted', false]])
    expect(http.get).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
})
