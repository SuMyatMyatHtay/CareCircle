<script setup>
// Owner: Chaithra (E). Matches Figma "CareCircle — Mobile prototype" → "10 · My tasks".
// Phone layout of My Tasks. MyTasksView loads the data and passes it in.
// Tapping a task opens its Task detail page (Start the trip / Mark as done / Unclaim live there).
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PersonAvatar from './PersonAvatar.vue'
import GoogleCalendarSync from './GoogleCalendarSync.vue'
import { formatTime, dayKey, recipientName, TIME_ZONE } from '../utils/formatters.js'

const props = defineProps({
    tasks: { type: Array, default: () => [] },        // all my tasks (after the family filter)
    activeTab: { type: String, default: 'claimed' },
    counts: { type: Object, default: () => ({}) },
    visibleTasks: { type: Array, default: () => [] },
    reminder: { type: Function, required: true },
    isLoading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    now: { type: Number, default: () => Date.now() }
})
const emit = defineEmits(['select-tab', 'retry', 'calendar'])

const router = useRouter()

const TABS = [
    { key: 'claimed', label: 'Upcoming' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'completed', label: 'Done' }
]
const EMPTY = {
    claimed: 'Nothing coming up. Claim a task from Family home.',
    in_progress: 'Nothing in progress right now.',
    completed: 'No completed tasks yet.'
}

// "This week · 3 of 5 done": my tasks starting Monday to Sunday of this week
const week = computed(() => {
    const DAY = 24 * 60 * 60 * 1000
    const weekday = new Date(props.now).toLocaleDateString('en-US', { weekday: 'short', timeZone: TIME_ZONE })
    const offset = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday)
    const keys = new Set(Array.from({ length: 7 }, (_, i) => dayKey(props.now + (i - offset) * DAY)))
    const inWeek = props.tasks.filter((t) => keys.has(dayKey(t.startAt)))
    const done = inWeek.filter((t) => t.status === 'completed').length
    return { done, total: inWeek.length, percent: inWeek.length ? Math.round((done / inWeek.length) * 100) : 0 }
})

function datePill(task) {
    return new Date(task.startAt).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: TIME_ZONE
    })
}

// "Today, 2:00 PM · FairPrice, Junction 8" for due-soon tasks, "9:00 AM · Bethesda, Bedok" otherwise
function meta(task, flagged) {
    const time = formatTime(task.startAt).toUpperCase().replace(/(AM|PM)$/, ' $1')
    const isToday = dayKey(task.startAt) === dayKey(props.now)
    const when = flagged && isToday ? `Today, ${time}` : time
    const place = task.location?.name || task.location?.address || ''
    return [when, place].filter(Boolean).join(' · ')
}

function open(task) {
    router.push({ name: 'task-detail', params: { familyId: task.family._id, taskId: task._id } })
}
</script>

<template>
    <div class="m-tasks">
        <div class="title-row">
            <h1>Tasks</h1>
            <button type="button" class="cal-btn" aria-label="Add my tasks to calendar" @click="emit('calendar')">
                <i class="bi bi-calendar-plus" aria-hidden="true"></i>
            </button>
        </div>

        <!-- Needs someone = D's open-tasks list; until it exists it goes to Family home -->
        <div class="segmented" role="tablist" aria-label="Task lists">
            <RouterLink to="/home" class="segment" role="tab" aria-selected="false">Needs someone</RouterLink>
            <span class="segment active" role="tab" aria-selected="true">My tasks</span>
        </div>

        <GoogleCalendarSync compact />

        <section class="week" aria-label="This week">
            <div class="week-row">
                <span>This week</span>
                <strong>{{ week.done }} of {{ week.total }} done</strong>
            </div>
            <div class="bar" role="progressbar" :aria-valuenow="week.percent" aria-valuemin="0" aria-valuemax="100">
                <span :style="{ width: `${week.percent}%` }"></span>
            </div>
        </section>

        <div class="tabs" role="tablist" aria-label="Task status">
            <button
                v-for="tab in TABS"
                :key="tab.key"
                type="button"
                role="tab"
                class="tab"
                :class="{ active: activeTab === tab.key }"
                :aria-selected="activeTab === tab.key"
                @click="emit('select-tab', tab.key)"
            >
                {{ tab.label }} · {{ counts[tab.key] || 0 }}
            </button>
        </div>

        <p v-if="isLoading && !tasks.length" class="status" role="status">Loading your tasks...</p>
        <p v-else-if="errorMessage" class="status is-error" role="alert">
            {{ errorMessage }}
            <button type="button" class="retry" @click="emit('retry')">Try again</button>
        </p>
        <p v-else-if="!visibleTasks.length" class="status">{{ EMPTY[activeTab] }}</p>

        <ul v-else class="cards">
            <li v-for="task in visibleTasks" :key="task._id">
                <button type="button" class="m-card" :class="{ urgent: reminder(task) }" @click="open(task)">
                    <span class="card-top">
                        <span v-if="reminder(task)" class="pill pill-due">{{ reminder(task).label }}</span>
                        <span v-else class="pill pill-date">{{ datePill(task) }}</span>
                        <span class="family">{{ task.family?.name }}</span>
                    </span>
                    <span class="card-main">
                        <PersonAvatar :name="recipientName(task)" :size="44" tone="yellow" />
                        <span class="text">
                            <strong>{{ task.title }}</strong>
                            <small>{{ meta(task, reminder(task)) }}</small>
                        </span>
                    </span>
                </button>
            </li>
        </ul>
    </div>
</template>

<style scoped>
/* Values from Figma "Mobile prototype" → 10 · My tasks (390 × 844) */
.m-tasks {
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-family: Nunito, Inter, system-ui, sans-serif;
    color: #2e2e2e;
}

.title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.cal-btn {
    width: 40px;
    height: 40px;
    border: 1px solid #dce3dc;
    border-radius: 12px;
    background: white;
    font-size: 18px;
    color: #2f7a3f;
}

h1 {
    margin: 0 0 2px;
    font-size: 26px;
    font-weight: 900;
    color: #2e2e2e;
}

.segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: #eef1ee;
}

.segment {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    color: #4b5563;
    text-decoration: none;
}

.segment.active {
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    font-weight: 800;
    color: #2e2e2e;
}

.week {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border-radius: 18px;
    background: #e8f5e9;
}

.week-row {
    display: flex;
    justify-content: space-between;
    font-size: 15px;
    font-weight: 700;
}

.week-row strong {
    font-size: 14px;
    font-weight: 700;
    color: #1f5a2c;
}

.bar {
    height: 10px;
    overflow: hidden;
    border-radius: 5px;
    background: white;
}

.bar span {
    display: block;
    height: 100%;
    border-radius: 5px;
    background: #2f7a3f;
    transition: width 0.3s ease;
}

.tabs {
    display: flex;
    gap: 20px;
    margin-top: 8px;
    border-bottom: 1px solid #e5e7eb;
    overflow-x: auto;
}

.tab {
    padding: 0 0 12px;
    margin-bottom: -1px;
    border: none;
    border-bottom: 3px solid transparent;
    background: none;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    color: #5b6470;
    white-space: nowrap;
}

.tab.active {
    border-bottom-color: #2f7a3f;
    font-weight: 800;
    color: #2e2e2e;
}

.cards {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.m-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    padding: 15px;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    background: white;
    font-family: inherit;
    text-align: left;
}

.m-card.urgent {
    padding: 14px;
    border: 2px solid #f28b7a;
}

.card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.pill {
    padding: 3px 10px;
    border-radius: 11px;
    font-size: 12px;
    font-weight: 800;
}

.pill-due {
    background: #ffe9e4;
    color: #9f3a2b;
}

.pill-date {
    background: #eef1f4;
    color: #374151;
}

.family {
    font-size: 13px;
    font-weight: 700;
    color: #5b6470;
}

.card-main {
    display: flex;
    align-items: center;
    gap: 12px;
}

.text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.text strong {
    font-size: 16px;
    font-weight: 700;
    color: #2e2e2e;
}

.text small {
    font-size: 13px;
    font-weight: 400;
    color: #5b6470;
}

.status {
    margin: 0;
    padding: 16px 4px;
    font-size: 14px;
    color: #5b6470;
}

.status.is-error {
    color: #9f3a2b;
}

.retry {
    margin-left: 8px;
    border: none;
    background: none;
    font-weight: 700;
    color: #2f7a3f;
    text-decoration: underline;
}
</style>
