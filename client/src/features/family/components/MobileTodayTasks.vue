<script setup>
import { isTaskOverdue, useTaskClock } from '../../tasks/composables/useTaskOverdue.js'
import MobileTaskCard from './MobileTaskCard.vue'
const now = useTaskClock()
defineProps({
  tasks: { type: Array, default: () => [] },
  selectable: Boolean,
  selectedIds: { type: Array, default: () => [] },
  selectionBusy: Boolean,
  loading: Boolean,
  error: { type: String, default: '' },
  busyId: { type: String, default: '' },
  title: { type: String, default: 'Today' },
  showAll: { type: Boolean, default: true },
  showDate: Boolean,
  allowCreate: Boolean,
  allowClaim: { type: Boolean, default: true },
})
defineEmits(['see-all', 'retry', 'claim', 'create', 'select-task'])
</script>

<template>
  <section class="care-mobile-today" :aria-label="title">
    <header>
      <h2>{{ title }}</h2>
      <button v-if="showAll" class="care-text-button" @click="$emit('see-all')">
        See all
      </button>
      <button
        v-else-if="allowCreate"
        class="care-text-button"
        @click="$emit('create')"
      >
        <i class="bi bi-plus-lg" aria-hidden="true"></i>
        New task
      </button>
    </header>
    <p v-if="loading" class="care-mobile-task-state" role="status">
      Loading today’s tasks…
    </p>
    <div
      v-else-if="error"
      class="care-mobile-task-state care-error"
      role="alert"
    >
      {{ error }}
      <button class="care-text-button" @click="$emit('retry')">
        Try again
      </button>
    </div>
    <p v-else-if="!tasks.length" class="care-mobile-task-state">
      A little breathing room. No tasks scheduled.
    </p>
    <div v-else class="care-mobile-task-list">
      <div v-for="task in tasks" :key="task._id" class="mobile-task-selection-row" :class="{ 'has-selection': selectable }">
        <label v-if="selectable" class="overdue-mobile-select">
          <input v-if="task.status === 'open' && isTaskOverdue(task, now)" type="checkbox" :checked="selectedIds.includes(task._id)" :disabled="selectionBusy" :aria-label="`Select ${task.title} for deletion`" @change="$emit('select-task', task._id, $event.target.checked)" />
        </label>
        <MobileTaskCard
          :task="task"
          :busy-id="busyId"
          :show-date="showDate"
          :allow-claim="allowClaim"
          @claim="$emit('claim', $event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.mobile-task-selection-row { min-width: 0; }
.mobile-task-selection-row.has-selection { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 12px; align-items: center; }
.overdue-mobile-select { display: flex; align-items: center; justify-content: center; min-height: 44px; cursor: pointer; }
.overdue-mobile-select input { width: 20px; height: 20px; accent-color: var(--care-green, #2e7d43); }
</style>
