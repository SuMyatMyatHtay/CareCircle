<script setup>
// Owner: Chaithra (E)
// "Add to calendar" pop-up: pick Google Calendar, Apple Calendar or Outlook and the
// app opens with the task filled in. One task shows big buttons; several tasks
// (My Tasks → "Add to calendar") show a list with the three buttons on each row.
//   <AddToCalendar v-model="calendarOpen" :tasks="[task]" />
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { googleCalendarUrl, outlookCalendarUrl, openInAppleCalendar } from '../utils/calendarLinks.js'
import { formatDay, formatTime } from '../../my-tasks/utils/formatters.js'
import { getGoogleStatus } from '../../my-tasks/services/googleCalendarApi.js'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    tasks: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const closeButton = ref(null)
// With Google Calendar auto-sync on, claimed tasks are already in Google Calendar
const googleSynced = ref(false)
let myId = ''
try { myId = JSON.parse(sessionStorage.getItem('user') || '{}').id || '' } catch { myId = '' }
// Only tasks I've claimed are synced
function isSynced(task) {
    const claimer = task?.claimedBy?._id || task?.claimedBy
    return googleSynced.value && Boolean(myId) && String(claimer) === myId &&
        ['claimed', 'in_progress', 'completed'].includes(task.status)
}
const single = computed(() => (props.tasks.length === 1 ? props.tasks[0] : null))

function when(task) {
    return `${formatDay(task.startAt)} · ${formatTime(task.startAt)}`
}
function where(task) {
    return task.location?.name || task.location?.address || ''
}

function close() {
    emit('update:modelValue', false)
}
function onKey(event) {
    if (event.key === 'Escape') close()
}

watch(() => props.modelValue, async (open) => {
    if (open) {
        getGoogleStatus().then((s) => { googleSynced.value = Boolean(s.connected) }).catch(() => {})
        document.addEventListener('keydown', onKey)
        await nextTick()
        closeButton.value?.focus()
    } else {
        document.removeEventListener('keydown', onKey)
    }
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
    <Teleport to="body">
        <div v-if="modelValue" class="cal-backdrop" @click.self="close">
            <div class="cal-sheet" role="dialog" aria-modal="true" aria-labelledby="cal-title">
                <header class="cal-head">
                    <h2 id="cal-title">Add to calendar</h2>
                    <button ref="closeButton" type="button" class="cal-close" aria-label="Close" @click="close">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </header>

                <p v-if="!tasks.length" class="cal-empty">No upcoming tasks to add.</p>

                <!-- One task: big app buttons -->
                <template v-else-if="single">
                    <div class="cal-task">
                        <strong>{{ single.title }}</strong>
                        <span>{{ when(single) }}<template v-if="where(single)"> · {{ where(single) }}</template></span>
                    </div>

                    <div class="cal-apps">
                        <div v-if="isSynced(single)" class="cal-app synced">
                            <span class="cal-icon google"><i class="bi bi-google" aria-hidden="true"></i></span>
                            <span class="synced-text">
                                Google Calendar
                                <small>Already added automatically (sync is on)</small>
                            </span>
                            <i class="bi bi-check-circle-fill go" aria-hidden="true"></i>
                        </div>
                        <a v-else :href="googleCalendarUrl(single)" target="_blank" rel="noopener" class="cal-app" @click="close">
                            <span class="cal-icon google"><i class="bi bi-google" aria-hidden="true"></i></span>
                            Google Calendar
                            <i class="bi bi-arrow-up-right go" aria-hidden="true"></i>
                        </a>
                        <button type="button" class="cal-app" @click="openInAppleCalendar(single); close()">
                            <span class="cal-icon apple"><i class="bi bi-apple" aria-hidden="true"></i></span>
                            Apple Calendar
                            <i class="bi bi-arrow-up-right go" aria-hidden="true"></i>
                        </button>
                        <a :href="outlookCalendarUrl(single)" target="_blank" rel="noopener" class="cal-app" @click="close">
                            <span class="cal-icon outlook"><i class="bi bi-microsoft" aria-hidden="true"></i></span>
                            Outlook
                            <i class="bi bi-arrow-up-right go" aria-hidden="true"></i>
                        </a>
                    </div>
                    <p class="cal-hint">Opens your calendar with the time and place filled in. Just tap Save.</p>
                </template>

                <!-- Several tasks: one row each -->
                <template v-else>
                    <p class="cal-hint top">
                        Your upcoming tasks. Tap an app to add that task.
                        <template v-if="googleSynced"> They're already in Google Calendar (sync is on).</template>
                    </p>
                    <ul class="cal-list">
                        <li v-for="task in tasks" :key="task._id">
                            <span class="cal-row-text">
                                <strong>{{ task.title }}</strong>
                                <span>{{ when(task) }}<template v-if="task.family?.name"> · {{ task.family.name }}</template></span>
                            </span>
                            <span class="cal-row-apps">
                                <a :href="googleCalendarUrl(task)" target="_blank" rel="noopener" class="cal-mini google" :aria-label="`Add ${task.title} to Google Calendar`" title="Google Calendar">
                                    <i class="bi bi-google" aria-hidden="true"></i>
                                </a>
                                <button type="button" class="cal-mini apple" :aria-label="`Add ${task.title} to Apple Calendar`" title="Apple Calendar" @click="openInAppleCalendar(task)">
                                    <i class="bi bi-apple" aria-hidden="true"></i>
                                </button>
                                <a :href="outlookCalendarUrl(task)" target="_blank" rel="noopener" class="cal-mini outlook" :aria-label="`Add ${task.title} to Outlook`" title="Outlook">
                                    <i class="bi bi-microsoft" aria-hidden="true"></i>
                                </a>
                            </span>
                        </li>
                    </ul>
                </template>

                <button type="button" class="cal-cancel" @click="close">Cancel</button>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
/* Same tokens as the Figma: green var(--theme-green, #2f7a3f), text var(--theme-text, #2e2e2e) / var(--theme-muted, #6b7280), border var(--theme-border, #e5e7eb) */
.cal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(17, 24, 39, 0.45);
}

.cal-sheet {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    max-width: 420px;
    max-height: calc(100vh - 32px);
    padding: 20px;
    border-radius: 16px;
    background: var(--theme-panel, white);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    font-family: Nunito, Inter, system-ui, sans-serif;
    color: var(--theme-text, #2e2e2e);
}

.cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.cal-head h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
}

.cal-close {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: var(--theme-neutral, #f3f4f6);
    color: var(--theme-text, #374151);
}

.cal-task {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--theme-soft, #e8f5e9);
}

.cal-task strong {
    font-size: 16px;
}

.cal-task span,
.cal-row-text span {
    font-size: 14px;
    color: var(--theme-muted, #5b6470);
}

.cal-apps {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cal-app {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 12px;
    background: var(--theme-panel, white);
    font-family: inherit;
    font-size: 16px;
    font-weight: 700;
    color: var(--theme-text, #2e2e2e);
    text-align: left;
    text-decoration: none;
}

.cal-app:hover,
.cal-app:focus-visible {
    border-color: var(--theme-green, #2f7a3f);
    background: var(--theme-soft, #f6fbf6);
}

.cal-app.synced {
    border-color: var(--theme-accent-border, #cfe8d3);
    background: var(--theme-soft, #f6fbf6);
}

.cal-app.synced .go {
    color: var(--theme-green, #2f7a3f);
}

.synced-text {
    display: flex;
    flex-direction: column;
}

.synced-text small {
    font-size: 12px;
    font-weight: 500;
    color: var(--theme-green, #2f7a3f);
}

.cal-app .go {
    margin-left: auto;
    color: var(--theme-muted, #6b7280);
}

.cal-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 17px;
}

.google { background: #e8f0fe; color: #1a73e8; }
.apple { background: var(--theme-neutral, #f3f4f6); color: #111827; }
.outlook { background: #e5f1fb; color: #0f6cbd; }

.cal-hint {
    margin: 0;
    font-size: 13px;
    color: var(--theme-muted, #6b7280);
}

.cal-hint.top {
    margin-top: -6px;
}

.cal-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 12px;
}

.cal-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
}

.cal-list li + li {
    border-top: 1px solid var(--theme-border, #e5e7eb);
}

.cal-row-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.cal-row-text strong {
    overflow: hidden;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cal-row-apps {
    display: flex;
    gap: 6px;
}

.cal-mini {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    text-decoration: none;
}

.cal-empty {
    margin: 0;
    color: var(--theme-muted, #6b7280);
}

.cal-cancel {
    padding: 12px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 10px;
    background: var(--theme-panel, white);
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    color: var(--theme-text, #374151);
}

/* Phones: slides up from the bottom */
@media (max-width: 767px) {
    .cal-backdrop {
        align-items: flex-end;
        padding: 0;
    }

    .cal-sheet {
        max-width: none;
        max-height: 85vh;
        border-radius: 18px 18px 0 0;
        padding-bottom: calc(20px + env(safe-area-inset-bottom));
    }
}
</style>
