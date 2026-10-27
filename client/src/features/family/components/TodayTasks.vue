<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
import TaskList from '../../tasks/components/TaskList.vue'
import { useTaskClock, isTaskOverdue } from '../../tasks/composables/useTaskOverdue.js'
const now = useTaskClock()
defineProps({
  tasks: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: '' },
  busyId: { type: String, default: '' },
  // Task whose claim just succeeded: shows a check for a moment
  claimedId: { type: String, default: '' },
  // Rows someone else just changed (live update): they flash once
  flashIds: { type: Array, default: () => [] },
  filterLabel: { type: String, default: '' },
  filter: { type: String, default: 'today' },
  filters: { type: Array, default: () => [] },
})
defineEmits(['retry', 'claim', 'clear-filter', 'filter'])
</script>
<template>
  <SectionCard
    :title="filterLabel ? 'Tasks needing a hand' : filter === 'today' ? 'Today across the family' : 'Across the family'"
    class="care-today-tasks"
  >
    <div v-if="filters.length" class="care-home-task-filters" role="group" aria-label="Filter family tasks">
      <button v-for="option in filters" :key="option.key" type="button" :aria-pressed="filter === option.key" :class="{ selected: filter === option.key }" @click="$emit('filter', option.key)">{{ option.label }}</button>
    </div>
    <div v-if="filterLabel" class="care-task-filter">
      Unclaimed · {{ filterLabel }}
      <button class="care-text-button" @click="$emit('clear-filter')">
        Clear
      </button>
    </div>
    <div class="care-home-panel-scroll" role="region" aria-label="Family task list" tabindex="0">
    <TaskList
      :tasks="tasks"
      :is-loading="loading"
      :error-message="error"
      :empty-message="
        filterLabel
          ? 'No unclaimed tasks for this recipient.'
          : filter === 'today' ? 'A little breathing room. No tasks scheduled today.' : 'No tasks with this status in this family.'
      "
      :flash-ids="flashIds"
      @retry="$emit('retry')"
    >
      <template #actions="{ task }">
        <span v-if="task.status === 'open' && isTaskOverdue(task, now)" class="care-muted care-small">Overdue · Claiming closed</span>
        <button
          v-else-if="task.status === 'open'"
          class="care-button care-button--coral care-claim-button"
          :class="{ 'is-claimed': claimedId === task._id }"
          :disabled="Boolean(busyId)"
          @click="$emit('claim', task)"
        >
          <template v-if="claimedId === task._id">
            <svg class="care-check" viewBox="0 0 16 16" aria-hidden="true">
              <polyline
                points="3 8.5 6.5 12 13 4.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="visually-hidden">Claimed</span>
          </template>
          <template v-else>
            {{ busyId === task._id ? 'Claiming…' : 'I’ll take it' }}
          </template>
        </button>
      </template>
    </TaskList>
    </div>
  </SectionCard>
</template>
