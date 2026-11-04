<script setup>
import { computed, ref } from 'vue'
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
  { key: 'taskPosted', label: 'A task is posted, edited or removed' },
  { key: 'taskClaimed', label: 'Someone claims or gives back a task' },
  { key: 'transitMilestone', label: 'A transit milestone is marked' },
  { key: 'careNote', label: 'A care note is added, edited or deleted, or medication changes' },
  { key: 'taskCompleted', label: 'A task is started, completed or cancelled' },
]
const reminders = [
  { key: 'beforeTask', label: 'Remind me 1 hour before a task I’ve claimed' },
  { key: 'unclaimedTask', label: 'Alert the group if a task is still unclaimed 24 hours before' },
  { key: 'dailySummary', label: 'Daily summary at 8am' },
]

const familyId = computed(() => (props.preview ? '' : workspace.selectedFamilyId.value || ''))
const live = computed(() => Boolean(familyId.value))
const isAdmin = computed(() => workspace.isAdmin.value)
const telegram = useTelegramSettings(() => familyId.value)
const { loading, saving, testing, error, feedback, linked, linkedAt, linkedByName, botUsername, groups } = telegram
 
const isOn = (key) => (live.value ? Boolean(groups.value[key]) : Boolean(props.preferences[key]))
// Nothing is sent without a linked group, so its switches stay locked until then
const canEdit = computed(() =>
  live.value ? isAdmin.value && linked.value && !loading.value && !saving.value : props.preview,
)
const lockReason = computed(() => {
  if (!live.value || loading.value) return ''
  if (!linked.value) return 'Link a Telegram group first to choose what gets sent.'
  if (!isAdmin.value) return 'Only family admins can change Telegram settings.'
  return ''
})
 
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
// Opens Telegram to pick a group; Telegram adds the bot and sends it the invite code
const addToGroupUrl = computed(() =>
  live.value && props.inviteCode
    ? `https://t.me/${botUsername.value}?startgroup=${encodeURIComponent(props.inviteCode)}`
    : '',
)
const copied = ref(false)
async function copyCommand() {
  try {
    await navigator.clipboard.writeText(`/link ${props.inviteCode}`)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // No clipboard access: the command is still on screen to type
  }
}

function confirmUnlink() {
  if (window.confirm('Stop sending CareCircle updates to this Telegram group?')) telegram.unlink()
}

const { reminders: reminderState } = telegram
const isReminderOn = (key) => (live.value ? Boolean(reminderState.value[key]) : Boolean(props.preferences[key]))
function onReminderChange(key, value) {
  if (live.value) telegram.toggleReminder(key, value)
  else emit('change', key, value)
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
    <div v-if="showHowToLink" class="care-telegram-link">
      <a
        v-if="addToGroupUrl"
        :href="addToGroupUrl"
        target="_blank"
        rel="noopener"
        class="care-button care-telegram-add"
        data-testid="telegram-add-to-group"
      >
        <i class="bi bi-telegram" aria-hidden="true"></i> Add to Telegram group
      </a>
      <p v-if="addToGroupUrl" class="care-muted care-tiny">
        On a phone: pick your family group and it links by itself, then come back here.
      </p>
      <!-- Telegram Desktop ignores the group picked from the button, so computers add the bot by hand -->
      <p class="care-muted care-tiny">
        {{ addToGroupUrl ? 'On a computer, or if it opens a chat with the bot: add' : 'To link a new group: add' }}
        @{{ botUsername }} to the group, then send:
      </p>
      <div v-if="inviteCode" class="care-telegram-command">
        <code>/link {{ inviteCode }}</code>
        <button type="button" class="care-text-button" data-testid="telegram-copy-link" @click="copyCommand">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
    </div>
    <p v-if="preview" class="care-preview-disclaimer">
      Sample preferences are saved on this device. No Telegram messages are
      sent.
    </p>
    <h3 class="care-settings-label">SEND TO TELEGRAM WHEN…</h3>
    <p v-if="lockReason" class="care-muted care-tiny" data-testid="telegram-lock-reason">{{ lockReason }}</p>
    <NotificationToggle
      v-for="option in events"
      :key="option.key"
      :label="option.label"
      :checked="isOn(option.key)"
      :disabled="!canEdit"
      @change="onChange(option.key, $event)"
    />
    <h3 class="care-settings-label">REMINDERS</h3>
    <NotificationToggle
      v-for="option in reminders"
      :key="option.key"
      :label="option.label"
      :checked="isReminderOn(option.key)"
      :disabled="!canEdit"
      @change="onReminderChange(option.key, $event)"
    />
    
    <p v-if="!live" class="care-muted care-tiny">Reminders are coming soon.</p>
 
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

<style scoped>
.care-telegram-link {
  display: grid;
  justify-items: start;
  gap: 0.35rem;
  margin: 0.75rem 0 0.5rem;
}

.care-telegram-command {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--theme-border, #dfe3e8);
  border-radius: 10px;
}

.care-telegram-command code {
  color: inherit;
  font-size: 0.9rem;
}

.care-telegram-add {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.care-telegram-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
