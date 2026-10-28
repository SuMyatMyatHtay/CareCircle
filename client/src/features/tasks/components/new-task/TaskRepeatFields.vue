<script setup>
import { computed, useId } from 'vue'
import { recurrenceLabel } from '../../../../../../shared/recurrence.js'
const rule = defineModel({ type: Object, required: true })
const props = defineProps({ date: String, preview: { type: Object, default: () => ({ dates: [], error: '' }) } })
const uid = useId()
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const presets = [{ key: 'none', label: "Doesn't repeat" }, { key: 'daily', label: 'Every day' }, { key: 'weekly', label: 'Every week' }, { key: 'biweekly', label: 'Every 2 weeks' }, { key: 'monthly', label: 'Every month' }, { key: 'custom', label: 'Custom…' }]
const choice = computed(() => rule.value.preset || (rule.value.frequency === 'weekly' && rule.value.interval === 2 ? 'biweekly' : rule.value.frequency))
function patch(update) { rule.value = { ...rule.value, ...update } }
function choose(key) {
  const weekday = (new Date(`${props.date}T12:00:00+08:00`).getUTCDay() + 6) % 7
  patch({ preset: key, frequency: key === 'biweekly' || key === 'custom' ? 'weekly' : key,
    interval: key === 'biweekly' ? 2 : 1, weekdays: [weekday], end: rule.value.end || { mode: 'never' } })
}
function toggleDay(day) {
  const current = rule.value.weekdays || []
  patch({ weekdays: current.includes(day) ? current.filter(value => value !== day) : [...current, day].sort() })
}
function end(mode) { patch({ end: { mode, ...(mode === 'after' ? { count: 4 } : {}), ...(mode === 'on' ? { until: props.date } : {}) } }) }
const monthlyDay = computed(() => {
  const day = Number(props.date?.slice(8, 10))
  if (!day) return ''
  const suffix = day >= 11 && day <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th')
  return `${day}${suffix}`
})
const monthlySchedule = computed(() => `On the ${monthlyDay.value} ${rule.value.interval > 1 ? `every ${rule.value.interval} months` : 'of every month'}`)
const summary = computed(() => {
  if (rule.value.frequency === 'monthly') return monthlySchedule.value
  if (rule.value.frequency === 'none' || !props.preview.dates.length) return ''
  return recurrenceLabel({ ...rule.value, weekdays: rule.value.weekdays || [] })
})
</script>
<template>
  <fieldset class="task-repeat">
    <legend class="task-label"><i class="bi bi-repeat" aria-hidden="true"></i> Repeat</legend>
    <div class="repeat-choices"><button v-for="preset in presets" :key="preset.key" type="button" :aria-pressed="choice === preset.key" :class="{ selected: choice === preset.key }" @click="choose(preset.key)">{{ preset.label }}</button></div>
    <template v-if="rule.frequency !== 'none'">
      <div v-if="choice === 'custom'" class="repeat-custom"><label :for="`${uid}-interval`">Every</label><input :id="`${uid}-interval`" type="number" min="1" max="365" :value="rule.interval" @input="patch({ interval: Number($event.target.value) })"><select aria-label="Repeat interval unit" :value="rule.frequency" @change="patch({ frequency: $event.target.value })"><option value="daily">days</option><option value="weekly">weeks</option><option value="monthly">months</option></select></div>
      <div v-if="rule.frequency === 'weekly'" class="repeat-section"><span class="task-sublabel">On</span><div class="repeat-choices"><button v-for="(day, index) in days" :key="day" type="button" :aria-label="day" :aria-pressed="rule.weekdays?.includes(index) || false" :class="{ selected: rule.weekdays?.includes(index) }" @click="toggleDay(index)">{{ day }}</button></div></div>
      <div v-if="rule.frequency === 'monthly'" class="repeat-summary" aria-live="polite">
        <strong>{{ monthlySchedule }}</strong>
        <small>First session: {{ new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }) }}. Change the date above to choose a different day of the month.</small>
        <small v-if="Number(date?.slice(8, 10)) > 28">Months without a {{ monthlyDay }} are skipped; the task does not move to the last day of the month.</small>
      </div>
      <div class="repeat-section"><span class="task-sublabel">Ends</span><div class="repeat-choices"><button v-for="option in [{ key: 'never', label: 'Never' }, { key: 'on', label: 'On a date' }, { key: 'after', label: 'After a number of times' }]" :key="option.key" type="button" :aria-pressed="rule.end?.mode === option.key" :class="{ selected: rule.end?.mode === option.key }" @click="end(option.key)">{{ option.label }}</button></div>
        <label v-if="rule.end?.mode === 'on'" class="repeat-end">Last date <input type="date" :min="date" :value="rule.end.until" @input="patch({ end: { mode: 'on', until: $event.target.value } })"></label>
        <label v-if="rule.end?.mode === 'after'" class="repeat-end">Sessions <input type="number" min="1" max="500" :value="rule.end.count" @input="patch({ end: { mode: 'after', count: Number($event.target.value) } })"></label>
      </div>
      <p v-if="preview.error" class="task-field-error" role="alert">{{ preview.error }}</p>
      <div v-else-if="rule.frequency !== 'monthly'" class="repeat-summary" aria-live="polite"><strong>{{ summary || 'Choose a start time to preview' }}</strong><small v-if="preview.dates.length">First session: {{ new Date(preview.dates[0].startAt).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }) }}. {{ preview.dates.length }} sessions{{ rule.end?.mode === 'never' ? ' in the initial four-week window; more are created as the window moves forward.' : '.' }} Claiming the series covers upcoming dates. A released date can be taken by someone else for that day only.</small></div>
    </template>
  </fieldset>
</template>
<style scoped>
.task-repeat{border:1px solid var(--theme-border,#e4ece5);background:var(--theme-page,#fcfbf8);border-radius:15px;padding:16px;min-width:0}.task-repeat legend{float:none;width:auto;margin:0 0 10px;font-size:14px}.repeat-choices{display:flex;flex-wrap:wrap;gap:6px}.repeat-choices button{border:1px solid var(--theme-border,#e4ece5);border-radius:20px;padding:5px 10px;font:inherit;font-size:12px;color:var(--theme-text,#30332f);background:var(--theme-panel,#fff)}.repeat-choices button.selected{background:var(--theme-green,#2d7d43);border-color:var(--theme-green,#2d7d43);color:white}.repeat-section{margin-top:14px}.repeat-summary{display:grid;gap:5px;background:var(--theme-soft,#e8f5e9);color:var(--theme-green,#2d7d43);border-radius:12px;padding:12px;margin-top:14px;font-size:13px}.repeat-summary small{font-size:12px}.repeat-end,.repeat-custom{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:13px}.repeat-end input,.repeat-custom input,.repeat-custom select{padding:7px;border:1px solid var(--theme-border,#e4ece5);border-radius:8px;background:var(--theme-panel,#fff);color:inherit;min-width:0}.repeat-custom input,.repeat-end input[type=number]{width:76px}
</style>
