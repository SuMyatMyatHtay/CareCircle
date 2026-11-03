<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
import TaskList from '../../tasks/components/TaskList.vue'
defineProps({ tasks: { type: Array, default: () => [] }, loading: Boolean, error: { type: String, default: '' }, busyId: { type: String, default: '' } })
defineEmits(['claim', 'retry'])
</script>
<template>
  <SectionCard title="Upcoming tasks needing someone" class="urgent-upcoming-tasks">
    <p class="care-muted care-small">The next three unclaimed tasks, soonest first.</p>
    <TaskList :tasks="tasks" :is-loading="loading" :error-message="error" empty-message="All covered. No upcoming tasks need someone." @retry="$emit('retry')">
      <template #actions="{ task }">
        <button type="button" class="care-button care-button--coral" :disabled="Boolean(busyId)" @click="$emit('claim', task)">{{ busyId === task._id ? 'Claiming…' : 'I’ll take it' }}</button>
      </template>
    </TaskList>
  </SectionCard>
</template>
<style scoped>
.urgent-upcoming-tasks { margin-bottom: 22px; height: auto !important; }
</style>
