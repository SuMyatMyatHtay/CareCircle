<script setup>
// Owner: Chaithra (E). Phone layout of My Tasks (Figma frame 10).
// Shows the same things as the laptop layout (MyTasksView): title, family filter,
// Google Calendar, Add to calendar, Your week, the three tabs, and the same card details.
// MyTasksView loads the data and does the actions; the cards are the same MyTaskCard as on
// the laptop (tap to open: progress, View task, Give back, Start the trip, Mark as done).
import MyTaskCard from './MyTaskCard.vue'
import GoogleCalendarSync from './GoogleCalendarSync.vue'
import WeekStrip from './WeekStrip.vue'

defineProps({
    tasks: { type: Array, default: () => [] },        // all my tasks (after the family filter)
    openTasks: { type: Array, default: () => [] },    // not done yet, for Your week
    families: { type: Array, default: () => [] },     // [{ id, name }] for the family filter
    familyFilter: { type: String, default: 'all' },
    activeTab: { type: String, default: 'claimed' },
    counts: { type: Object, default: () => ({}) },
    visibleTasks: { type: Array, default: () => [] },
    reminder: { type: Function, required: true },
    isLoading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    now: { type: Number, default: () => Date.now() },
    expandedId: { type: String, default: '' },
    busyTaskId: { type: String, default: '' },
    toneFor: { type: Function, default: () => 'green' },
    notice: { type: String, default: '' },
    actionError: { type: String, default: '' }
})
const emit = defineEmits([
    'select-tab', 'retry', 'calendar', 'update:familyFilter',
    'toggle', 'start', 'give-back', 'complete', 'open-trip', 'dismiss'
])

// Same tab names and empty messages as the laptop layout
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

</script>

<template>
    <div class="m-tasks">
        <header class="m-header">
            <h1>My tasks</h1>
            <p>Everything you've claimed, across all your families.</p>
        </header>

        <div class="m-actions">
            <label class="families-pill">
                <span class="visually-hidden">Show tasks from</span>
                <select :value="familyFilter" @change="emit('update:familyFilter', $event.target.value)">
                    <option value="all">All families</option>
                    <option v-for="family in families" :key="family.id" :value="family.id">{{ family.name }}</option>
                </select>
                <span aria-hidden="true">▾</span>
            </label>
            <button type="button" class="cal-btn" @click="emit('calendar')">
                <i class="bi bi-calendar-plus" aria-hidden="true"></i> Add to calendar
            </button>
        </div>

        <GoogleCalendarSync compact />

        <WeekStrip :tasks="openTasks" :now="now" />

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

        <div v-if="notice" class="msg" role="status" @click="emit('dismiss')">{{ notice }}</div>
        <div v-if="actionError" class="msg is-error" role="alert">{{ actionError }}</div>

        <p v-if="isLoading && !tasks.length" class="status" role="status">Loading your tasks...</p>
        <p v-else-if="errorMessage" class="status is-error" role="alert">
            {{ errorMessage }}
            <button type="button" class="retry" @click="emit('retry')">Try again</button>
        </p>
        <p v-else-if="!visibleTasks.length" class="status">{{ EMPTY[activeTab] }}</p>

        <div v-else class="cards">
            <MyTaskCard
                v-for="task in visibleTasks"
                :key="task._id"
                :task="task"
                :expanded="expandedId === task._id"
                :busy="busyTaskId === task._id"
                :reminder="reminder(task)"
                :family-tone="toneFor(task)"
                @toggle="emit('toggle', task)"
                @start="emit('start', task)"
                @give-back="emit('give-back', task)"
                @complete="emit('complete', task)"
                @open-trip="emit('open-trip', task)"
            />
        </div>

        <!-- Same Reminders card as the laptop -->
        <section class="reminders" aria-labelledby="m-reminders-title">
            <h2 id="m-reminders-title"><i class="bi bi-bell" aria-hidden="true"></i> Reminders</h2>
            <p>Tasks due within 24 hours are flagged here. Telegram also reminds you 1 hour before.</p>
            <RouterLink to="/family/settings" class="reminders-link">Change in Family settings →</RouterLink>
        </section>
    </div>
</template>

<style scoped>
/* Phone version of Figma frame 10 · My tasks: same content as the laptop layout */
.m-tasks {
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-family: Nunito, Inter, system-ui, sans-serif;
    color: var(--theme-text, #2e2e2e);
}


.m-header p {
    margin: 0;
    font-size: 14px;
    color: var(--theme-muted, #5b6470);
}

.m-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

/* "All families ▾" (same as the laptop) */
.families-pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--theme-neutral, #f3f4f6);
    font-size: 13px;
    font-weight: 700;
    color: var(--theme-text, #2e2e2e);
}

.families-pill select {
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    appearance: none;
    padding-right: 2px;
}

.cal-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--theme-border, #dce3dc);
    border-radius: 12px;
    background: var(--theme-panel, white);
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    color: var(--theme-green, #2f7a3f);
}

h1 {
    margin: 0 0 2px;
    font-size: 26px;
    font-weight: 900;
    color: var(--theme-text, #2e2e2e);
}









.tabs {
    display: flex;
    gap: 20px;
    margin-top: 8px;
    border-bottom: 1px solid var(--theme-border, #e5e7eb);
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
    color: var(--theme-muted, #5b6470);
    white-space: nowrap;
}

.tab.active {
    border-bottom-color: var(--theme-accent-border, #2f7a3f);
    font-weight: 800;
    color: var(--theme-text, #2e2e2e);
}

.cards {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.msg {
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--theme-soft, #e8f5e9);
    font-size: 14px;
    color: var(--theme-green, #1f5a2c);
}

.msg.is-error {
    background: var(--theme-danger-soft, #ffe9e4);
    color: var(--theme-danger, #a33a26);
}

.reminders {
    padding: 16px 18px;
    border: 1px solid var(--theme-warning-border, #ffe6a3);
    border-radius: 16px;
    background: var(--theme-warning-soft, #fff8e1);
}

.reminders h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 800;
    color: var(--theme-warning, #7a5a00);
}

.reminders p {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--theme-text, #2e2e2e);
}

.reminders-link {
    font-size: 14px;
    font-weight: 700;
    color: var(--theme-green, #2f7a3f);
    text-decoration: none;
}




.status {
    margin: 0;
    padding: 16px 4px;
    font-size: 14px;
    color: var(--theme-muted, #5b6470);
}

.status.is-error {
    color: var(--theme-danger, #9f3a2b);
}

.retry {
    margin-left: 8px;
    border: none;
    background: none;
    font-weight: 700;
    color: var(--theme-green, #2f7a3f);
    text-decoration: underline;
}
</style>
