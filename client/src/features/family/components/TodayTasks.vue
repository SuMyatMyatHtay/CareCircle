<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
import TaskList from '../../tasks/components/TaskList.vue'
defineProps({
  tasks: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: '' },
  busyId: { type: String, default: '' },
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
      @retry="$emit('retry')"
    >
      <template #actions="{ task }">
        <button
          v-if="task.status === 'open'"
          class="care-button care-button--coral care-claim-button"
          :disabled="Boolean(busyId)"
          @click="$emit('claim', task)"
        >
          {{ busyId === task._id ? 'Claiming…' : 'I’ll take it' }}
        </button>
      </template>
    </TaskList>
    </div>
  </SectionCard>
</template>
