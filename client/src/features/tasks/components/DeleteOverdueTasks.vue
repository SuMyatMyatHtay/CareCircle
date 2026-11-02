<script setup>
import { computed, ref, watch } from 'vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { previewState } from '../../family/data/previewFamily.js'
import { http } from '../../../services/http.js'
import { authConfig, apiError } from '../../family/services/dashboardApi.js'
const emit = defineEmits(['deleted'])
const { selectedFamily, selectedFamilyId, isAdmin, isPreview } = useFamilyWorkspace()
const allowed = computed(() => isAdmin.value || selectedFamily.value?.overdueTaskDeletion === 'member')
const busy = ref(false), message = ref(''), error = ref('')
watch(selectedFamilyId, () => { message.value = ''; error.value = '' })
async function remove() {
  if (busy.value || !allowed.value) return
  if (!window.confirm('Delete all overdue open tasks in this family? This cannot be undone. Tasks in progress, completed tasks and future recurring occurrences will be kept.')) return
  const familyId = selectedFamilyId.value
  busy.value = true
  message.value = ''; error.value = ''
  try {
    let deletedCount
    if (isPreview) {
      const before = previewState.tasks.length
      previewState.tasks = previewState.tasks.filter(task => !(task.status === 'open' && +new Date(task.startAt) <= Date.now()))
      deletedCount = before - previewState.tasks.length
    } else {
      const { data } = await http.delete(`/families/${familyId}/tasks/overdue`, authConfig())
      deletedCount = data.deletedCount
    }
    if (familyId !== selectedFamilyId.value) return
    message.value = `${deletedCount} overdue task${deletedCount === 1 ? '' : 's'} deleted.`
    emit('deleted')
  } catch (err) {
    if (familyId === selectedFamilyId.value) { error.value = apiError(err, 'Delete overdue tasks'); emit('deleted') }
  } finally { busy.value = false }
}
</script>
<template>
  <div v-if="selectedFamily && allowed" class="care-overdue-actions">
    <button type="button" class="care-button" :disabled="busy" @click="remove">{{ busy ? 'Deleting?' : 'Delete all overdue tasks' }}</button>
    <p v-if="message" class="care-feedback" role="status">{{ message }}</p>
    <p v-if="error" class="care-error" role="alert">{{ error }}</p>
  </div>
</template>
