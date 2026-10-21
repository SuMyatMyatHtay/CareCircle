<script setup>
// Owner: Chaithra (E)
// Progress row from Figma frame 10:  ● Claimed Thu 9:02am —— ○ In progress —— ○ Done
//   <TaskProgress :task="task" />
import { computed } from 'vue'
import { formatDay, formatTime } from '../utils/formatters.js'

const props = defineProps({
    task: { type: Object, required: true }
})

const ORDER = { claimed: 0, in_progress: 1, completed: 2 }
const current = computed(() => ORDER[props.task.status] ?? -1)

function stamp(value) {
    return value ? `${formatDay(value).split(' ')[0]} ${formatTime(value)}` : ''
}

const steps = computed(() => [
    { label: 'Claimed', time: stamp(props.task.claimedAt) },
    { label: props.task.needsTransit ? 'In transit' : 'In progress', time: '' },
    { label: 'Done', time: stamp(props.task.completedAt) }
])
</script>

<template>
    <ol class="task-progress" :aria-label="`Progress: ${steps[current]?.label || task.status}`">
        <template v-for="(step, index) in steps" :key="step.label">
            <li v-if="index > 0" class="line" aria-hidden="true"></li>
            <li class="step" :class="{ reached: index <= current, current: index === current }">
                <span class="dot" aria-hidden="true"></span>
                <span class="label">{{ step.label }}</span>
                <span v-if="index <= current && step.time" class="time">{{ step.time }}</span>
            </li>
        </template>
    </ol>
</template>

<style scoped>
.task-progress {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.step {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    font-weight: 500;
    color: var(--theme-muted, #6b7280);
    white-space: nowrap;
}

.line {
    flex: 0 1 40px;
    min-width: 12px;
    height: 2px;
    background: var(--theme-neutral, #e5e7eb);
}

.dot {
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--theme-border, #d1d5db);
    border-radius: 50%;
    background: var(--theme-panel, white);
}

.reached .dot {
    border-color: var(--theme-accent-border, #2f7a3f);
    background: #2f7a3f;
}

.reached .label {
    color: var(--theme-text, #2e2e2e);
}

.current .label {
    font-weight: 700;
}

.time {
    font-weight: 400;
    color: var(--theme-muted, #6b7280);
}
</style>
