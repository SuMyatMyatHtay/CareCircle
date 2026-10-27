<script setup>
// Owner: SeungHak (F)
// Family Calendar: every task in the family (whoever claimed it) and every follow-up
// appointment written in a consultation note, on one month grid.
// Click a day to see its list; each item opens the task, or the note's care log.
// Double-click a day, or "+ Add task" in its list, to post a task on that day (like Apple Calendar).
// Google Calendar sync (E, Chaithra) sits beside it for people who want it on their phone.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useFamilyTasks } from '../../../composables/useFamilyTasks.js'
import { queryKeys } from '../../../services/queryClient.js'
import { getLogs } from '../../logs/services/logsApi.js'
import { displayName } from '../../recipients/recipientLabels.js'
import FamilyEmptyState from '../../family/components/FamilyEmptyState.vue'
import NewTaskModal from '../../tasks/components/NewTaskModal.vue'
import GoogleCalendarSync from '../../my-tasks/components/GoogleCalendarSync.vue'
import {
    dayKey, monthOf, shiftMonth, monthGrid, gridRange, monthLabel, dayLabel, shortTime,
    buildEvents, filterEvents, groupByDay, WEEKDAYS, STATE_LABELS
} from '../calendarDays.js'

const MAX_CHIPS = 3

const { selectedFamily, selectedFamilyId, recipients, isLoading, errorMessage, loadFamilies } = useFamilyWorkspace()
const { tasks, isLoading: tasksLoading, errorMessage: tasksError, refetch } = useFamilyTasks()

// ---- Which month and day ----
const now = ref(Date.now())
const today = computed(() => dayKey(now.value))
const month = ref(monthOf(dayKey(Date.now())))
const selectedDay = ref(dayKey(Date.now()))

function showMonth(next) {
    month.value = next
    // Keep the list useful: today if it's in this month, otherwise the 1st
    selectedDay.value = monthOf(today.value) === next ? today.value : `${next}-01`
}
const goToday = () => showMonth(monthOf(today.value))

const days = computed(() => monthGrid(month.value))

// ---- Follow-up appointments from consultation notes (only for the shown weeks) ----
const appointmentsQuery = useQuery({
    queryKey: computed(() => [...queryKeys.logs(selectedFamilyId.value), 'appointments', month.value]),
    queryFn: () => {
        const { from, to } = gridRange(month.value)
        return getLogs(selectedFamilyId.value, { appointmentFrom: from.toISOString(), appointmentTo: to.toISOString(), limit: 50 })
    },
    enabled: computed(() => Boolean(selectedFamilyId.value))
})

// ---- Events ----
const recipientFilter = ref('all')
watch(selectedFamilyId, () => { recipientFilter.value = 'all' })

const events = computed(() => filterEvents(
    buildEvents({
        tasks: tasks.value,
        appointmentNotes: appointmentsQuery.data.value ?? [],
        familyId: selectedFamilyId.value,
        now: now.value
    }),
    recipientFilter.value
))
const byDay = computed(() => groupByDay(events.value))
const dayEvents = computed(() => byDay.value[selectedDay.value] ?? [])
const monthCount = computed(() => events.value.filter((event) => monthOf(event.day) === month.value).length)

function dayAria(day) {
    const count = byDay.value[day.key]?.length ?? 0
    return `${dayLabel(day.key)}, ${count ? `${count} ${count === 1 ? 'item' : 'items'}` : 'nothing planned'}`
}

function stateText(event) {
    if (event.who && event.state === 'completed') return `Done by ${event.who}`
    if (event.who) return `${STATE_LABELS[event.state]} by ${event.who}`
    return STATE_LABELS[event.state]
}

// ---- New task on a day ----
// Tasks can't start in the past (the form's date picker stops at today too)
const isPast = (key) => key < today.value
const newTaskDay = ref('')

function addTaskOn(key) {
    if (isPast(key)) return
    selectedDay.value = key
    newTaskDay.value = key
}

// A new task jumps the calendar to its day
function onCreated(task) {
    const key = dayKey(task.startAt)
    month.value = monthOf(key)
    selectedDay.value = key
}

// ---- Keep it current ----
let clock
const onAssistantUpdate = () => refetch()
onMounted(() => {
    // Other pages may have cached the task list a while ago; others in the family may have added tasks since
    refetch()
    clock = setInterval(() => { now.value = Date.now() }, 60 * 1000)
    window.addEventListener('carecircle:task-updated', onAssistantUpdate)
})
onUnmounted(() => {
    clearInterval(clock)
    window.removeEventListener('carecircle:task-updated', onAssistantUpdate)
})

const familyName = computed(() => selectedFamily.value?.name || 'Your family')
const legend = ['open', 'missed', 'claimed', 'in_progress', 'completed', 'appointment']
</script>

<template>
    <div class="calendar-page">
        <header class="calendar-header">
            <div>
                <div class="calendar-eyebrow">{{ familyName }}</div>
                <h1>Calendar</h1>
                <p>Every family task and follow-up appointment, in one place.</p>
            </div>
        </header>

        <FamilyEmptyState
            v-if="isLoading || errorMessage || !selectedFamily"
            :loading="isLoading"
            :error="errorMessage"
            @retry="loadFamilies"
        />

        <template v-else>
            <div class="calendar-toolbar">
                <div class="month-nav">
                    <button type="button" class="icon-button" aria-label="Previous month" @click="showMonth(shiftMonth(month, -1))">
                        <i class="bi bi-chevron-left" aria-hidden="true"></i>
                    </button>
                    <h2 aria-live="polite" data-testid="calendar-month">{{ monthLabel(month) }}</h2>
                    <button type="button" class="icon-button" aria-label="Next month" @click="showMonth(shiftMonth(month, 1))">
                        <i class="bi bi-chevron-right" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="today-button" :disabled="month === monthOf(today) && selectedDay === today" @click="goToday">
                        Today
                    </button>
                </div>

                <label class="recipient-filter">
                    <span>Show</span>
                    <select v-model="recipientFilter" data-testid="calendar-filter">
                        <option value="all">Everyone</option>
                        <option v-for="recipient in recipients" :key="recipient._id" :value="recipient._id">
                            {{ displayName(recipient) }}
                        </option>
                        <option value="household">Household tasks</option>
                    </select>
                </label>
            </div>

            <div v-if="tasksError" class="calendar-error" role="alert">
                {{ tasksError }}
                <button type="button" @click="refetch()">Try again</button>
            </div>

            <div class="calendar-layout">
                <section class="calendar-card month-card" :aria-label="`${monthLabel(month)}, ${monthCount} items`">
                    <div class="weekday-row" aria-hidden="true">
                        <span v-for="weekday in WEEKDAYS" :key="weekday">{{ weekday }}</span>
                    </div>

                    <div class="month-grid" :class="{ 'is-loading': tasksLoading }">
                        <button
                            v-for="day in days"
                            :key="day.key"
                            type="button"
                            class="day-cell"
                            :class="{
                                'is-outside': !day.inMonth,
                                'is-today': day.key === today,
                                'is-selected': day.key === selectedDay
                            }"
                            :aria-pressed="day.key === selectedDay"
                            :aria-label="dayAria(day)"
                            :data-testid="`calendar-day-${day.key}`"
                            @click="selectedDay = day.key"
                            @dblclick="addTaskOn(day.key)"
                        >
                            <span class="day-number">{{ day.day }}</span>

                            <!-- Wide screens: the first few items -->
                            <span class="day-chips">
                                <span
                                    v-for="event in (byDay[day.key] ?? []).slice(0, MAX_CHIPS)"
                                    :key="event.id"
                                    class="chip"
                                    :class="`state-${event.state}`"
                                >
                                    <span class="chip-time">{{ shortTime(event.time) }}</span>
                                    <span class="chip-title">{{ event.title }}</span>
                                </span>
                                <span v-if="(byDay[day.key]?.length ?? 0) > MAX_CHIPS" class="chip-more">
                                    +{{ byDay[day.key].length - MAX_CHIPS }} more
                                </span>
                            </span>

                            <!-- Phones: one dot per item -->
                            <span v-if="byDay[day.key]?.length" class="day-dots" aria-hidden="true">
                                <span v-for="event in byDay[day.key].slice(0, 4)" :key="event.id" class="dot" :class="`state-${event.state}`"></span>
                            </span>
                        </button>
                    </div>

                    <p class="calendar-hint">Double-click a day to add a task on it.</p>

                    <ul class="legend" aria-label="Colour key">
                        <li v-for="state in legend" :key="state">
                            <span class="dot" :class="`state-${state}`" aria-hidden="true"></span>{{ STATE_LABELS[state] }}
                        </li>
                    </ul>
                </section>

                <aside class="calendar-side">
                    <section class="calendar-card agenda" aria-live="polite" data-testid="calendar-agenda">
                        <header class="agenda-head">
                            <h2>{{ dayLabel(selectedDay) }}</h2>
                            <span v-if="selectedDay === today" class="today-pill">Today</span>
                            <button
                                v-if="!isPast(selectedDay)"
                                type="button"
                                class="add-task-button"
                                :aria-label="`Add a task on ${dayLabel(selectedDay)}`"
                                data-testid="calendar-add-task"
                                @click="addTaskOn(selectedDay)"
                            >
                                <i class="bi bi-plus-lg" aria-hidden="true"></i> Add task
                            </button>
                        </header>

                        <p v-if="tasksLoading" class="agenda-empty" role="status">Loading the family's plans…</p>

                        <ol v-else-if="dayEvents.length" class="agenda-list">
                            <li v-for="event in dayEvents" :key="event.id">
                                <component
                                    :is="event.to ? 'RouterLink' : 'div'"
                                    :to="event.to"
                                    class="agenda-item"
                                    :class="`state-${event.state}`"
                                >
                                    <span class="agenda-time">
                                        {{ event.time }}<template v-if="event.endTime"> – {{ event.endTime }}</template>
                                    </span>
                                    <span class="agenda-body">
                                        <strong>
                                            <i v-if="event.kind === 'appointment'" class="bi bi-clipboard2-pulse" aria-hidden="true"></i>
                                            {{ event.title }}
                                        </strong>
                                        <small>{{ [event.recipientName, event.place].filter(Boolean).join(' · ') }}</small>
                                        <span class="state-badge">{{ stateText(event) }}</span>
                                    </span>
                                    <i v-if="event.to" class="bi bi-chevron-right agenda-arrow" aria-hidden="true"></i>
                                </component>
                            </li>
                        </ol>

                        <p v-else class="agenda-empty">
                            Nothing planned{{ recipientFilter === 'all' ? '' : ' for this person' }}.
                        </p>

                        <p v-if="appointmentsQuery.isError.value" class="agenda-note">
                            Follow-up appointments couldn't be loaded. Tasks are still shown.
                        </p>
                    </section>

                    <GoogleCalendarSync compact />
                </aside>
            </div>

            <NewTaskModal
                v-if="newTaskDay"
                :key="newTaskDay"
                :date="newTaskDay"
                @created="onCreated"
                @close="newTaskDay = ''"
            />
        </template>
    </div>
</template>

<style scoped>
.calendar-page {
    max-width: 1440px;
    margin: auto;
    padding: 12px 0 36px;
    color: var(--theme-text, #30332f);
}

.calendar-header,
.calendar-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
}

.calendar-header h1 {
    margin: 4px 0;
    font-size: 32px;
    font-weight: 750;
}

.calendar-header p {
    margin: 0;
    color: var(--theme-muted, #717b8e);
    font-size: 14px;
}

.calendar-eyebrow {
    color: var(--theme-green, #2d7d43);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
}

.calendar-toolbar {
    margin: 18px 0 16px;
}

.month-nav {
    display: flex;
    align-items: center;
    gap: 6px;
}

.month-nav h2 {
    min-width: 170px;
    margin: 0 4px;
    font-size: 20px;
    font-weight: 700;
    text-align: center;
}

.icon-button,
.today-button {
    border: 1px solid var(--theme-border, #dfe3e8);
    background: var(--theme-panel, #fff);
    color: inherit;
}

.icon-button {
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
}

.today-button {
    margin-left: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
}

.today-button:disabled {
    opacity: 0.5;
}

.recipient-filter {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--theme-muted, #717b8e);
    font-size: 14px;
}

.recipient-filter select {
    max-width: 220px;
    padding: 8px 12px;
    border: 1px solid var(--theme-border, #dfe3e8);
    border-radius: 12px;
    background: var(--theme-panel, #fff);
    color: var(--theme-text, #30332f);
}

.calendar-error {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--theme-danger-soft, #fff0eb);
    color: var(--theme-danger, #c0564b);
    font-size: 14px;
}

.calendar-error button {
    margin-left: auto;
    border: none;
    background: none;
    color: inherit;
    font-weight: 700;
    text-decoration: underline;
}

.calendar-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
    gap: 20px;
    align-items: start;
}

.calendar-card {
    min-width: 0;
    padding: 18px;
    border: 1px solid var(--theme-border, #dfe3e8);
    border-radius: 18px;
    background: var(--theme-panel, #fff);
}

.calendar-side {
    display: grid;
    gap: 16px;
    min-width: 0;
}

/* ---- Month grid ---- */
.weekday-row,
.month-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
    margin-bottom: 6px;
    color: var(--theme-muted, #717b8e);
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
}

.month-grid {
    gap: 4px;
    transition: opacity 0.2s;
}

.month-grid.is-loading {
    opacity: 0.6;
}

.day-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    min-height: 104px;
    padding: 6px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--theme-soft, #f6f8f6);
    color: inherit;
    text-align: left;
}

.day-cell:hover {
    border-color: var(--theme-border, #dfe3e8);
}

.day-cell.is-outside {
    background: transparent;
    color: var(--theme-muted, #9aa1ad);
}

.day-cell.is-selected {
    border-color: var(--theme-green, #2d7d43);
    box-shadow: 0 0 0 1px var(--theme-green, #2d7d43);
}

.day-number {
    font-size: 13px;
    font-weight: 700;
}

.day-cell.is-today .day-number {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--theme-green, #2d7d43);
    color: #fff;
}

.day-chips {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.chip {
    display: flex;
    gap: 4px;
    min-width: 0;
    padding: 2px 5px;
    border-left: 3px solid currentColor;
    border-radius: 5px;
    font-size: 11px;
    line-height: 1.35;
}

.chip-time {
    flex: 0 0 auto;
    font-weight: 700;
}

.chip-title {
    overflow: hidden;
    color: var(--theme-text, #30332f);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chip-more {
    padding-left: 5px;
    color: var(--theme-muted, #717b8e);
    font-size: 11px;
    font-weight: 600;
}

.day-dots {
    display: none;
    gap: 3px;
}

/* ---- Colours, one per state ---- */
.state-open { --state: var(--theme-warning, #93650a); --state-soft: var(--theme-warning-soft, #fff3d6); }
.state-missed { --state: var(--theme-danger, #c0564b); --state-soft: var(--theme-danger-soft, #fde8e4); }
.state-claimed { --state: var(--theme-green, #2d7d43); --state-soft: var(--theme-accent-soft, #e3f2e6); }
.state-in_progress { --state: #2f6fb3; --state-soft: #e5effa; }
.state-completed { --state: var(--theme-muted, #7b8391); --state-soft: var(--theme-neutral, #eef0f2); }
.state-appointment { --state: var(--theme-purple, #6a4fa3); --state-soft: var(--theme-purple-soft, #eee8fa); }

.chip {
    background: var(--state-soft);
    color: var(--state);
}

.chip.state-completed .chip-title {
    color: var(--theme-muted, #7b8391);
    text-decoration: line-through;
}

.dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--state);
}

.legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
    color: var(--theme-muted, #717b8e);
    font-size: 12px;
}

.legend li {
    display: flex;
    align-items: center;
    gap: 6px;
}

/* ---- Day list ---- */
.agenda-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.agenda-head h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
}

.add-task-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    padding: 5px 12px;
    border: 1px solid var(--theme-green, #2d7d43);
    border-radius: 999px;
    background: transparent;
    color: var(--theme-green, #2d7d43);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
}

.add-task-button:hover {
    background: var(--theme-soft, #eaf5eb);
}

.calendar-hint {
    margin: 10px 0 0;
    color: var(--theme-muted, #717b8e);
    font-size: 12px;
}

.today-pill {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--theme-green, #2d7d43);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
}

.agenda-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.agenda-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--theme-border, #e4ece5);
    border-left: 4px solid var(--state);
    border-radius: 12px;
    color: inherit;
    text-decoration: none;
}

a.agenda-item:hover {
    background: var(--theme-soft, #f6f8f6);
}

.agenda-time {
    flex: 0 0 64px;
    font-size: 13px;
    font-weight: 700;
}

.agenda-body {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
}

.agenda-body strong {
    overflow-wrap: anywhere;
    font-size: 14px;
}

.agenda-body small {
    color: var(--theme-muted, #717b8e);
    font-size: 12px;
}

.state-badge {
    justify-self: start;
    margin-top: 3px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--state-soft);
    color: var(--state);
    font-size: 11px;
    font-weight: 700;
}

.agenda-arrow {
    align-self: center;
    color: var(--theme-muted, #9aa1ad);
}

.agenda-empty,
.agenda-note {
    margin: 0;
    color: var(--theme-muted, #717b8e);
    font-size: 14px;
}

.agenda-note {
    margin-top: 10px;
    font-size: 12px;
}

.calendar-page button:focus-visible,
.calendar-page a:focus-visible {
    outline: 2px solid var(--theme-green, #2d7d43);
    outline-offset: 2px;
}

@media (max-width: 1100px) {
    .calendar-layout {
        grid-template-columns: 1fr;
    }

    .calendar-side {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
}

/* Phones: small cells with dots, the day's list below */
@media (max-width: 767px) {
    .calendar-header h1 {
        font-size: 26px;
    }

    .calendar-toolbar {
        margin: 12px 0;
    }

    .month-nav h2 {
        min-width: 0;
        font-size: 17px;
    }

    .recipient-filter,
    .recipient-filter select {
        width: 100%;
        max-width: none;
    }

    .calendar-card {
        padding: 12px;
    }

    .day-cell {
        align-items: center;
        min-height: 48px;
        padding: 4px 2px;
    }

    .day-chips {
        display: none;
    }

    .day-dots {
        display: flex;
    }

    /* No double-click on phones: "+ Add task" in the day's list does it */
    .calendar-hint {
        display: none;
    }

    .dot {
        width: 6px;
        height: 6px;
    }
}
</style>
