<script setup>
// Owner: Chaithra (E). The E part of Figma "05 · Task detail" (D · Task Management + E).
// - Live strip: latest milestone of the trip + "Update milestone" (while in transit)
// - "Start transit mode" (claimer, claimed, needs transport) / "Open transit mode" / "View journey"
// - "Add to calendar" (pop-up: Google / Apple / Outlook)
// D's own buttons (Mark as done, Give back task) go in the slots so the row keeps the Figma order:
//   <TaskTransitActions :task="task" :family-id="familyId" @changed="reload">
//     <template #middle>  ✓ Mark as done  </template>
//     <template #end>     Give back task  </template>
//   </TaskTransitActions>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getTransitSession } from '../services/transitApi.js'
import { startTask, getErrorMessage } from '../../my-tasks/services/myTasksApi.js'
import { formatTime } from '../../my-tasks/utils/formatters.js'
import AddToCalendar from './AddToCalendar.vue'
import { WORDS } from '../utils/wording.js'

const props = defineProps({
    task: { type: Object, required: true },
    familyId: { type: String, required: true }
})
const emit = defineEmits(['changed', 'error'])

const router = useRouter()
const session = ref(null)
const calendarOpen = ref(false)
const isBusy = ref(false)

let me = {}
try { me = JSON.parse(sessionStorage.getItem('user') || '{}') } catch { me = {} }

const idOf = (value) => (value && typeof value === 'object' ? value._id : value)
const isClaimer = computed(() => Boolean(me.id) && idOf(props.task.claimedBy) === me.id)
const latest = computed(() => {
    const steps = session.value?.milestones || []
    return steps[steps.length - 1] || null
})
const isLive = computed(() => session.value?.status === 'active')

// Which transit button to show
const transitButton = computed(() => {
    if (!props.task.needsTransit) return null
    if (session.value) return isLive.value ? 'open' : 'view'
    if (props.task.status === 'claimed' && isClaimer.value) return 'start'
    return null
})

async function loadSession() {
    if (!props.task?.needsTransit) {
        session.value = null
        return
    }
    try {
        session.value = await getTransitSession(props.familyId, props.task._id)
    } catch {
        session.value = null
    }
}

function openTransit() {
    router.push({ name: 'transit', params: { familyId: props.familyId, taskId: props.task._id } })
}

async function startTransit() {
    isBusy.value = true
    try {
        await startTask(props.familyId, props.task._id)
        emit('changed')
        openTransit()
    } catch (error) {
        emit('error', getErrorMessage(error))
    } finally {
        isBusy.value = false
    }
}

watch(() => [props.task?._id, props.task?.status], loadSession, { immediate: true })
</script>

<template>
    <div class="transit-actions">
        <!-- Live strip while someone is in transit -->
        <div v-if="session && latest" class="live-strip" :class="{ ended: !isLive }">
            <span class="badge" :class="isLive ? 'badge-live' : 'badge-ended'">{{ isLive ? `● ${WORDS.live}` : WORDS.ended }}</span>
            <span class="live-text">
                <strong>{{ latest.label }}</strong>
                <small>{{ formatTime(latest.at) }} · {{ session.milestones.length }} update{{ session.milestones.length === 1 ? '' : 's' }}</small>
            </span>
            <button v-if="isLive" type="button" class="btn-secondary" @click="openTransit">Post an update</button>
        </div>

        <div class="buttons">
            <button
                v-if="transitButton === 'start'"
                type="button"
                class="btn-primary-lg"
                :disabled="isBusy"
                @click="startTransit"
            >
                {{ WORDS.startTrip }}
            </button>
            <button v-else-if="transitButton === 'open'" type="button" class="btn-primary-lg" @click="openTransit">
                {{ WORDS.openTrip }}
            </button>

            <slot name="middle"></slot>

            <button type="button" class="btn-secondary" @click="calendarOpen = true">
                <i class="bi bi-calendar-plus" aria-hidden="true"></i> {{ WORDS.addToCalendar }}
            </button>

            <button v-if="transitButton === 'view'" type="button" class="btn-secondary" @click="openTransit">
                {{ WORDS.viewTrip }}
            </button>

            <slot name="end"></slot>
        </div>

        <AddToCalendar v-model="calendarOpen" :tasks="[task]" />
    </div>
</template>

<style scoped>
.transit-actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
}

.live-strip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--theme-soft, #e8f5e9);
}

.live-strip.ended {
    background: var(--theme-page, #f3f4f1);
}

.live-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 160px;
}

.live-text strong {
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    color: var(--theme-text, #2e2e2e);
}

.live-text small {
    font-size: 12px;
    line-height: 16px;
    color: var(--theme-muted, #6b7280);
}

.badge {
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    font-weight: 500;
    white-space: nowrap;
}

.badge-live {
    background: var(--theme-green, #2f7a3f);
    color: white;
}

.badge-ended {
    background: var(--theme-panel, white);
    color: var(--theme-muted, #6b7280);
}

.buttons {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
}

/* Large button (Buttons page: _button-large, 20px padding) */
.btn-primary-lg {
    padding: 20px;
    border: 1px solid var(--theme-accent-border, #2f7a3f);
    border-radius: 8px;
    background: var(--theme-green, #2f7a3f);
    color: white;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    white-space: nowrap;
}

.btn-primary-lg:hover {
    background: #286a36;
}

.btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 12px 16px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 8px;
    background: var(--theme-panel, white);
    color: var(--theme-blue, #1f2937);
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    white-space: nowrap;
    text-decoration: none;
}

.btn-secondary:hover {
    background: var(--theme-page, #f9fafb);
    color: var(--theme-blue, #1f2937);
}

button:disabled {
    opacity: 0.6;
}
</style>
