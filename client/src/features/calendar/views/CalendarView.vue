<script setup>
// Owner: SeungHak (F)
// Family Calendar: every task (whoever claimed it) and every follow-up appointment written
// in a consultation note, on one month grid. Like My tasks it shows all your families,
// or one of them.
// Click a day to see its list; each item opens the task, or the note's care log.
// Double-click a day, or "+ Add task" in its list, to post a task on that day (like Apple Calendar).
// Google Calendar sync (E, Chaithra) sits by the title for people who want it on their phone.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { getFamilyTasks, getTaskErrorMessage } from '../../tasks/services/tasksApi.js'
import { getLogs } from '../../logs/services/logsApi.js'
import FamilyEmptyState from '../../family/components/FamilyEmptyState.vue'
import NewTaskModal from '../../tasks/components/NewTaskModal.vue'
import GoogleCalendarSync from '../../my-tasks/components/GoogleCalendarSync.vue'
import {
    dayKey, monthOf, shiftMonth, monthGrid, gridRange, monthLabel, dayLabel, shortTime,
    buildEvents, filterEvents, groupByDay, recipientOptions, WEEKDAYS, STATE_LABELS
} from '../calendarDays.js'

const MAX_CHIPS = 3

const { families, selectedFamily, isLoading, errorMessage, loadFamilies } = useFamilyWorkspace()

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

// ---- Which families: all of them (like My tasks), or one ----
const familyScope = ref('all')
const shownFamilies = computed(() =>
    familyScope.value === 'all' ? families.value : families.value.filter((f) => f.id === familyScope.value)
)
const manyFamilies = computed(() => shownFamilies.value.length > 1)

// ---- Tasks and follow-up appointments for the shown weeks, from each family ----
const calendarQuery = useQuery({
    queryKey: computed(() => ['calendar', shownFamilies.value.map((f) => f.id).join(','), month.value]),
    queryFn: () => {
        const { from, to } = gridRange(month.value)
        const range = { from: from.toISOString(), to: to.toISOString() }
        return Promise.all(shownFamilies.value.map(async (family) => ({
            family,
            tasks: await getFamilyTasks(family.id, range),
            // A missing note list shouldn't hide the tasks
            notes: await getLogs(family.id, { appointmentFrom: range.from, appointmentTo: range.to, limit: 50 }).catch(() => [])
        })))
    },
    enabled: computed(() => shownFamilies.value.length > 0)
})
const isLoadingEvents = computed(() => calendarQuery.isLoading.value)
const loadError = computed(() =>
    calendarQuery.error.value && !calendarQuery.data.value ? getTaskErrorMessage(calendarQuery.error.value) : ''
)
const refetch = () => calendarQuery.refetch()

// ---- Events ----
const allEvents = computed(() =>
    (calendarQuery.data.value ?? [])
        .flatMap(({ family, tasks, notes }) => buildEvents({
            tasks, appointmentNotes: notes, familyId: family.id, familyName: family.name, now: now.value
        }))
        .sort((a, b) => a.at - b.at)
)
const people = computed(() => recipientOptions(allEvents.value))

const recipientFilter = ref('all')
watch(familyScope, () => { recipientFilter.value = 'all' })

const events = computed(() => filterEvents(allEvents.value, recipientFilter.value))
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
    refetch()
}

// ---- Keep it current ----
let clock
const onAssistantUpdate = () => refetch()
onMounted(() => {
    // Others in the family may have changed tasks since this month was last loaded
    refetch()
    clock = setInterval(() => { now.value = Date.now() }, 60 * 1000)
    window.addEventListener('carecircle:task-updated', onAssistantUpdate)
})
onUnmounted(() => {
    clearInterval(clock)
    window.removeEventListener('carecircle:task-updated', onAssistantUpdate)
})

const eyebrow = computed(() => (manyFamilies.value ? 'All your families' : shownFamilies.value[0]?.name || 'Your family'))
const legend = ['open', 'missed', 'claimed', 'in_progress', 'completed', 'appointment']
</script>

<template>
    <div class="calendar-page">
        <header class="calendar-header">
            <div>
                <div class="calendar-eyebrow">{{ eyebrow }}</div>
                <h1>Calendar</h1>
                <p>Every family task and follow-up appointment, in one place.</p>
            </div>
            <!-- Up here, not below the day's list, so it's never scrolled out of sight on a phone -->
            <GoogleCalendarSync v-if="selectedFamily" class="calendar-google" compact />
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

                <div class="calendar-filters">
                    <label v-if="families.length > 1" class="recipient-filter">
                        <span>Family</span>
                        <select class="form-select" v-model="familyScope" data-testid="calendar-family">
                            <option value="all">All families</option>
                            <option v-for="family in families" :key="family.id" :value="family.id">{{ family.name }}</option>
                        </select>
                    </label>
                    <label class="recipient-filter">
                        <span>Show</span>
                        <select class="form-select" v-model="recipientFilter" data-testid="calendar-filter">
                            <option value="all">Everyone</option>
                            <option v-for="person in people" :key="person.id" :value="person.id">{{ person.name }}</option>
                            <option value="household">Household tasks</option>
                        </select>
                    </label>
                </div>
            </div>

            <div v-if="loadError" class="calendar-error" role="alert">
                {{ loadError }}
                <button type="button" @click="refetch()">Try again</button>
            </div>

            <div class="calendar-layout">
                <section class="calendar-card month-card" :aria-label="`${monthLabel(month)}, ${monthCount} items`">
                    <div class="weekday-row" aria-hidden="true">
                        <span v-for="weekday in WEEKDAYS" :key="weekday">{{ weekday }}</span>
                    </div>

                    <div class="month-grid" :class="{ 'is-loading': isLoadingEvents }">
                        <button
                            v-for="(day, index) in days"
                            :key="day.key"
                            type="button"
                            class="day-cell"
                            :class="{
                                'is-outside': !day.inMonth,
                                'is-weekend': index % 7 >= 5,
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

                        <p v-if="isLoadingEvents" class="agenda-empty" role="status">Loading the family's plans…</p>

                        <ol v-else-if="dayEvents.length" class="agenda-list" tabindex="0" :aria-label="`Tasks and events for ${dayLabel(selectedDay)}`">
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
                                        <small v-if="manyFamilies" class="family-tag">{{ event.familyName }}</small>
                                        <span class="state-badge">{{ stateText(event) }}</span>
                                    </span>
                                    <i v-if="event.to" class="bi bi-chevron-right agenda-arrow" aria-hidden="true"></i>
                                </component>
                            </li>
                        </ol>

                        <p v-else class="agenda-empty">
                            Nothing planned{{ recipientFilter === 'all' ? '' : ' for this person' }}.
                        </p>

                    </section>

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

.calendar-google {
    flex: 0 0 auto;
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
    /* Room on the right for Bootstrap's arrow (form-select), so it isn't pressed to the edge */
    padding: 8px 40px 8px 12px;
    border: 1px solid var(--theme-border, #dfe3e8);
    border-radius: 12px;
    background-color: var(--theme-panel, #fff);
    background-position: right 14px center;
    color: var(--theme-text, #30332f);
}

.calendar-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
}

.family-tag {
    justify-self: start;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--theme-soft, #eaf5eb);
    color: var(--theme-green, #2d7d43) !important;
    font-weight: 700;
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

.agenda {
    display: flex;
    flex-direction: column;
    max-height: clamp(280px, calc(100dvh - 200px), 760px);
    overflow: hidden;
}

.agenda-head {
    flex-shrink: 0;
}

.agenda .agenda-list {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scrollbar-gutter: stable;
    padding-right: 6px;
}

/* ---- Month grid: square cells divided by thin lines, like Apple Calendar ---- */
.month-card {
    padding: 0;
    overflow: hidden;
    border-radius: 0;
}

.weekday-row,
.month-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
    border-bottom: 1px solid var(--theme-border, #dfe3e8);
    color: var(--theme-muted, #717b8e);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

.weekday-row span {
    padding: 10px 10px 8px;
    text-align: right;
}

.month-grid {
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
    min-height: 112px;
    padding: 6px 6px 8px;
    border: none;
    border-right: 1px solid var(--theme-border, #e6e9ed);
    border-bottom: 1px solid var(--theme-border, #e6e9ed);
    border-radius: 0;
    background: var(--theme-panel, #fff);
    color: inherit;
    text-align: left;
}

.day-cell:nth-child(7n) {
    border-right: none;
}

.day-cell:nth-last-child(-n + 7) {
    border-bottom: none;
}

.day-cell.is-weekend {
    /* A neutral tint of the panel, so it stays subtle in light and dark mode */
    background: color-mix(in srgb, var(--theme-text, #30332f) 3%, var(--theme-panel, #fff));
}

.day-cell:hover {
    background: color-mix(in srgb, var(--theme-text, #30332f) 6%, var(--theme-panel, #fff));
}

.day-cell.is-outside {
    color: var(--theme-muted, #9aa1ad);
}

.day-cell.is-outside .day-chips {
    opacity: 0.6;
}

/* The date sits top right; today is a filled circle, the selected day an outlined one */
.day-number {
    display: inline-grid;
    place-items: center;
    align-self: flex-end;
    min-width: 26px;
    height: 26px;
    padding: 0 4px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
}

.day-cell.is-selected .day-number {
    box-shadow: inset 0 0 0 1.5px var(--theme-green, #2d7d43);
    color: var(--theme-green, #2d7d43);
}

.day-cell.is-today .day-number {
    background: var(--theme-green, #2d7d43);
    box-shadow: none;
    /* The panel colour reads on the green in both modes (white in light, dark in dark) */
    color: var(--theme-panel, #fff);
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
    border-radius: 3px;
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
.state-claimed { --state: var(--theme-green, #2d7d43); --state-soft: var(--theme-soft, #e3f2e6); }
.state-in_progress { --state: var(--theme-blue, #2f6fb3); --state-soft: var(--theme-blue-soft, #e5effa); }
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
    margin: 0;
    padding: 8px 16px 14px;
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
    margin: 0;
    padding: 10px 16px 0;
    border-top: 1px solid var(--theme-border, #dfe3e8);
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

.agenda-empty {
    margin: 0;
    color: var(--theme-muted, #717b8e);
    font-size: 14px;
}

.calendar-page button:focus-visible,
.calendar-page a:focus-visible {
    outline: 2px solid var(--theme-green, #2d7d43);
    outline-offset: 2px;
}

/* Side by side: the day's list is as tall as the month and scrolls on its own,
   so a busy day doesn't stretch the page and carry the month away with it */
@media (min-width: 1100.02px) {
    .calendar-side {
        position: relative;
        align-self: stretch;
    }

    .calendar-side .agenda {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
    }

    .agenda-list {
        flex: 1;
        min-height: 0;
        margin-right: -8px;
        padding-right: 8px;
        overflow-y: auto;
        overscroll-behavior: contain;
    }
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
@media (max-width: 767.98px) {
    .calendar-header h1 {
        font-size: 26px;
    }

    .calendar-toolbar {
        margin: 12px 0;
    }

    .month-nav h2 {
        min-width: 0;
        margin: 0;
        font-size: 16px;
        white-space: nowrap;
    }

    .month-nav {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) 44px auto;
        gap: 4px;
        width: 100%;
    }

    .icon-button {
        width: 44px;
        height: 44px;
    }

    .today-button {
        min-height: 44px;
        margin-left: 0;
        padding: 7px 10px;
    }

    .calendar-side {
        grid-template-columns: minmax(0, 1fr);
    }

    .agenda-head {
        flex-wrap: wrap;
    }

    .add-task-button {
        min-height: 44px;
    }

    .calendar-filters {
        flex-direction: column;
        width: 100%;
    }

    .recipient-filter,
    .recipient-filter select {
        width: 100%;
        max-width: none;
    }

    .recipient-filter {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr);
    }

    .calendar-card {
        padding: 12px;
    }

    .month-card {
        padding: 0;
    }

    .weekday-row span {
        padding: 8px 0 6px;
        text-align: center;
    }

    .day-cell {
        align-items: center;
        min-height: 52px;
        padding: 4px 2px;
    }

    .day-number {
        align-self: center;
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

    .legend {
        padding-top: 12px;
        border-top: 1px solid var(--theme-border, #dfe3e8);
    }

    .dot {
        width: 6px;
        height: 6px;
    }
}
</style>
