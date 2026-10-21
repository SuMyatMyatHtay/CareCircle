<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
import NotificationToggle from './NotificationToggle.vue'
defineProps({
  preview: Boolean,
  preferences: { type: Object, required: true },
  inviteCode: { type: String, default: '' },
})
defineEmits(['change'])
const events = [
  { key: 'taskPosted', label: 'A task is posted' },
  { key: 'taskClaimed', label: 'Someone claims or gives back a task' },
  { key: 'transitMilestone', label: 'A transit milestone is marked' },
  { key: 'careNote', label: 'A note or medication change is added' },
  { key: 'taskCompleted', label: 'A task is completed' },
]
const reminders = [
  { key: 'beforeTask', label: 'Remind me 1 hour before a task I’ve claimed' },
  { key: 'dailySummary', label: 'Daily summary at 8am' },
]
</script>
<template>
  <SectionCard title="Telegram group" class="care-telegram-card">
    <template #actions>
      <span
        class="care-pill"
        :class="preview ? 'care-pill--green' : 'care-pill--neutral'"
      >
        {{ preview ? 'Linked · sample' : 'Not linked' }}
      </span>
    </template>
    <p class="care-muted care-small">
      {{
        preview
          ? 'Updates go to “Tan Family” · linked by Alex on 11 Sep'
          : 'Telegram updates will be available once the family bot integration is connected.'
      }}
    </p>
    <p v-if="preview" class="care-muted care-tiny">
      To link a new group: add @CareCircleBot, then send /link {{ inviteCode }}
    </p>
    <p v-if="preview" class="care-preview-disclaimer">
      Sample preferences are saved on this device. No Telegram messages are
      sent.
    </p>
    <h3 class="care-settings-label">SEND TO TELEGRAM WHEN…</h3>
    <NotificationToggle
      v-for="option in events"
      :key="option.key"
      :label="option.label"
      :checked="preferences[option.key]"
      :disabled="!preview"
      @change="$emit('change', option.key, $event)"
    />
    <h3 class="care-settings-label">REMINDERS</h3>
    <NotificationToggle
      v-for="option in reminders"
      :key="option.key"
      :label="option.label"
      :checked="preferences[option.key]"
      :disabled="!preview"
      @change="$emit('change', option.key, $event)"
    />
  </SectionCard>
</template>
