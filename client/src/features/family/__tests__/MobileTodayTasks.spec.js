import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileTodayTasks from '../components/MobileTodayTasks.vue'

const openTask = { _id: 'task-one', title: 'Collect medicine', startAt: new Date(Date.now() + 86400000).toISOString(), status: 'open', recipient: { name: 'Grandpa' } }
const claimButton = wrapper => wrapper.findAll('button').find(button => button.text() === 'I’ll take it')

describe('Mobile today task list with its real child cards', () => {
  it('does not reserve a checkbox column for overdue tasks the user cannot delete', () => {
    const wrapper = mount(MobileTodayTasks, { props: { selectable: true, tasks: [{ ...openTask, startAt: new Date(0).toISOString(), deletionAllowed: false }] } })
    expect(wrapper.get('.mobile-task-selection-row').classes()).not.toContain('has-selection')
    expect(wrapper.find('input[type=checkbox]').exists()).toBe(false)
    expect(wrapper.get('article').text()).toContain('Collect medicine')
    wrapper.unmount()
  })
  it('reserves a checkbox column only for eligible overdue rows in a mixed list', () => {
    const wrapper = mount(MobileTodayTasks, { props: { selectable: true, tasks: [
      { ...openTask, _id: 'allowed', startAt: new Date(0).toISOString(), deletionAllowed: true },
      { ...openTask, _id: 'blocked', startAt: new Date(0).toISOString(), deletionAllowed: false },
      { ...openTask, _id: 'future', deletionAllowed: true },
    ] } })
    const rows = wrapper.findAll('.mobile-task-selection-row')
    expect(rows.map(row => row.classes().includes('has-selection'))).toEqual([true, false, false])
    expect(wrapper.findAll('input[type=checkbox]')).toHaveLength(1)
    wrapper.unmount()
  })
  it('closes claiming automatically when the scheduled start time arrives', async () => {
    vi.useFakeTimers()
    const startAt = new Date(Date.now() + 1000).toISOString()
    const wrapper = mount(MobileTodayTasks, { props: { tasks: [{ ...openTask, startAt }] } })
    expect(claimButton(wrapper)).toBeDefined()
    await vi.advanceTimersByTimeAsync(1000)
    expect(claimButton(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('Overdue · Claiming closed')
    expect(wrapper.emitted('claim')).toBeUndefined()
  })

  it('does not offer claiming for a task already overdue', () => {
    const wrapper = mount(MobileTodayTasks, { props: { tasks: [{ ...openTask, startAt: new Date(Date.now() - 1000).toISOString() }] } })
    expect(claimButton(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('Overdue · Claiming closed')
  })
  it('passes a claim from a child card to the page with the correct task', async () => {
    const wrapper = mount(MobileTodayTasks, { props: { tasks: [openTask] } })
    expect(wrapper.get('article').text()).toContain('Collect medicine')
    await claimButton(wrapper).trigger('click')
    expect(wrapper.emitted('claim')[0]).toEqual([openTask])
  })

  it('prevents a second claim while another task is being saved', () => {
    const wrapper = mount(MobileTodayTasks, { props: { tasks: [openTask], busyId: 'another-task' } })
    expect(claimButton(wrapper).element.disabled).toBe(true)
  })

  it('replaces the claim action with the saved claimer and status', async () => {
    const wrapper = mount(MobileTodayTasks, { props: { tasks: [openTask] } })
    await wrapper.setProps({ tasks: [{ ...openTask, status: 'claimed', claimedBy: { name: 'Alex Tan' } }] })
    expect(claimButton(wrapper)).toBeUndefined()
    expect(wrapper.get('article').text()).toContain('Alex Tan')
    expect(wrapper.get('article').text()).toContain('Claimed')
  })

  it('provides retry after a failed load and shows tasks after recovery', async () => {
    const wrapper = mount(MobileTodayTasks, { props: { error: 'Server unavailable' } })
    await wrapper.findAll('button').find(button => button.text() === 'Try again').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.setProps({ error: '', tasks: [openTask] })
    expect(wrapper.text()).not.toContain('Server unavailable')
    expect(wrapper.text()).toContain('Collect medicine')
  })
})
