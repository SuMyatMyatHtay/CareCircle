import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import TaskRepeatFields from '../components/new-task/TaskRepeatFields.vue'
import RecurringClaimDialog from '../components/RecurringClaimDialog.vue'
import RecurringTaskEditModal from '../components/RecurringTaskEditModal.vue'
import { askRecurringClaim, closeRecurringClaim, recurringClaim } from '../composables/recurringClaimDialog.js'

const mocks = vi.hoisted(() => ({ editTask: vi.fn(), invalidateQueries: vi.fn(), cancelQueries: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ fullPath: '/home' }) }))
vi.mock('@tanstack/vue-query', async original => ({ ...await original(), useQueryClient: () => mocks }))
vi.mock('../services/tasksApi.js', () => ({ editTask: mocks.editTask, getTaskErrorMessage: err => err.message }))
const workspace = { selectedFamilyId: ref('family') }
const options = { global: { provide: { [Symbol.for('carecircle:family-workspace')]: workspace } } }
const button = (wrapper, text) => wrapper.findAll('button').find(b => b.text() === text)
const task = { _id: 'task', title: 'Therapy', recurringSeries: 'series', startAt: '2026-11-03T06:30:00.000Z', endAt: '2026-11-03T07:30:00.000Z', updatedAt: '2026-11-01T01:00:00.000Z' }
afterEach(() => { closeRecurringClaim(); vi.clearAllMocks() })

describe('recurring task controls', () => {
  it('explains the selected monthly date before a time is entered and updates when it changes', async () => {
    const Host = defineComponent({ components: { TaskRepeatFields }, setup: () => ({ date: ref('2026-10-29'), rule: ref({ frequency: 'none', interval: 1, end: { mode: 'never' } }) }), template: '<TaskRepeatFields v-model="rule" :date="date" />' })
    const wrapper = mount(Host)
    await button(wrapper, 'Every month').trigger('click')
    expect(wrapper.text()).toContain('On the 29th of every month')
    expect(wrapper.text()).toContain('29 October 2026')
    expect(wrapper.text()).toContain('Months without a 29th are skipped')
    wrapper.vm.date = '2026-10-15'; await nextTick()
    expect(wrapper.text()).toContain('On the 15th of every month')
    expect(wrapper.text()).not.toContain('Months without a 29th')
    wrapper.unmount()
  })
  it('offers a weekly schedule with selectable weekdays and end count', async () => {
    const Host = defineComponent({ components: { TaskRepeatFields }, setup: () => ({ rule: ref({ frequency: 'none', end: { mode: 'never' } }) }), template: '<TaskRepeatFields v-model="rule" date="2026-11-03" />' })
    const wrapper = mount(Host)
    await button(wrapper, 'Every 2 weeks').trigger('click')
    await wrapper.get('[aria-label="Fri"]').trigger('click')
    await button(wrapper, 'After a number of times').trigger('click')
    await wrapper.get('input[type=number]').setValue(14)
    expect(wrapper.vm.rule).toMatchObject({ frequency: 'weekly', interval: 2, weekdays: [1, 4], end: { mode: 'after', count: 14 } })
    wrapper.unmount()
  })
  it('defaults to the whole series and resolves only on confirmation', async () => {
    const wrapper = mount(RecurringClaimDialog, options)
    const pending = askRecurringClaim(task); await nextTick()
    expect(wrapper.get('input[value=series]').element.checked).toBe(true)
    await button(wrapper, "I'll take it").trigger('click')
    expect(await pending).toBe('series')
    expect(recurringClaim.value).toBe(null)
    wrapper.unmount()
  })
  it('lets members choose next four, cancel, or claim an exception for one date only', async () => {
    const wrapper = mount(RecurringClaimDialog, options)
    let pending = askRecurringClaim(task); await nextTick()
    await wrapper.get('input[value=next4]').setValue()
    await button(wrapper, "I'll take it").trigger('click')
    expect(await pending).toBe('next4')
    pending = askRecurringClaim(task); await nextTick()
    await button(wrapper, 'Not now').trigger('click'); expect(await pending).toBe(null)
    expect(await askRecurringClaim({ ...task, recurrenceDetached: true })).toBe('one')
    expect(recurringClaim.value).toBe(null)
    wrapper.unmount()
  })
  it('dismisses a pending claim on family switch', async () => {
    const wrapper = mount(RecurringClaimDialog, options)
    const pending = askRecurringClaim(task); await nextTick()
    workspace.selectedFamilyId.value = 'other'; await nextTick()
    expect(await pending).toBe(null)
    workspace.selectedFamilyId.value = 'family'; wrapper.unmount()
  })
  it('submits scoped edits with Singapore times and optimistic version protection', async () => {
    mocks.editTask.mockResolvedValue({ ...task, title: 'Physiotherapy' })
    const wrapper = mount(RecurringTaskEditModal, { props: { task, familyId: 'family' } })
    await wrapper.get('input[maxlength="120"]').setValue('Physiotherapy')
    await wrapper.get('input[type=datetime-local]').setValue('2026-11-03T15:00')
    await wrapper.get('input[value=future]').setValue()
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(mocks.editTask).toHaveBeenCalledWith('family', 'task', expect.objectContaining({ title: 'Physiotherapy', scope: 'future', startAt: '2026-11-03T07:00:00.000Z', expectedUpdatedAt: task.updatedAt }))
    expect(mocks.editTask.mock.calls[0][2]).not.toHaveProperty('endAt')
    expect(wrapper.emitted('saved')).toHaveLength(1)
    wrapper.unmount()
  })
  it('restricts exception editing to one date and displays save errors', async () => {
    mocks.editTask.mockRejectedValue(new Error('Only the creator can edit'))
    const wrapper = mount(RecurringTaskEditModal, { props: { task: { ...task, recurrenceDetached: true }, familyId: 'family' } })
    expect(wrapper.findAll('input[type=radio]')).toHaveLength(1)
    await wrapper.get('input[maxlength="120"]').setValue('Change')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toBe('Only the creator can edit')
    expect(wrapper.emitted('saved')).toBeUndefined()
    wrapper.unmount()
  })
})
