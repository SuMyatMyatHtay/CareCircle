<script setup>
import { computed, ref, watch } from 'vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { previewState } from '../../family/data/previewFamily.js'
import { http } from '../../../services/http.js'
import { authConfig, apiError } from '../../family/services/dashboardApi.js'
const props = defineProps({ selectedIds: { type: Array, default: () => [] }, taskIds: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['deleted', 'select-all', 'busy'])
const allSelected = computed(() => props.taskIds.length > 0 && props.taskIds.every(id => props.selectedIds.includes(id)))
const { selectedFamily, selectedFamilyId, isAdmin, isPreview, user } = useFamilyWorkspace()
const allowed = computed(() => Boolean(selectedFamily.value))
const busy = ref(false), message = ref(''), error = ref('')
watch(selectedFamilyId, () => { message.value = ''; error.value = '' })
async function remove() {
  if (busy.value || props.disabled || !allowed.value || !props.selectedIds.length) return
  const ids = [...props.selectedIds]
  if (!window.confirm(`Delete ${ids.length} selected overdue task${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
  const familyId = selectedFamilyId.value
  busy.value = true
  emit('busy', true)
  message.value = ''; error.value = ''
  try {
    let deletedCount
    if (isPreview) {
      const before = previewState.tasks.length
      previewState.tasks = previewState.tasks.filter(task => !(ids.includes(task._id) && (isAdmin.value || String(task.createdBy?._id || task.createdBy) === user.value.id) && task.status === 'open' && +new Date(task.startAt) <= Date.now()))
      deletedCount = before - previewState.tasks.length
      if (deletedCount) previewState.updates.unshift({
        _id: crypto.randomUUID(), actor: user.value.name, actorId: user.value.id,
        profilePicture: user.value.profilePicture, avatar: user.value.avatar,
        text: `${user.value.name} deleted ${deletedCount} overdue task${deletedCount === 1 ? '' : 's'}.`,
        time: new Intl.DateTimeFormat('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' }).format(new Date()),
      })
    } else {
      const { data } = await http.delete(`/families/${familyId}/tasks/overdue`, { ...authConfig(), data: { taskIds: ids } })
      deletedCount = data.deletedCount
    }
    if (familyId !== selectedFamilyId.value) return
    message.value = `${deletedCount} overdue task${deletedCount === 1 ? '' : 's'} deleted.`
    window.dispatchEvent(new CustomEvent('carecircle:overdue-deleted', { detail: { familyId } }))
    emit('deleted')
  } catch (err) {
    if (familyId === selectedFamilyId.value) { error.value = apiError(err, 'Delete overdue tasks'); emit('deleted') }
  } finally { busy.value = false; emit('busy', false) }
}
</script>
<template>
  <div v-if="selectedFamily && allowed" class="care-overdue-actions">
    <div class="overdue-toolbar">
      <label class="overdue-select-all">
        <input type="checkbox" :checked="allSelected" :indeterminate="selectedIds.length > 0 && !allSelected" :disabled="busy || disabled || !taskIds.length" @change="$emit('select-all', $event.target.checked)" />
        <span>Select all</span>
      </label>
      <span class="overdue-selection-count" role="status">{{ selectedIds.length ? `${selectedIds.length} selected` : 'Select tasks to delete' }}</span>
      <button type="button" class="care-button overdue-delete" :disabled="busy || disabled || !selectedIds.length" @click="remove">
        <i class="bi bi-trash3" aria-hidden="true"></i>
        {{ busy ? 'Deleting...' : selectedIds.length ? `Delete selected (${selectedIds.length})` : 'Delete selected' }}
      </button>
    </div>
    <p v-if="message" class="care-feedback" role="status">{{ message }}</p>
    <p v-if="error" class="care-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.care-overdue-actions { margin: 0 0 16px; }
.overdue-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--care-border); }
.overdue-select-all { display: inline-flex; align-items: center; gap: 9px; color: var(--care-text); font-size: 13px; cursor: pointer; }
.overdue-select-all input { width: 18px; height: 18px; accent-color: var(--care-green, #2e7d43); }
.overdue-selection-count { font-size: 12px; color: var(--care-muted); }
.overdue-delete { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px; color: var(--care-text); border: 1px solid #ce7765; background: rgba(206, 119, 101, .08); }
.overdue-delete:hover:not(:disabled) { background: rgba(206, 119, 101, .18); }
.overdue-delete:disabled { opacity: .45; cursor: not-allowed; }
@media (max-width: 480px) { .overdue-selection-count { display: none; } .overdue-delete { font-size: 12px; padding: 10px; } }
</style>
