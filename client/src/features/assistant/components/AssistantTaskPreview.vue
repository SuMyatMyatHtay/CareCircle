<script setup>
import { computed } from 'vue'
const props = defineProps({ proposal: { type: Object, required: true }, state: { type: String, default: 'pending' }, busy: Boolean })
defineEmits(['confirm', 'dismiss'])
const labels = { title: 'Task', recipient: 'For', startAt: 'Starts', endAt: 'Ends', location: 'Location', category: 'Category', needsTransit: 'Transport', description: 'Notes' }
function format(field, task) {
  const value = task?.[field]
  if (field === 'recipient') return task?.recipientName || 'Household'
  if (field === 'startAt' || field === 'endAt') return value ? new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No end time'
  if (field === 'location') return [value?.name, value?.address, value?.postal].filter(Boolean).join(', ') || 'No location'
  if (field === 'needsTransit') return value ? 'Transport needed' : 'No transport needed'
  return value || 'None'
}
const rows = computed(() => Object.keys(labels).filter(field => props.proposal.action === 'update'
  ? Object.hasOwn(props.proposal.changes, field)
  : !['description', 'endAt'].includes(field) || props.proposal.task[field]).map(field => ({
    label: labels[field], before: props.proposal.before ? format(field, props.proposal.before) : '', after: format(field, props.proposal.task)
  })))
</script>
<template>
  <div class="assistant-task-preview">
    <div class="preview-label"><i class="bi bi-calendar-check" aria-hidden="true"></i> {{ proposal.action === 'create' ? 'New task' : 'Task changes' }}</div>
    <h3>{{ proposal.task.title }}</h3>
    <dl><div v-for="row in rows" :key="row.label"><dt>{{ row.label }}</dt><dd><span v-if="proposal.action === 'update' && row.before !== row.after" class="preview-before">{{ row.before }}</span>{{ row.after }}</dd></div></dl>
    <p class="preview-timezone">Times shown in Singapore time.</p>
    <div v-if="state === 'pending'" class="preview-actions"><button type="button" :disabled="busy" @click="$emit('dismiss')">Dismiss</button><button type="button" class="preview-confirm" :disabled="busy" @click="$emit('confirm')">{{ busy ? 'Please wait…' : proposal.action === 'create' ? 'Confirm task' : 'Confirm changes' }}</button></div>
    <p v-else class="preview-state" role="status">{{ ({ saved: '✓ Saved to your family’s tasks', cancelled: 'Dismissed · no changes saved', replaced: 'Replaced by your next message', unavailable: 'No longer available · please prepare a new proposal' })[state] }}</p>
  </div>
</template>
<style scoped>
.assistant-task-preview { padding: 16px; border: 1px solid var(--theme-accent-border, #b9d6c0); background: var(--theme-panel, #fff); border-radius: 16px; margin-top: 10px; }
.preview-label { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--theme-green, #246e58); }
h3 { font-size: 16px; font-weight: 750; margin: 10px 0 14px; }
dl { margin: 0; font-size: 12px; } dl > div { display: grid; grid-template-columns: 70px 1fr; gap: 10px; padding: 5px 0; } dt { font-weight: 500; color: var(--theme-muted, #6d7b75); } dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.preview-before { display: block; text-decoration: line-through; color: var(--theme-muted, #6d7b75); margin-bottom: 3px; }
.preview-timezone { font-size: 10px; color: var(--theme-muted, #6d7b75); margin: 12px 0; }
.preview-actions { display: flex; justify-content: flex-end; gap: 8px; } button { padding: 9px 12px; border: 1px solid var(--theme-border, #dce7df); border-radius: 10px; background: var(--theme-panel, #fff); color: inherit; font-size: 12px; font-weight: 650; } .preview-confirm { background: #2d7d43; border-color: #2d7d43; color: white; } button:disabled { opacity: .6; }
.preview-state { margin: 12px 0 0; font-size: 12px; color: var(--theme-green, #246e58); }
</style>
