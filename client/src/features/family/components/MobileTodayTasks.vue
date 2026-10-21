<script setup>
import MobileTaskCard from './MobileTaskCard.vue'
defineProps({
  tasks: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: '' },
  busyId: { type: String, default: '' },
  title: { type: String, default: 'Today' },
  showAll: { type: Boolean, default: true },
  showDate: Boolean,
  allowCreate: Boolean,
  allowClaim: { type: Boolean, default: true },
})
defineEmits(['see-all', 'retry', 'claim', 'create'])
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
      <MobileTaskCard
        v-for="task in tasks"
        :key="task._id"
        :task="task"
        :busy-id="busyId"
        :show-date="showDate"
        :allow-claim="allowClaim"
        @claim="$emit('claim', $event)"
      />
    </div>
  </section>
</template>
