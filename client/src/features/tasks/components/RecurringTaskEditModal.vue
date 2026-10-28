<script setup>
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import CareModal from '../../../components/common/CareModal.vue'
import { editTask, getTaskErrorMessage } from '../services/tasksApi.js'
import { queryKeys } from '../../../services/queryClient.js'
const props = defineProps({ task: { type: Object, required: true }, familyId: { type: String, required: true } })
const emit = defineEmits(['close', 'saved'])
const local = value => value ? new Date(+new Date(value) + 8 * 3600000).toISOString().slice(0, 16) : ''
const title = ref(props.task.title), start = ref(local(props.task.startAt)), end = ref(local(props.task.endAt))
const notes = ref(props.task.description || ''), place = ref(props.task.location?.name || ''), scope = ref('one')
const busy = ref(false), error = ref('')
const client = useQueryClient()
const choices = computed(() => props.task.recurrenceDetached ? [{ key: 'one', title: 'Only this date', detail: 'This session is a one-day exception. Other dates are not affected.' }] : [
  { key: 'one', title: 'Only this date', detail: 'Other sessions keep their current details.' },
  { key: 'future', title: 'This date and every session after', detail: 'Update upcoming sessions from this occurrence onward.' },
  { key: 'all', title: 'Every upcoming session', detail: 'Update all upcoming sessions in the series. Started, completed and detached sessions stay unchanged.' },
])
async function save() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    if (!title.value.trim() || !start.value) throw new Error('Add a title and start time.')
    const changes = { scope: scope.value, expectedUpdatedAt: props.task.updatedAt }
    if (title.value.trim() !== props.task.title) changes.title = title.value.trim()
    if (notes.value !== (props.task.description || '')) changes.description = notes.value
    if (start.value !== local(props.task.startAt)) changes.startAt = new Date(`${start.value}+08:00`).toISOString()
    if (end.value !== local(props.task.endAt)) changes.endAt = end.value ? new Date(`${end.value}+08:00`).toISOString() : null
    if (place.value !== (props.task.location?.name || '')) changes.location = place.value.trim() ? { name: place.value.trim() } : null
    if (Object.keys(changes).length === 2) throw new Error('Change a task detail before saving.')
    const task = await editTask(props.familyId, props.task._id, changes)
    await client.cancelQueries({ queryKey: queryKeys.tasks(props.familyId) })
    await client.invalidateQueries({ queryKey: queryKeys.family(props.familyId) })
    window.dispatchEvent(new CustomEvent('carecircle:task-updated', { detail: { familyId: props.familyId, task, action: 'update' } }))
    emit('saved', task)
  } catch (err) { error.value = getTaskErrorMessage(err) }
  finally { busy.value = false }
}
</script>
<template>
  <CareModal title="Edit repeating task" @close="!busy && emit('close')">
    <form class="recurring-edit" @submit.prevent="save">
      <label>What needs doing?<input v-model="title" maxlength="120" required :disabled="busy"></label>
      <div class="recurring-edit-times"><label>Starts (Singapore time)<input v-model="start" type="datetime-local" required :disabled="busy"></label><label>Ends (optional)<input v-model="end" type="datetime-local" :disabled="busy"></label></div>
      <label>Place<input v-model="place" maxlength="120" :disabled="busy"></label>
      <label>Notes<textarea v-model="notes" maxlength="2000" :disabled="busy"></textarea></label>
      <h3>Apply this change to…</h3>
      <label v-for="choice in choices" :key="choice.key" class="recurring-scope-option" :class="{ selected: scope === choice.key }"><input v-model="scope" type="radio" name="recurring-edit-scope" :value="choice.key" :disabled="busy"><span><strong>{{ choice.title }}</strong><small>{{ choice.detail }}</small></span></label>
      <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
      <div class="recurring-dialog-buttons"><button type="button" class="care-button" :disabled="busy" @click="emit('close')">Cancel</button><button type="submit" class="care-button care-button--green" :disabled="busy">{{ busy ? 'Saving…' : 'Save change' }}</button></div>
    </form>
  </CareModal>
</template>
<style scoped>
.recurring-edit>label{display:grid;gap:6px;margin-bottom:12px;font-size:13px}.recurring-edit input:not([type=radio]),.recurring-edit textarea{width:100%;min-width:0;padding:9px;border:1px solid var(--theme-border,#e4ece5);border-radius:8px;background:var(--theme-panel,#fff);color:inherit}.recurring-edit-times{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.recurring-edit-times label{font-size:12px;min-width:0}.recurring-edit h3{font-size:17px;margin:18px 0 8px}.recurring-edit>.recurring-scope-option{display:flex}.recurring-edit .recurring-scope-option input{width:auto}@media(max-width:500px){.recurring-edit-times{grid-template-columns:1fr}}
</style>
