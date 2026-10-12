<script setup>
// Coloured pill for a task's status, e.g. <TaskStatusBadge :status="task.status" />
import { computed } from 'vue'

const props = defineProps({
    status: { type: String, required: true },
    needsTransit: { type: Boolean, default: false }
})

const LABELS = {
    open: 'Needs someone',
    claimed: 'Claimed',
    in_progress: 'In progress',
    completed: 'Done',
    cancelled: 'Cancelled'
}

const label = computed(() => {
    if (props.status === 'in_progress' && props.needsTransit) return 'In transit'
    return LABELS[props.status] || props.status
})
</script>

<template>
    <span class="status-badge" :class="`status-${status}`">{{ label }}</span>
</template>

<style scoped>
.status-badge {
    display: inline-block;
    padding: 4px 11px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
}

.status-open {
    background: #FFF0EB;
    color: #C0564B;
}

.status-claimed {
    background: #E8F5E9;
    color: #2E7D43;
}

.status-in_progress {
    background: #2E7D43;
    color: white;
}

.status-completed {
    background: #EEF1F4;
    color: #5D6B7A;
}

.status-cancelled {
    background: #F3F3F3;
    color: #9A9A9A;
    text-decoration: line-through;
}
</style>
