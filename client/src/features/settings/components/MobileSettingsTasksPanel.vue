<script setup>
import { computed } from 'vue'
import MobileTodayTasks from '../../family/components/MobileTodayTasks.vue'
import { useFamilyDashboard } from '../../family/composables/useFamilyDashboard.js'
defineProps({ agenda: Boolean, homePath: { type: String, required: true } })
const {
  tasks,
  loading,
  error,
  busyId,
  toast,
  toastError,
  loadTasks,
  claimTask,
} = useFamilyDashboard()
const orderedTasks = computed(() =>
  [...tasks.value].sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
)
</script>
<template>
  <div class="care-mobile-settings-task-panel">
    <p v-if="agenda" class="care-muted care-small">
      Your family’s schedule for the next seven days.
    </p>
    <p
      v-if="toast"
      :class="toastError ? 'care-error' : 'care-feedback'"
      role="status"
    >
      {{ toast }}
    </p>
    <MobileTodayTasks
      :tasks="orderedTasks"
      :loading="loading"
      :error="error"
      :busy-id="busyId"
      :title="agenda ? 'Next 7 days' : 'Upcoming tasks'"
      :show-all="false"
      show-date
      :allow-claim="!agenda"
      @retry="loadTasks()"
      @claim="claimTask"
    />
    <RouterLink :to="homePath" class="care-text-button care-mobile-board-link">
      Open the family board
      <i class="bi bi-arrow-right" aria-hidden="true"></i>
    </RouterLink>
  </div>
</template>
