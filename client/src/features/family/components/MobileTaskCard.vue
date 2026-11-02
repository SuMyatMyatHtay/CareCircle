<script setup>
import { computed } from 'vue'
import ProfileAvatar from '../../../components/common/ProfileAvatar.vue'
import TaskStatusBadge from '../../tasks/components/TaskStatusBadge.vue'
import RecurringTaskBadge from '../../tasks/components/RecurringTaskBadge.vue'
import { useTaskOverdue } from '../../tasks/composables/useTaskOverdue.js'
const props = defineProps({
  task: { type: Object, required: true },
  busyId: { type: String, default: '' },
  showDate: Boolean,
  allowClaim: { type: Boolean, default: true },
})
defineEmits(['claim'])
const overdue = useTaskOverdue(() => props.task)
const recipient = computed(() =>
  typeof props.task.recipient === 'object' && props.task.recipient
    ? props.task.recipient
    : { name: 'Household', avatar: '🏡' },
)
const time = computed(() =>
  new Intl.DateTimeFormat('en-SG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  })
    .format(new Date(props.task.startAt))
    .replace(/\s+/g, ''),
)
const date = computed(() =>
  new Intl.DateTimeFormat('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Singapore',
  }).format(new Date(props.task.startAt)),
)
const context = computed(() =>
  props.task.status === 'open'
    ? 'nobody yet'
    : props.task.status === 'in_progress'
      ? props.task.location?.name || props.task.claimedBy?.name || ''
      : props.task.claimedBy?.name || props.task.location?.name || '',
)
</script>

<template>
  <article
    class="care-mobile-task"
    :class="{ 'care-mobile-task--open': task.status === 'open' }"
  >
    <div class="care-mobile-task-row">
      <ProfileAvatar :person="recipient" recipient size="small" />
      <div class="care-mobile-task-copy">
        <h3>{{ task.title }}</h3>
        <RecurringTaskBadge :task="task" />
        <p>
          <template v-if="showDate">{{ date }} ·</template>
          {{ time }}
          <template v-if="context">· {{ context }}</template>
        </p>
      </div>
      <div v-if="task.status !== 'open'" class="care-mobile-task-status">
        <ProfileAvatar
          v-if="task.claimedBy"
          :person="task.claimedBy"
          size="tiny"
        />
        <TaskStatusBadge
          :status="task.status"
          :needs-transit="task.needsTransit"
        />
      </div>
    </div>
    <p v-if="task.status === 'open' && overdue" class="care-muted care-small">Overdue · Claiming closed</p>
    <button
      v-else-if="task.status === 'open' && allowClaim"
      class="care-mobile-claim"
      :disabled="Boolean(busyId)"
      @click="$emit('claim', task)"
    >
      {{ busyId === task._id ? 'Claiming…' : 'I’ll take it' }}
    </button>
  </article>
</template>
