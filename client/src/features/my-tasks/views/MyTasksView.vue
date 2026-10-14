<script setup>
// Owner: Chaithra (E). Matches Figma frame "10 · My tasks" (CareCircle Wireframe).
// Every task I've claimed, across all my families: Upcoming / In progress / Completed,
// step-by-step progress, and a "due soon" flag for tasks starting within 24 hours.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import MyTaskCard from '../components/MyTaskCard.vue'
import WeekStrip from '../components/WeekStrip.vue'
import MyTasksMobile from '../components/MyTasksMobile.vue'
import { useIsMobile } from '../utils/useIsMobile.js'
import { getMyTasks, startTask, unclaimTask, completeTask, getErrorMessage } from '../services/myTasksApi.js'
import { downloadTasksAsCalendar } from '../utils/calendarExport.js'

const router = useRouter()
const isMobile = useIsMobile()

const TABS = [
    { key: 'claimed', label: 'Upcoming', empty: 'Nothing coming up. Claim a task from Family home.' },
    { key: 'in_progress', label: 'In progress', empty: 'Nothing in progress right now.' },
    { key: 'completed', label: 'Completed', empty: 'No completed tasks yet.' }
]
const DUE_SOON_MS = 24 * 60 * 60 * 1000
const FAMILY_TONES = ['green', 'purple', 'blue', 'orange']

const tasks = ref([])
const activeTab = ref('claimed')
const familyFilter = ref('all')
const expandedId = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const actionError = ref('')
const notice = ref('')
const busyTaskId = ref('')
const now = ref(Date.now())

// Families that appear in my tasks, in a stable order, each with its own pill colour
const families = computed(() => {
    const seen = new Map()
    for (const task of tasks.value) {
        if (task.family?._id && !seen.has(task.family._id)) seen.set(task.family._id, task.family.name)
    }
    return [...seen].map(([id, name], index) => ({ id, name, tone: FAMILY_TONES[index % FAMILY_TONES.length] }))
})
const toneFor = (task) => families.value.find((f) => f.id === task.family?._id)?.tone || 'green'

const filteredTasks = computed(() =>
    familyFilter.value === 'all'
        ? tasks.value
        : tasks.value.filter((t) => t.family?._id === familyFilter.value)
)

const counts = computed(() =>
    Object.fromEntries(TABS.map((tab) => [tab.key, filteredTasks.value.filter((t) => t.status === tab.key).length]))
)

const visibleTasks = computed(() => {
    const list = filteredTasks.value.filter((t) => t.status === activeTab.value)
    // Completed: most recent first. Others: soonest first (API order).
    return activeTab.value === 'completed'
        ? [...list].sort((a, b) => new Date(b.completedAt || b.startAt) - new Date(a.completedAt || a.startAt))
        : list
})

// Week strip and calendar export use the tasks still to do
const openTasks = computed(() => filteredTasks.value.filter((t) => t.status !== 'completed'))

// "Due in 18 hours" / "Overdue" flag for tasks not started yet
function reminder(task) {
    if (task.status !== 'claimed') return null
    const msUntil = new Date(task.startAt).getTime() - now.value
    if (msUntil < 0) return { type: 'late', label: 'Overdue' }
    if (msUntil > DUE_SOON_MS) return null
    const hours = Math.round(msUntil / 3600000)
    if (hours < 1) return { type: 'soon', label: 'Starting soon' }
    return { type: 'soon', label: `Due in ${hours} hour${hours === 1 ? '' : 's'}` }
}

function selectTab(key) {
    activeTab.value = key
    // Open the first task in the tab, like the design
    expandedId.value = visibleTasks.value[0]?._id || ''
}

function toggle(task) {
    expandedId.value = expandedId.value === task._id ? '' : task._id
}

function syncCalendar() {
    if (!openTasks.value.length) {
        notice.value = 'No upcoming tasks to add.'
        return
    }
    downloadTasksAsCalendar(openTasks.value)
    notice.value = 'Calendar file downloaded. In Google Calendar, go to Settings → Import & export → Import.'
}

async function loadTasks() {
    isLoading.value = true
    errorMessage.value = ''
    try {
        tasks.value = await getMyTasks({ status: 'claimed,in_progress,completed' })
        if (!visibleTasks.value.some((t) => t._id === expandedId.value)) {
            expandedId.value = visibleTasks.value[0]?._id || ''
        }
    } catch (error) {
        errorMessage.value = getErrorMessage(error)
    } finally {
        isLoading.value = false
    }
}

// D's replies have family as a plain id, so keep the one we already have (with its name)
function replaceTask(original, updated) {
    const merged = { ...original, ...updated, family: original.family }
    tasks.value = tasks.value.map((t) => (t._id === original._id ? merged : t))
    return merged
}

function openTrip(task) {
    router.push({ name: 'transit', params: { familyId: task.family._id, taskId: task._id } })
}

async function runAction(task, action) {
    if (action === 'give-back' && !window.confirm(`Give back "${task.title}"? It goes back to the family as available.`)) return
    if (action === 'complete' && !window.confirm(`Mark "${task.title}" as done?`)) return

    busyTaskId.value = task._id
    actionError.value = ''
    try {
        if (action === 'start') {
            const { task: updated } = await startTask(task.family._id, task._id)
            const merged = replaceTask(task, updated)
            if (merged.needsTransit) return openTrip(merged)
            selectTab('in_progress')
            expandedId.value = merged._id
        } else if (action === 'give-back') {
            await unclaimTask(task.family._id, task._id)
            // No longer mine, so it leaves My Tasks
            tasks.value = tasks.value.filter((t) => t._id !== task._id)
        } else if (action === 'complete') {
            const { task: updated } = await completeTask(task.family._id, task._id)
            replaceTask(task, updated)
            selectTab('completed')
        }
    } catch (error) {
        actionError.value = getErrorMessage(error)
        // 409 / 404: someone changed it (e.g. cancelled it). Show the latest state.
        if ([404, 409].includes(error.response?.status)) await loadTasks()
    } finally {
        busyTaskId.value = ''
    }
}

// Keep "Due in 3 hours" accurate, and refresh when coming back to the browser tab
let clock = null
function onVisible() {
    if (document.visibilityState === 'visible') loadTasks()
}
onMounted(() => {
    loadTasks()
    clock = setInterval(() => { now.value = Date.now() }, 60 * 1000)
    document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
    clearInterval(clock)
    document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
    <!-- Phones: Figma "Mobile prototype" layout -->
    <MyTasksMobile
        v-if="isMobile"
        :tasks="filteredTasks"
        :active-tab="activeTab"
        :counts="counts"
        :visible-tasks="visibleTasks"
        :reminder="reminder"
        :is-loading="isLoading"
        :error-message="errorMessage"
        :now="now"
        @select-tab="selectTab"
        @retry="loadTasks"
    />

    <!-- Laptops: Figma "Web wireframes" layout -->
    <div v-else class="my-tasks-page">
        <header class="page-header">
            <div class="title">
                <h1>My tasks</h1>
                <p>Everything you've claimed, across all your families.</p>
            </div>

            <label class="families-pill">
                <span class="visually-hidden">Show tasks from</span>
                <select v-model="familyFilter">
                    <option value="all">All families</option>
                    <option v-for="family in families" :key="family.id" :value="family.id">{{ family.name }}</option>
                </select>
                <span aria-hidden="true">▾</span>
            </label>

            <button type="button" class="btn-secondary" @click="syncCalendar">Sync to Google Calendar</button>
        </header>

        <div class="tabs" role="tablist" aria-label="Task status">
            <button
                v-for="tab in TABS"
                :key="tab.key"
                type="button"
                role="tab"
                class="tab"
                :class="{ active: activeTab === tab.key }"
                :aria-selected="activeTab === tab.key"
                @click="selectTab(tab.key)"
            >
                {{ tab.label }} · {{ counts[tab.key] }}
            </button>
        </div>

        <div class="columns">
            <main class="task-list">
                <div v-if="notice" class="notice" role="status">
                    {{ notice }}
                    <button type="button" class="notice-close" aria-label="Dismiss" @click="notice = ''">×</button>
                </div>
                <div v-if="actionError" class="notice is-error" role="alert">{{ actionError }}</div>

                <div v-if="isLoading && !tasks.length" class="status" role="status">
                    <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
                    Loading your tasks...
                </div>

                <div v-else-if="errorMessage" class="status is-error" role="alert">
                    <span>{{ errorMessage }}</span>
                    <button type="button" class="btn-secondary" @click="loadTasks">Try again</button>
                </div>

                <p v-else-if="!visibleTasks.length" class="status">
                    {{ TABS.find((t) => t.key === activeTab).empty }}
                </p>

                <template v-else>
                <MyTaskCard
                    v-for="task in visibleTasks"
                    :key="task._id"
                    :task="task"
                    :expanded="expandedId === task._id"
                    :busy="busyTaskId === task._id"
                    :reminder="reminder(task)"
                    :family-tone="toneFor(task)"
                    @toggle="toggle(task)"
                    @start="runAction(task, 'start')"
                    @give-back="runAction(task, 'give-back')"
                    @complete="runAction(task, 'complete')"
                    @open-trip="openTrip(task)"
                />
                </template>
            </main>

            <aside class="side">
                <WeekStrip :tasks="openTasks" :now="now" />

                <section class="reminders" aria-labelledby="reminders-title">
                    <h2 id="reminders-title"><i class="bi bi-bell" aria-hidden="true"></i> Reminders</h2>
                    <p>Tasks due within 24 hours are flagged here. Telegram also reminds you 1 hour before.</p>
                    <!-- B (SangYoon) builds Family settings; until then this route goes home -->
                    <RouterLink to="/family/settings" class="reminders-link">Change in Family settings →</RouterLink>
                </section>
            </aside>
        </div>
    </div>
</template>

<style scoped>
/* Values from Figma file "CareCircle Wireframe", frame 10 · My tasks */
.my-tasks-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: #2e2e2e;
}

.page-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}

.title {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 240px;
}

h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: 0.15px;
    font-weight: 700;
    color: #2e2e2e;
}

.title p {
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.08px;
    color: #6b7280;
}

/* "All families ▾" badge */
.families-pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    background: white;
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    color: #2e2e2e;
}

.families-pill select {
    appearance: none;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
}

.families-pill select:focus-visible {
    outline: 2px solid #2f7a3f;
    outline-offset: 2px;
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

/* Tabs */
.tabs {
    display: flex;
    gap: 28px;
    border-bottom: 1px solid #e5e7eb;
    overflow-x: auto;
}

.tab {
    padding: 4px 0 12px;
    margin-bottom: -1px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: #6b7280;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    white-space: nowrap;
}

.tab.active {
    border-bottom-color: #2f7a3f;
    color: #2f7a3f;
    font-weight: 600;
}

/* Two columns */
.columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 24px;
    align-items: start;
}

.task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
}

.side {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.reminders {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    border: 1px solid #ffe6a3;
    border-radius: 16px;
    background: #fff8e1;
}

.reminders h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.08px;
    font-weight: 600;
    color: #7a5a00;
}

.reminders p {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    color: #2e2e2e;
}

.reminders-link {
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    color: #2f7a3f;
}

/* Messages */
.status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0;
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

@media (max-width: 991px) {
    .columns {
        grid-template-columns: 1fr;
    }

    .side {
        order: -1;
    }

    .reminders {
        display: none;
    }
}
</style>
