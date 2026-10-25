import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileTodayTasks from '../components/MobileTodayTasks.vue'

const openTask = { _id: 'task-one', title: 'Collect medicine', startAt: '2026-10-21T06:00:00Z', status: 'open', recipient: { name: 'Grandpa' } }
const claimButton = wrapper => wrapper.findAll('button').find(button => button.text() === 'I’ll take it')

describe('Mobile today task list with its real child cards', () => {
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
