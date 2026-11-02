<script setup>
import { computed, ref, useId } from 'vue'
import SectionCard from '../../../components/common/SectionCard.vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { previewState } from '../../family/data/previewFamily.js'
import { http } from '../../../services/http.js'
import { authConfig, apiError } from '../../family/services/dashboardApi.js'
const { selectedFamily, selectedFamilyId, isAdmin, isPreview } = useFamilyWorkspace()
const permission = computed(() => selectedFamily.value?.overdueTaskDeletion || 'admin')
const busy = ref(false), error = ref(''), saved = ref(false), pending = ref('')
const groupId = useId()
const options = [
  { value: 'admin', title: 'Admins only', description: 'Keep these task actions with family admins.', icon: 'bi-shield-check' },
  { value: 'member', title: 'All family members', description: 'Let anyone in the family clear overdue tasks and stop or resume repeating schedules.', icon: 'bi-people' },
]
async function change(value) {
  const familyId = selectedFamilyId.value
  if (value === permission.value) return
  if (!isAdmin.value || busy.value) return
  busy.value = true; pending.value = value; error.value = ''; saved.value = false
  try {
    if (isPreview) previewState.family.overdueTaskDeletion = value
    else {
      const { data } = await http.patch(`/families/${familyId}/task-permissions`, { overdueTaskDeletion: value }, authConfig())
      if (familyId !== selectedFamilyId.value) return
      selectedFamily.value.overdueTaskDeletion = data.overdueTaskDeletion
    }
    saved.value = true
  } catch (err) { if (familyId === selectedFamilyId.value) error.value = apiError(err, 'Task permissions') }
  finally { busy.value = false; pending.value = '' }
}
</script>
<template>
  <SectionCard v-if="selectedFamily" title="Task permissions" class="care-task-permissions">
    <template #actions>
      <span class="permission-badge"><i class="bi bi-shield-lock" aria-hidden="true"></i> Admin managed</span>
    </template>
    <fieldset :disabled="!isAdmin || busy" :aria-busy="busy">
      <legend>Who can delete overdue tasks or stop repeating tasks?</legend>
      <p class="permission-description">Choose who can delete overdue tasks and stop or resume repeating schedules.</p>
      <div class="permission-options">
        <label v-for="option in options" :key="option.value" class="permission-option" :class="{ selected: (pending || permission) === option.value }">
          <input type="radio" :name="`overdue-deletion-${groupId}`" :value="option.value" :checked="(pending || permission) === option.value" @change="change(option.value)" />
          <span class="permission-icon"><i class="bi" :class="option.icon" aria-hidden="true"></i></span>
          <span class="permission-copy">
            <span class="permission-title">{{ option.title }} <span v-if="option.value === 'admin'" class="permission-default">Default</span></span>
            <span class="permission-detail">{{ option.description }}</span>
          </span>
          <i v-if="(pending || permission) === option.value" class="bi bi-check-circle-fill permission-check" aria-hidden="true"></i>
          <span v-else class="permission-empty" aria-hidden="true"></span>
        </label>
      </div>
    </fieldset>
    <div class="permission-footer" aria-live="polite">
      <p v-if="busy"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Saving permission...</p>
      <p v-else-if="error" role="alert" class="care-error">{{ error }}</p>
      <p v-else-if="saved" class="care-feedback"><i class="bi bi-check-circle" aria-hidden="true"></i> Task permissions saved.</p>
      <p v-else><i class="bi bi-lock" aria-hidden="true"></i> {{ isAdmin ? 'Only family admins can change this setting. Changes save automatically.' : 'Ask a family admin to change this setting.' }}</p>
    </div>
  </SectionCard>
</template>

<style scoped>
.care-task-permissions { height: auto; }
.permission-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--care-muted); white-space: nowrap; }
fieldset { min-width: 0; border: 0; margin: 0; padding: 0; }
legend { float: none; width: auto; margin: 0 0 6px; font-size: 15px; font-weight: 700; color: var(--care-text); }
.permission-description { color: var(--care-muted); font-size: 13px; line-height: 1.6; margin: 0 0 18px; }
.permission-options { display: grid; gap: 10px; }
.permission-option { position: relative; display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--care-border); border-radius: 12px; background: var(--care-bg); cursor: pointer; transition: border-color .15s, background .15s; }
.permission-option.selected { border-color: var(--care-green); background: var(--care-soft); }
.permission-option:hover { border-color: var(--care-green); }
.permission-option:focus-within { outline: 2px solid var(--care-green); outline-offset: 3px; }
.permission-option input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.permission-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 36px; border-radius: 10px; background: var(--care-panel); color: var(--care-green); font-size: 18px; }
.permission-copy { display: grid; gap: 4px; flex: 1; min-width: 0; }
.permission-title { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 14px; font-weight: 700; color: var(--care-text); }
.permission-default { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; background: var(--care-panel); color: var(--care-muted); }
.permission-detail { font-size: 12px; color: var(--care-muted); line-height: 1.5; }
.permission-check { color: var(--care-green); font-size: 18px; }
.permission-empty { width: 18px; height: 18px; flex: 0 0 18px; border: 1px solid var(--care-border); border-radius: 50%; }
fieldset:disabled .permission-option { cursor: default; }
.permission-footer { border-top: 1px solid var(--care-border); margin-top: 18px; padding-top: 13px; }
.permission-footer p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--care-muted); }
.permission-footer i { margin-right: 5px; }
.permission-footer .care-error { color: var(--care-danger, #c55b4c); }
.permission-footer .care-feedback { color: var(--care-green); }
@media (max-width: 480px) { .permission-badge { font-size: 10px; } .permission-option { padding: 13px 12px; gap: 10px; } }
</style>
