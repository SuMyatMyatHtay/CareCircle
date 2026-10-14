<script setup>
import RecipientCard from './RecipientCard.vue'
defineProps({
  recipients: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: '' },
  tasks: { type: Array, default: () => [] },
  tasksAvailable: { type: Boolean, default: true },
})
defineEmits(['retry', 'open', 'show-open-tasks'])
const id = (value) =>
  typeof value === 'object' && value ? value._id || value.id : value
function recipientTasks(tasks, recipient) {
  return tasks
    .filter(
      (task) =>
        id(task.recipient) === id(recipient) &&
        !['completed', 'cancelled'].includes(task.status),
    )
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
}
function nextTask(tasks, recipient) {
  const task = recipientTasks(tasks, recipient).find(
    (entry) => entry.status === 'open' || new Date(entry.startAt) >= new Date(),
  )
  if (!task) return ''
  const date = new Intl.DateTimeFormat('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Singapore',
  }).format(new Date(task.startAt))
  return `${task.title}, ${date}`
}
</script>
<template>
  <section class="care-recipient-overview" aria-labelledby="recipients-heading">
    <h2 id="recipients-heading" class="care-section-title">
      Who are we caring for?
    </h2>
    <div v-if="loading" class="care-inline-state" role="status">
      Loading care recipients…
    </div>
    <div v-else-if="error" class="care-inline-state" role="alert">
      {{ error }}
      <button class="care-text-button" @click="$emit('retry')">
        Try again
      </button>
    </div>
    <div v-else-if="!recipients.length" class="care-inline-state">
      No care recipients yet. Your family’s care profiles will appear here.
    </div>
    <div v-else class="care-recipient-grid">
      <RecipientCard
        v-for="recipient in recipients"
        :key="recipient._id || recipient.id"
        :recipient="recipient"
        :tasks-available="tasksAvailable"
        :next-task="
          tasksAvailable ? nextTask(tasks, recipient) : 'Tasks unavailable'
        "
        :open-count="
          recipientTasks(tasks, recipient).filter(
            (task) => task.status === 'open',
          ).length
        "
        @open="$emit('open', $event)"
        @show-open-tasks="$emit('show-open-tasks', $event)"
      />
    </div>
  </section>
</template>
