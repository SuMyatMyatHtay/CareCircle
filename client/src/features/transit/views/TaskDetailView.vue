<script setup>
// Figma "05 · Task detail" (D · Task Management + E). Route: /families/:familyId/tasks/:taskId
//
// TEMPORARY SHELL built by Chaithra (E) so the E parts can be used and demoed before
// Marcus (D) builds the real Task Detail page. When D's page exists, he keeps:
//   <TaskLocationCard :location="task.location" />                    (E: OneMap)
//   <TaskTransitActions :task="task" :family-id="familyId" ...>        (E: transit + Google Calendar)
// and this file + its route can be deleted.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import TaskLocationCard from '../components/TaskLocationCard.vue'
import TaskTransitActions from '../components/TaskTransitActions.vue'
import PersonAvatar from '../../my-tasks/components/PersonAvatar.vue'
import TaskDetailMobile from '../components/TaskDetailMobile.vue'
import { useIsMobile } from '../../my-tasks/utils/useIsMobile.js'
import { startTask } from '../../my-tasks/services/myTasksApi.js'
import { getTask } from '../services/transitApi.js'
import { claimTask, unclaimTask, completeTask, deleteTask, getErrorMessage } from '../../my-tasks/services/myTasksApi.js'
import { formatTime, recipientName, TIME_ZONE } from '../../my-tasks/utils/formatters.js'

const props = defineProps({
    familyId: { type: String, required: true },
    taskId: { type: String, required: true }
})

const router = useRouter()
const isMobile = useIsMobile()

const task = ref(null)
const isLoading = ref(true)
const loadError = ref('')
const notice = ref('')
const actionError = ref('')
const isBusy = ref(false)

let me = {}
try { me = JSON.parse(sessionStorage.getItem('user') || '{}') } catch { me = {} }

const idOf = (value) => (value && typeof value === 'object' ? value._id : value)
const isClaimer = computed(() => Boolean(me.id) && idOf(task.value?.claimedBy) === me.id)
const status = computed(() => task.value?.status)
const who = computed(() => recipientName(task.value))
const claimerName = computed(() => task.value?.claimedBy?.name || '')
const claimerFirst = computed(() => claimerName.value.split(' ')[0])

const CATEGORY_LABELS = {
    appointment: 'Appointment', therapy: 'Therapy', errand: 'Errand', groceries: 'Groceries',
    childcare: 'Childcare', medication: 'Medication', companionship: 'Companionship', other: 'Other'
}
const STATUS_LABELS = {
    open: 'Available', claimed: 'Claimed', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled'
}

const dayText = computed(() => new Date(task.value.startAt).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE
}))
const timeText = computed(() => {
    const start = formatTime(task.value.startAt)
    return task.value.endAt ? `${start} – ${formatTime(task.value.endAt)}` : start
})

// Available → Claimed by Jasmine → Completed
const flow = computed(() => {
    const s = status.value
    const reached = { open: 0, claimed: 1, in_progress: 1, completed: 2 }[s] ?? -1
    const middle = s === 'in_progress'
        ? `In progress${claimerFirst.value ? ` · ${claimerFirst.value}` : ''}`
        : claimerFirst.value ? `Claimed by ${claimerFirst.value}` : 'Claimed'
    return [
        { label: 'Available', state: reached > 0 ? 'done' : reached === 0 ? 'current' : 'todo' },
        { label: middle, state: reached > 1 ? 'done' : reached === 1 ? 'current' : 'todo' },
        { label: 'Completed', state: reached === 2 ? 'current' : 'todo' }
    ]
})

const shortDate = (value) => new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: TIME_ZONE
})
const activity = computed(() => {
    const t = task.value
    const items = []
    if (t.completedAt) items.push({ name: claimerName.value, text: `${claimerFirst.value || 'Someone'} completed this · ${shortDate(t.completedAt)}` })
    if (t.claimedAt && t.claimedBy) items.push({ name: claimerName.value, text: `${claimerFirst.value} claimed this · ${shortDate(t.claimedAt)}` })
    if (t.createdBy) items.push({ name: t.createdBy.name, text: `${t.createdBy.name} created this · ${shortDate(t.createdAt)}` })
    return items
})

async function load() {
    isLoading.value = true
    loadError.value = ''
    try {
        task.value = await getTask(props.familyId, props.taskId)
    } catch (error) {
        loadError.value = getErrorMessage(error)
    } finally {
        isLoading.value = false
    }
}

async function run(action, message) {
    isBusy.value = true
    actionError.value = ''
    try {
        await action()
        if (message) notice.value = message
        await load()
    } catch (error) {
        actionError.value = getErrorMessage(error)
        if ([404, 409].includes(error.response?.status)) await load()
    } finally {
        isBusy.value = false
    }
}

const claim = () => run(() => claimTask(props.familyId, props.taskId), 'You claimed this task.')
const markDone = () => {
    if (window.confirm(`Mark "${task.value.title}" as done?`)) run(() => completeTask(props.familyId, props.taskId), 'Marked as done.')
}
const giveBack = () => {
    if (window.confirm(`Give back "${task.value.title}"? It goes back to the family as available.`)) {
        run(() => unclaimTask(props.familyId, props.taskId), 'Given back to the family.')
    }
}
async function remove() {
    if (!window.confirm(`Delete "${task.value.title}"? This can't be undone.`)) return
    isBusy.value = true
    try {
        await deleteTask(props.familyId, props.taskId)
        router.push({ name: 'home' })
    } catch (error) {
        actionError.value = getErrorMessage(error)
    } finally {
        isBusy.value = false
    }
}

function openTrip() {
    router.push({ name: 'transit', params: { familyId: props.familyId, taskId: props.taskId } })
}

function startTrip() {
    run(async () => {
        await startTask(props.familyId, props.taskId)
        openTrip()
    })
}

onMounted(load)
watch(() => [props.familyId, props.taskId], load)
</script>

<template>
    <!-- Phones: Figma "Mobile prototype" → 09 · Task detail -->
    <div v-if="isMobile">
        <p v-if="isLoading && !task" class="status" role="status">Loading task...</p>
        <p v-else-if="loadError" class="status is-error" role="alert">{{ loadError }}</p>
        <TaskDetailMobile
            v-else-if="task"
            :task="task"
            :family-id="familyId"
            :is-claimer="isClaimer"
            :is-busy="isBusy"
            :notice="notice"
            :action-error="actionError"
            @back="router.back()"
            @start="startTrip"
            @open-trip="openTrip"
            @complete="markDone"
            @unclaim="giveBack"
            @claim="claim"
            @edit="notice = 'Editing comes with the task form (Task Management).'"
            @delete="remove"
            @dismiss="notice = ''"
        />
    </div>

    <!-- Laptops: Figma "Web wireframes" → 05 · Task detail -->
    <div v-else class="task-detail-page">
        <nav class="breadcrumb-row" aria-label="Breadcrumb">
            <RouterLink to="/home">Family home</RouterLink>
            <span>/</span>
            <span>{{ who || 'Household' }}</span>
            <span>/</span>
            <RouterLink to="/my-tasks">Tasks</RouterLink>
            <span>/</span>
            <span class="current">{{ task?.title || 'Task' }}</span>
        </nav>

        <div v-if="isLoading && !task" class="status" role="status">
            <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
            Loading task...
        </div>

        <div v-else-if="loadError" class="status is-error" role="alert">
            <span>{{ loadError }}</span>
            <button type="button" class="btn-secondary" @click="load">Try again</button>
        </div>

        <div v-else-if="task" class="columns">
            <!-- Task card -->
            <article class="card task-card">
                <div class="top-bar">
                    <div class="tags">
                        <span class="badge tag-purple">{{ CATEGORY_LABELS[task.category] || 'Task' }}</span>
                        <span v-if="task.needsTransit" class="badge tag-yellow">Needs transport</span>
                        <span class="badge" :class="`status-${status}`">{{ STATUS_LABELS[status] }}</span>
                    </div>
                    <span class="spacer"></span>
                    <!-- D (Marcus) owns editing; the task form isn't built yet -->
                    <button type="button" class="btn-secondary" @click="notice = 'Editing comes with the task form (Task Management).'">Edit</button>
                    <button type="button" class="btn-secondary danger" :disabled="isBusy" @click="remove">Delete</button>
                </div>

                <h1>{{ task.title }}</h1>

                <ol class="flow" aria-label="Status">
                    <template v-for="(step, index) in flow" :key="step.label">
                        <li v-if="index > 0" class="arrow" aria-hidden="true">→</li>
                        <li class="badge flow-step" :class="`flow-${step.state}`">
                            <template v-if="step.state === 'done'">✓ </template>
                            <template v-else-if="step.state === 'current'">● </template>{{ step.label }}
                        </li>
                    </template>
                </ol>

                <div class="when">
                    <i class="bi bi-calendar3" aria-hidden="true"></i>
                    <span>{{ dayText }}</span>
                    <i class="bi bi-clock" aria-hidden="true"></i>
                    <span>{{ timeText }}</span>
                </div>

                <div class="people">
                    <div class="person">
                        <PersonAvatar :name="who" :size="36" />
                        <span><small>FOR</small><strong>{{ who || 'Household' }}</strong></span>
                    </div>
                    <div v-if="claimerName" class="person">
                        <PersonAvatar :name="claimerName" :size="36" tone="peach" />
                        <span><small>TAKEN BY</small><strong>{{ claimerFirst }}</strong></span>
                    </div>
                </div>

                <!-- E: OneMap location -->
                <TaskLocationCard :location="task.location" />

                <p v-if="task.description" class="description">{{ task.description }}</p>

                <div v-if="notice" class="notice" role="status">
                    {{ notice }}
                    <button type="button" class="notice-close" aria-label="Dismiss" @click="notice = ''">×</button>
                </div>
                <div v-if="actionError" class="notice is-error" role="alert">{{ actionError }}</div>

                <!-- E: transit + Google Calendar, with D's buttons in the slots -->
                <TaskTransitActions :task="task" :family-id="familyId" @changed="load" @error="(m) => (actionError = m)">
                    <template #middle>
                        <button v-if="status === 'open'" type="button" class="btn-secondary" :disabled="isBusy" @click="claim">
                            I'll take it
                        </button>
                        <button
                            v-if="isClaimer && ['claimed', 'in_progress'].includes(status)"
                            type="button"
                            class="btn-secondary"
                            :disabled="isBusy"
                            @click="markDone"
                        >
                            ✓ Mark as done
                        </button>
                    </template>
                    <template #end>
                        <button v-if="isClaimer && status === 'claimed'" type="button" class="btn-secondary" :disabled="isBusy" @click="giveBack">
                            Give back task
                        </button>
                    </template>
                </TaskTransitActions>
            </article>

            <!-- Right column -->
            <aside class="side">
                <!-- C (Jhen): filled from the recipient's profile once recipients exist -->
                <section class="card before-you-go">
                    <h2><i class="bi bi-exclamation-triangle" aria-hidden="true"></i> Before you go</h2>
                    <p v-if="!who">Care notes show here when the task is for a care recipient.</p>
                    <p v-else>Care notes for {{ who }} will show here from their profile.</p>
                </section>

                <!-- F (SeungHak): consultation notes -->
                <section class="card">
                    <h2>Notes from this visit</h2>
                    <p class="muted">No notes yet. Whoever goes can add what the doctor said, so the family doesn't need to ask.</p>
                    <button type="button" class="btn-secondary" @click="notice = 'Consultation notes are part of Care Logs, which is coming soon.'">
                        + Add consultation note
                    </button>
                </section>

                <section class="card">
                    <h2>Activity</h2>
                    <ul class="activity">
                        <li v-for="item in activity" :key="item.text">
                            <PersonAvatar :name="item.name" :size="28" tone="peach" />
                            <span>{{ item.text }}</span>
                        </li>
                    </ul>
                </section>
            </aside>
        </div>
    </div>
</template>

<style scoped>
/* Values from Figma file "CareCircle Wireframe", frame 05 · Task detail */
.task-detail-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    color: #2e2e2e;
}

.breadcrumb-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    color: #6b7280;
}

.breadcrumb-row a {
    color: #6b7280;
}

.breadcrumb-row a:hover {
    color: #2f7a3f;
}

.status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 18px 4px;
    font-size: 14px;
    color: #6b7280;
}

.status .spinner-border {
    color: #2f7a3f;
}

.status.is-error {
    color: #a33a26;
}

.columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 24px;
    align-items: start;
}

.card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    background: white;
}

.task-card {
    gap: 20px;
    padding: 28px;
}

.top-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.spacer {
    flex: 1;
}

.badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    font-weight: 500;
    white-space: nowrap;
}

.tag-purple { background: #eee8fd; color: #4b3b8f; }
.tag-yellow { background: #fff8e1; color: #7a5a00; }
.status-open,
.status-claimed { background: #e8f5e9; color: #2f7a3f; }
.status-in_progress { background: #2f7a3f; color: white; }
.status-completed,
.status-cancelled { background: #f3f4f1; color: #6b7280; }

h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: 0.15px;
    font-weight: 700;
    color: #2e2e2e;
}

.flow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.arrow {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
}

.flow-done { background: #f3f4f1; color: #6b7280; }
.flow-current { background: #2f7a3f; color: white; }
.flow-todo { background: white; color: #6b7280; }

.when {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.08px;
    font-weight: 500;
}

.when .bi {
    font-size: 17px;
    color: #6b7280;
}

.people {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.person {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px 8px 8px;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    background: #fbfbf7;
}

.person span {
    display: flex;
    flex-direction: column;
}

.person small {
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    color: #6b7280;
}

.person strong {
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    color: #2e2e2e;
}

.description {
    margin: 0;
    max-width: 640px;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.08px;
}

.btn-secondary {
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    color: #1f2937;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    white-space: nowrap;
}

.btn-secondary:hover {
    background: #f9fafb;
}

.btn-secondary.danger {
    color: #9a3a2a;
}

button:disabled {
    opacity: 0.6;
}

.notice {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid #ffe6a3;
    border-radius: 12px;
    background: #fff8e1;
    font-size: 14px;
    color: #7a5a00;
}

.notice.is-error {
    border-color: #ffd2c8;
    background: #ffe9e4;
    color: #a33a26;
}

.notice-close {
    border: none;
    background: none;
    color: inherit;
    font-size: 18px;
    line-height: 1;
}

/* Right column */
.side {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.side h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.08px;
    font-weight: 600;
    color: #2e2e2e;
}

.side p {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
}

.side .btn-secondary {
    align-self: flex-start;
}

.muted {
    color: #6b7280;
}

.before-you-go {
    border-color: #ffe6a3;
    background: #fff8e1;
}

.before-you-go h2 {
    color: #7a5a00;
}

.activity {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.activity li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    line-height: 20px;
    color: #6b7280;
}

@media (max-width: 991px) {
    .columns {
        grid-template-columns: 1fr;
    }

    .task-card {
        padding: 20px;
    }
}
</style>
