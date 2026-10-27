<script setup>
import { computed } from 'vue'
import SectionCard from '../../../components/common/SectionCard.vue'
import NotificationToggle from './NotificationToggle.vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useTelegramSettings } from '../composables/useNotifications.js'
 
const props = defineProps({
  preview: Boolean,
  preferences: { type: Object, required: true },
  inviteCode: { type: String, default: '' },
})
const emit = defineEmits(['change'])
const workspace = useFamilyWorkspace()
const events = [
  { key: 'taskPosted', label: 'A task is posted' },
  { key: 'taskClaimed', label: 'Someone claims or gives back a task' },
  { key: 'transitMilestone', label: 'A transit milestone is marked' },
  { key: 'careNote', label: 'A care note is added, edited or deleted, or medication changes' },
  { key: 'taskCompleted', label: 'A task is completed' },
]
const reminders = [
  { key: 'beforeTask', label: 'Remind me 1 hour before a task I’ve claimed' },
  { key: 'dailySummary', label: 'Daily summary at 8am' },
]

const familyId = computed(() => (props.preview ? '' : workspace.selectedFamilyId.value || ''))
const live = computed(() => Boolean(familyId.value))
const isAdmin = computed(() => workspace.isAdmin.value)
const telegram = useTelegramSettings(() => familyId.value)
const { loading, saving, testing, error, feedback, linked, linkedAt, linkedByName, groups } = telegram
 
const isOn = (key) => (live.value ? Boolean(groups.value[key]) : Boolean(props.preferences[key]))
const canEdit = computed(() => (live.value ? isAdmin.value && !loading.value && !saving.value : props.preview))
 
function onChange(key, value) {
  if (live.value) telegram.toggle(key, value)
  else emit('change', key, value)
}
 
const pillText = computed(() => {
  if (props.preview) return 'Linked · sample'
  if (!live.value) return 'Not linked'
  if (loading.value) return 'Checking…'
  return linked.value ? 'Linked' : 'Not linked'
})
const pillGreen = computed(() => props.preview || (live.value && linked.value))
 
const linkedOn = computed(() =>
  linkedAt.value
    ? new Date(linkedAt.value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' })
    : '',
)
const summary = computed(() => {
  if (props.preview) return 'Updates go to “Tan Family” · linked by Alex on 11 Sep'
  if (!live.value) return 'Telegram updates will be available once the family bot integration is connected.'
  if (loading.value) return 'Checking your Telegram group…'
  if (linked.value) {
    const by = linkedByName.value ? ` · linked by ${linkedByName.value}` : ''
    const on = linkedOn.value ? ` on ${linkedOn.value}` : ''
    return `Updates go to your family’s Telegram group${by}${on}`
  }
  return 'No Telegram group is linked yet.'
})
const showHowToLink = computed(() => props.preview || (live.value && !loading.value && !linked.value))
 
function confirmUnlink() {
  if (window.confirm('Stop sending CareCircle updates to this Telegram group?')) telegram.unlink()
}
</script>
<template>
  <SectionCard title="Telegram group" class="care-telegram-card">
    <template #actions>
      <span class="care-pill" :class="pillGreen ? 'care-pill--green' : 'care-pill--neutral'">
        {{ pillText }}
      </span>
    </template>
    <p class="care-muted care-small">{{ summary }}</p>
    <p v-if="showHowToLink" class="care-muted care-tiny">
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
      :disabled="!canEdit"
      @change="onChange(option.key, $event)"
    />
    <h3 class="care-settings-label">REMINDERS</h3>
    <NotificationToggle
      v-for="option in reminders"
      :key="option.key"
      :label="option.label"
      :checked="Boolean(preferences[option.key])"
      :disabled="!preview"
      @change="emit('change', option.key, $event)"
    />
    
    <p v-if="live" class="care-muted care-tiny">Reminders are coming soon.</p>
 
    <div v-if="live && linked && isAdmin" class="care-telegram-actions">
      <button type="button" class="care-button" :disabled="testing" @click="telegram.sendTest()">
        {{ testing ? 'Sending…' : 'Send test message' }}
      </button>
      <button type="button" class="care-text-button" @click="confirmUnlink">Unlink group</button>
    </div>
 
    <p v-if="error" class="care-error" role="alert">{{ error }}</p>
    <p v-else-if="feedback" class="care-feedback" role="status">{{ feedback }}</p>
  </SectionCard>
</template>
