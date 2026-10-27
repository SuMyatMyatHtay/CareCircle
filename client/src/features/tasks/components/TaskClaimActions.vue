<script setup>
import { computed, ref, watch } from 'vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { claimTask, getErrorMessage } from '../../my-tasks/services/myTasksApi.js'
import { useTaskOverdue, isTaskOverdue } from '../composables/useTaskOverdue.js'

const props = defineProps({ task: { type: Object, required: true } })
const overdue = useTaskOverdue(() => props.task)
const { selectedFamilyId } = useActiveFamily()
const familyId = computed(() => props.task.family?._id || props.task.family || selectedFamilyId.value)
const busy = ref(false), error = ref('')
watch(() => props.task._id, () => { error.value = '' })
async function claim() {
  if (busy.value || props.task.status !== 'open' || isTaskOverdue(props.task)) return
  busy.value = true; error.value = ''
  try { await claimTask(familyId.value, props.task._id) }
  catch (err) { error.value = getErrorMessage(err) }
  finally { busy.value = false }
}
</script>

<template>
  <div class="task-claim-actions">
    <span v-if="task.status === 'open' && overdue" class="task-claim-error">Overdue · Claiming closed</span>
    <button v-else-if="task.status === 'open'" type="button" class="care-button care-button--coral" :disabled="busy" @click="claim">{{ busy ? 'Claiming…' : "I’ll take it" }}</button>
    <RouterLink :to="{ name: 'task-detail', params: { familyId, taskId: task._id } }" class="task-detail-link">View task <i class="bi bi-arrow-right" aria-hidden="true"></i></RouterLink>
    <span v-if="error" class="task-claim-error" role="alert">{{ error }}</span>
  </div>
</template>

<style scoped>
.task-claim-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap}.task-detail-link{font-size:13px;color:var(--theme-green,#2d7d43);white-space:nowrap}.task-claim-error{width:100%;font-size:13px;color:var(--theme-danger,#b33b2e)}
</style>
