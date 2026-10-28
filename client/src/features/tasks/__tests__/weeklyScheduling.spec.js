import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { useTaskForm } from '../composables/useTaskForm.js'
import TaskWhenFields from '../components/new-task/TaskWhenFields.vue'
import { recurrenceDates, parseRecurrence, generationHorizon } from '../../../../../shared/recurrence.js'

vi.mock('../../../composables/useFamilyTasks.js', () => ({ useTaskCache: () => ({ upsertTask: vi.fn() }) }))
afterEach(() => vi.useRealTimers())
function setup(options = {}) {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T02:00:00Z'))
  const save = vi.fn(async payload => payload)
  const Host = defineComponent({ components: { TaskWhenFields }, setup() { return { form: useTaskForm({ ...options, save }) } }, template: '<TaskWhenFields v-model:date="form.date.value" v-model:start-time="form.startTime.value" v-model:end-time="form.endTime.value" :weekly="form.isWeekly.value" :first-date="form.scheduledDate.value" />' })
  const wrapper = mount(Host, { global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] } })
  const form = wrapper.vm.form
  form.title.value = 'School pickup'; form.startTime.value = '14:30'; form.endTime.value = '15:30'
  return { wrapper, form, save }
}
describe('weekly task scheduling shared by desktop and mobile forms', () => {
  it('hides quick dates and submits Monday dates matching the recurrence/calendar', async () => {
    const { wrapper, form, save } = setup()
    form.recurrence.value = { frequency: 'weekly', interval: 1, weekdays: [0], end: { mode: 'after', count: 3 } }
    await flushPromises()
    expect(wrapper.text()).not.toContain('Tomorrow')
    expect(wrapper.text()).toContain('Mon 2 Nov')
    expect(form.date.value).toBe('2026-10-28')
    expect(form.canSubmit.value).toBe(true)
    await form.submit('family')
    const payload = save.mock.calls[0][0]
    expect(payload.startAt).toBe('2026-11-02T06:30:00.000Z')
    expect(payload.endAt).toBe('2026-11-02T07:30:00.000Z')
    const dates = recurrenceDates(parseRecurrence(payload.recurrence, payload.startAt), payload.startAt, payload.endAt, generationHorizon(payload.startAt))
    expect(dates.map(date => date.startAt.toISOString().slice(0, 10))).toEqual(['2026-11-02', '2026-11-09', '2026-11-16'])
    wrapper.unmount()
  })
  it('skips elapsed times today and recalculates when weekdays/time change', () => {
    const { wrapper, form } = setup()
    form.recurrence.value = { frequency: 'weekly', interval: 1, weekdays: [2, 4], end: { mode: 'never' } }
    expect(form.scheduledDate.value).toBe('2026-10-28')
    form.startTime.value = '09:00'
    expect(form.scheduledDate.value).toBe('2026-10-30')
    form.recurrence.value = { ...form.recurrence.value, weekdays: [2] }
    expect(form.scheduledDate.value).toBe('2026-11-04')
    wrapper.unmount()
  })
  it('preserves the calendar-selected lower bound and restores ordinary date choices', async () => {
    const { wrapper, form } = setup({ date: '2026-11-10' })
    form.recurrence.value = { frequency: 'weekly', interval: 2, weekdays: [0], end: { mode: 'never' } }
    await flushPromises()
    expect(form.scheduledDate.value).toBe('2026-11-16')
    expect(wrapper.text()).not.toContain('Tomorrow')
    form.recurrence.value = { frequency: 'none' }
    await flushPromises()
    expect(form.scheduledDate.value).toBe('2026-11-10')
    expect(wrapper.text()).toContain('Tomorrow')
    wrapper.unmount()
  })
})
