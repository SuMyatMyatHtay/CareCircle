<script setup>
import { computed } from 'vue'
import ProfileAvatar from '../../../components/common/ProfileAvatar.vue'
import { mobilityChip } from '../../recipients/recipientLabels.js'
const props = defineProps({
  recipient: { type: Object, required: true },
  nextTask: { type: String, default: '' },
  openCount: { type: Number, default: 0 },
  tasksAvailable: { type: Boolean, default: true },
})
defineEmits(['open', 'show-open-tasks'])
const careLabels = {
  elderly: 'Elderly care',
  infant: 'Infant',
  baby: 'Infant',
  pregnancy: 'Pregnancy care',
  postpartum: 'Postpartum care',
  recovery: 'Recovery care',
  injury: 'Recovery care',
  other: 'Care recipient',
}
const detail = computed(() => {
  const { mobility, careNotes } = props.recipient
  return typeof mobility === 'object' && mobility
    ? mobility.notes || mobilityChip(mobility.level) || careNotes
    : mobility || careNotes
})
</script>
<template>
  <article class="care-recipient-card">
    <div class="care-recipient-heading">
      <ProfileAvatar :person="recipient" recipient />
      <div>
        <h3>{{ recipient.nickname || recipient.name }}</h3>
        <p>
          {{
            careLabels[recipient.careType] ||
            recipient.careType ||
            'Care recipient'
          }}
          <template v-if="detail">
            · {{ detail }}
          </template>
        </p>
      </div>
    </div>
    <p class="care-recipient-next">
      {{ nextTask ? `Next: ${nextTask}` : 'No upcoming tasks' }}
    </p>
    <div class="care-recipient-footer">
      <button
        v-if="tasksAvailable && openCount"
        class="care-pill care-pill--coral"
        @click="$emit('show-open-tasks', recipient)"
      >
        {{ openCount }} {{ openCount === 1 ? 'needs' : 'need' }} someone
      </button>
      <span v-else class="care-recipient-covered">
        {{ tasksAvailable ? 'All covered' : 'Task status unavailable' }}
      </span>
      <button class="care-text-button" @click="$emit('open', recipient)">
        Open hub
        <i class="bi bi-arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  </article>
</template>
