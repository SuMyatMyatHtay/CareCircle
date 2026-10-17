<script setup>
// Owner: Jhen (C)
// Hub "Tasks" tab: this recipient's tasks grouped by day, with status filter chips
// and a "this week" summary. One request; filtering happens here.
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import SectionCard from '../../../components/common/SectionCard.vue'
import TaskList from '../../tasks/components/TaskList.vue'
import { getFamilyTasks, getTaskErrorMessage } from '../../tasks/services/tasksApi.js'
import { displayName, dateKey, formatDate } from '../recipientLabels.js'

const props = defineProps({
    recipient: { type: Object, required: true }
})

defineEmits(['updated'])

const route = useRoute()
const { selectedFamilyId } = useActiveFamily()

const recipientId = computed(() => route.params.recipientId)
const name = computed(() => displayName(props.recipient))

const tasks = ref([])
const tasksLoading = ref(false)
const tasksError = ref('')

function isCurrent(familyId, forRecipient) {
    return familyId === selectedFamilyId.value && forRecipient === recipientId.value
}

async function loadTasks() {
    const familyId = selectedFamilyId.value
    const forRecipient = recipientId.value
    tasksError.value = ''

    if (!familyId || !forRecipient) {
        tasks.value = []
        return
    }

    tasksLoading.value = true
    try {
        const result = await getFamilyTasks(familyId, { recipient: forRecipient })
        if (isCurrent(familyId, forRecipient)) tasks.value = result
    } catch (error) {
        if (isCurrent(familyId, forRecipient)) {
            tasks.value = []
            tasksError.value = getTaskErrorMessage(error)
        }
    } finally {
        if (isCurrent(familyId, forRecipient)) tasksLoading.value = false
    }
}

onMounted(loadTasks)
watch([selectedFamilyId, recipientId], loadTasks)

// ---- Filter chips ----
const FILTERS = [
    { value: 'all', label: 'All', statuses: null },
    { value: 'open', label: 'Needs someone', statuses: ['open'] },
    { value: 'claimed', label: 'Claimed', statuses: ['claimed', 'in_progress'] },
    { value: 'completed', label: 'Completed', statuses: ['completed'] }
]

const filter = ref('all')

function matches(task, filterValue) {
    const statuses = FILTERS.find((f) => f.value === filterValue)?.statuses
    return !statuses || statuses.includes(task.status)
}

const counts = computed(() =>
    Object.fromEntries(FILTERS.map((f) => [f.value, tasks.value.filter((t) => matches(t, f.value)).length]))
)

const shownTasks = computed(() => tasks.value.filter((t) => matches(t, filter.value)))

// ---- Group by day: today and later in date order, then "Earlier" (newest first) ----
const groups = computed(() => {
    const today = dateKey(new Date())
    const byDay = new Map()
    const earlier = []

    for (const task of shownTasks.value) {
        const key = dateKey(task.startAt)
        if (key < today) {
            earlier.push(task)
            continue
        }
        if (!byDay.has(key)) {
            const label = formatDate(task.startAt, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
            byDay.set(key, { key, label: key === today ? `TODAY · ${label}` : label, tasks: [] })
        }
        byDay.get(key).tasks.push(task)
    }

    const result = [...byDay.values()]
    if (earlier.length) result.push({ key: 'earlier', label: 'EARLIER', tasks: earlier.reverse() })
    return result
})

const emptyMessage = computed(() =>
    filter.value === 'all' ? `No tasks for ${name.value} yet.` : 'No tasks with this status.'
)

// ---- This week: the next 7 days, cancelled tasks left out ----
const week = computed(() => {
    const now = Date.now()
    const end = now + 7 * 24 * 60 * 60 * 1000
    const upcoming = tasks.value.filter((t) => {
        const start = new Date(t.startAt).getTime()
        return start >= now && start <= end && t.status !== 'cancelled'
    })
    return {
        total: upcoming.length,
        open: upcoming.filter((t) => t.status === 'open').length,
        transit: upcoming.filter((t) => t.needsTransit).length
    }
})
</script>

<template>
    <div class="row g-4">
        <div class="col-lg-8">
            <div class="filter-bar" role="group" aria-label="Filter tasks by status">
                <button v-for="option in FILTERS" :key="option.value" type="button" class="filter-chip"
                    :class="{ selected: filter === option.value }" :aria-pressed="filter === option.value"
                    @click="filter = option.value">
                    {{ option.label }} · {{ counts[option.value] }}
                </button>
            </div>

            <TaskList v-if="tasksLoading || tasksError || shownTasks.length === 0" :tasks="shownTasks"
                :is-loading="tasksLoading" :error-message="tasksError" :empty-message="emptyMessage"
                @retry="loadTasks" />

            <div v-else class="task-groups">
                <section v-for="group in groups" :key="group.key" class="task-group">
                    <h2 class="group-heading">{{ group.label }}</h2>
                    <TaskList :tasks="group.tasks" />
                </section>
            </div>
        </div>

        <div class="col-lg-4">
            <SectionCard :title="`This week for ${name}`">
                <dl class="week-stats">
                    <div>
                        <dt>Tasks</dt>
                        <dd>{{ week.total }}</dd>
                    </div>
                    <div>
                        <dt>Needs someone</dt>
                        <dd :class="{ 'is-alert': week.open }">{{ week.open }}</dd>
                    </div>
                    <div>
                        <dt>Trips needing transport</dt>
                        <dd>{{ week.transit }}</dd>
                    </div>
                </dl>
            </SectionCard>
        </div>
    </div>
</template>

<style scoped>
.filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
}

.filter-chip {
    padding: 6px 12px;
    border: 1px solid #E4ECE5;
    border-radius: 999px;
    background: white;
    color: #2F2F2F;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
}

.filter-chip:hover {
    background: #F7FAF7;
}

.filter-chip.selected {
    border-color: #2F2F2F;
    background: #2F2F2F;
    color: white;
}

.filter-chip:focus-visible {
    outline: 3px solid #A8D5B5;
    outline-offset: 2px;
}

.task-groups {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.group-heading {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #7B8391;
}

.week-stats {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
}

.week-stats div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 14px;
}

.week-stats dt {
    font-weight: 400;
    color: #7B8391;
}

.week-stats dd {
    margin: 0;
    font-weight: 700;
    color: #2F2F2F;
}

.week-stats dd.is-alert {
    color: #C0564B;
}
</style>
