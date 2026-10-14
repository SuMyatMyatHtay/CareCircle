<script setup>
import CareAvatar from '../../../components/common/CareAvatar.vue'
defineProps({
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
</script>
<template>
  <article class="care-recipient-card">
    <div class="care-recipient-heading">
      <CareAvatar :person="recipient" />
      <div>
        <h3>{{ recipient.nickname || recipient.name }}</h3>
        <p>
          {{
            careLabels[recipient.careType] ||
            recipient.careType ||
            'Care recipient'
          }}
          <template v-if="recipient.mobility || recipient.careNotes">
            · {{ recipient.mobility || recipient.careNotes }}
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
