<script setup>
import { computed, ref } from 'vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { previewState } from '../../family/data/previewFamily.js'
import { http } from '../../../services/http.js'
import { authConfig, apiError } from '../../family/services/dashboardApi.js'
const { selectedFamily, selectedFamilyId, isAdmin, isPreview } = useFamilyWorkspace()
const permission = computed(() => selectedFamily.value?.overdueTaskDeletion || 'admin')
const busy = ref(false), error = ref(''), saved = ref(false)
async function change(event) {
  const value = event.target.value, familyId = selectedFamilyId.value
  event.target.value = permission.value
  if (!isAdmin.value || busy.value) return
  busy.value = true; error.value = ''; saved.value = false
  try {
    if (isPreview) previewState.family.overdueTaskDeletion = value
    else {
      const { data } = await http.patch(`/families/${familyId}/task-permissions`, { overdueTaskDeletion: value }, authConfig())
      if (familyId !== selectedFamilyId.value) return
      selectedFamily.value.overdueTaskDeletion = data.overdueTaskDeletion
    }
    saved.value = true
  } catch (err) { if (familyId === selectedFamilyId.value) error.value = apiError(err, 'Task permissions') }
  finally { busy.value = false }
}
</script>
<template>
  <section v-if="selectedFamily" class="care-task-permissions">
    <h2>Task permissions</h2>
    <label>Who can delete overdue tasks?
      <select :value="permission" :disabled="!isAdmin || busy" @change="change">
        <option value="admin">Admins only (default)</option>
        <option value="member">All family members</option>
      </select>
    </label>
    <p class="care-muted care-small">Applies to individual and bulk deletion of overdue open tasks. Only admins can change this setting.</p>
    <p v-if="saved" role="status" class="care-feedback">Task permissions saved.</p>
    <p v-if="error" role="alert" class="care-error">{{ error }}</p>
  </section>
</template>
