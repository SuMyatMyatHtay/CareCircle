<script setup>
// Owner: Chaithra (E)
// One task on My Tasks (Figma frame 10). Click a card to show its progress row and buttons.
import { computed } from 'vue'
import TaskProgress from './TaskProgress.vue'
import PersonAvatar from './PersonAvatar.vue'
import { formatDay, formatTime, recipientName } from '../utils/formatters.js'

const props = defineProps({
    task: { type: Object, required: true },
    expanded: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    reminder: { type: Object, default: null }, // { type: 'soon' | 'late', label }
    familyTone: { type: String, default: 'green' } // green | purple | blue | orange
})

const emit = defineEmits(['toggle', 'start', 'give-back', 'complete', 'open-trip'])

const who = computed(() => recipientName(props.task))
const place = computed(() => props.task.location?.name || props.task.location?.address || '')

const meta = computed(() =>
    [formatDay(props.task.startAt), formatTime(props.task.startAt), place.value].filter(Boolean).join(' · ')
)

const statusLabel = computed(() => {
    if (props.task.status === 'in_progress') return props.task.needsTransit ? 'In transit' : 'In progress'
    return { claimed: 'Claimed', completed: 'Done' }[props.task.status] || props.task.status
})
</script>

<template>
    <article class="task-card" :class="{ 'is-soon': reminder, 'is-done': task.status === 'completed' }">
        <button type="button" class="card-row" :aria-expanded="expanded" @click="emit('toggle')">
            <PersonAvatar :name="who" :size="44" />

            <span class="text">
                <span class="title-row">
                    <strong class="title">{{ task.title }}</strong>
                    <span class="badge" :class="`family-${familyTone}`">{{ task.family?.name }}</span>
                </span>
                <span class="meta">{{ meta }}<template v-if="who"> · for {{ who }}</template></span>
            </span>

            <span v-if="reminder" class="due-flag" :class="`due-${reminder.type}`">
                <i class="bi bi-clock" aria-hidden="true"></i> {{ reminder.label }}
            </span>
            <span v-else class="badge" :class="`status-${task.status}`">{{ statusLabel }}</span>
        </button>

        <div v-if="expanded" class="progress-box">
            <TaskProgress :task="task" class="progress-steps" />
            <span class="spacer"></span>
            <RouterLink
                v-if="task.family?._id"
                :to="{ name: 'task-detail', params: { familyId: task.family._id, taskId: task._id } }"
                class="details-link"
            >
                View task →
            </RouterLink>

            <template v-if="task.status === 'claimed'">
                <button type="button" class="btn-secondary" :disabled="busy" @click="emit('give-back')">Give back</button>
                <button type="button" class="btn-primary-cc" :disabled="busy" @click="emit('start')">
                    {{ task.needsTransit ? 'Start transit' : 'Start task' }}
                </button>
            </template>

            <template v-else-if="task.status === 'in_progress'">
                <button v-if="task.needsTransit" type="button" class="btn-secondary" @click="emit('open-trip')">Open transit</button>
                <button type="button" class="btn-primary-cc" :disabled="busy" @click="emit('complete')">Mark as done</button>
            </template>

            <button v-else-if="task.needsTransit" type="button" class="btn-secondary" @click="emit('open-trip')">
                View journey
            </button>
        </div>
    </article>
</template>

<style scoped>
/* Values from Figma file "CareCircle Wireframe", frame 10 · My tasks */
.task-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 16px;
    background: var(--theme-panel, white);
}

.task-card.is-soon {
    border-color: var(--theme-warning-border, #ffe6a3);
}

.task-card.is-done {
    opacity: 0.75;
}

.card-row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
}

.text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

.title {
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.08px;
    font-weight: 600;
    color: var(--theme-text, #2e2e2e);
}

.meta {
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    color: var(--theme-muted, #6b7280);
}

/* Badge component (Badge/Tags page): 6px + 4px inner padding, 12px medium */
.badge {
    flex: 0 0 auto;
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

.family-green,
.status-claimed { background: var(--theme-soft, #e8f5e9); color: var(--theme-green, #2f7a3f); }
.family-purple { background: var(--theme-purple-soft, #eee8fd); color: var(--theme-purple, #4b3b8f); }
.family-blue { background: var(--theme-blue-soft, #e3f0fb); color: var(--theme-blue, #1f5a8a); }
.family-orange { background: var(--theme-warning-soft, #fff8e1); color: var(--theme-warning, #7a5a00); }
.status-in_progress { background: #2f7a3f; color: white; }
.status-completed { background: var(--theme-page, #f3f4f6); color: var(--theme-muted, #6b7280); }

.due-flag {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    font-weight: 700;
    white-space: nowrap;
}

.due-flag .bi {
    font-size: 13px;
}

.due-soon { background: var(--theme-warning-soft, #fff8e1); color: var(--theme-warning, #7a5a00); }
.due-late { background: var(--theme-danger-soft, #ffe9e4); color: var(--theme-danger, #a33a26); }

.progress-box {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--theme-page, #fbfbf7);
}

.progress-steps {
    flex: 1 1 340px;
}

.spacer {
    flex: 0 1 0;
}

.details-link {
    padding: 0 6px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    color: var(--theme-green, #2f7a3f);
    white-space: nowrap;
}

/* Button component (Buttons page): 12px 16px, radius 8, 14px medium */
.btn-secondary,
.btn-primary-cc {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    white-space: nowrap;
}

.btn-secondary {
    border: 1px solid var(--theme-border, #e5e7eb);
    background: var(--theme-panel, white);
    color: var(--theme-blue, #1f2937);
}

.btn-secondary:hover {
    background: var(--theme-page, #f9fafb);
}

.btn-primary-cc {
    border: 1px solid var(--theme-accent-border, #2f7a3f);
    background: #2f7a3f;
    color: white;
}

.btn-primary-cc:hover {
    background: #286a36;
}

button:disabled {
    opacity: 0.6;
}

@media (max-width: 575px) {
    .card-row {
        flex-wrap: wrap;
    }

    .card-row > .badge,
    .card-row > .due-flag {
        margin-left: 58px;
    }
}
</style>
