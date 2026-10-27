<script setup>
import { computed, ref, watch } from 'vue'
import RecipientCard from './RecipientCard.vue'
const props = defineProps({
  recipients: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: '' },
  tasks: { type: Array, default: () => [] },
  tasksAvailable: { type: Boolean, default: true },
  preview: Boolean,
})
defineEmits(['retry', 'open', 'show-open-tasks'])
const id = (value) =>
  typeof value === 'object' && value ? value._id || value.id : value
const page = ref(1)
const pageSize = 3
const pageCount = computed(() => Math.ceil(props.recipients.length / pageSize))
const visibleRecipients = computed(() => props.recipients.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(() => props.recipients.map(id).join(','), () => { page.value = 1 })
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
      <RouterLink v-if="!preview" to="/recipients/new" class="care-text-button">
        Add care recipient
      </RouterLink>
    </div>
    <div v-else>
    <div class="care-recipient-grid">
      <RecipientCard
        v-for="recipient in visibleRecipients"
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
    <nav v-if="pageCount > 1" class="care-recipient-pagination" aria-label="Care recipient pages">
      <span class="care-recipient-page-summary" role="status">{{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, recipients.length) }} of {{ recipients.length }}</span>
      <button type="button" :disabled="page === 1" aria-label="Previous recipients page" @click="page--"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
      <button v-for="number in pageCount" :key="number" type="button" :class="{ selected: page === number }" :aria-label="`Recipients page ${number}`" :aria-current="page === number ? 'page' : undefined" @click="page = number">{{ number }}</button>
      <button type="button" :disabled="page === pageCount" aria-label="Next recipients page" @click="page++"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
    </nav>
    </div>
  </section>
</template>
