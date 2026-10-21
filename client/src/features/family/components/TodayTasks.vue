<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
import TaskList from '../../tasks/components/TaskList.vue'
defineProps({
  tasks: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: '' },
  busyId: { type: String, default: '' },
  filterLabel: { type: String, default: '' },
})
defineEmits(['retry', 'claim', 'clear-filter'])
</script>
<template>
  <SectionCard
    :title="filterLabel ? 'Tasks needing a hand' : 'Today across the family'"
    class="care-today-tasks"
  >
    <div v-if="filterLabel" class="care-task-filter">
      Unclaimed · {{ filterLabel }}
      <button class="care-text-button" @click="$emit('clear-filter')">
        Clear
      </button>
    </div>
    <TaskList
      :tasks="tasks"
      :is-loading="loading"
      :error-message="error"
      :empty-message="
        filterLabel
          ? 'No unclaimed tasks for this recipient.'
          : 'A little breathing room. No tasks scheduled today.'
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
  </SectionCard>
</template>
