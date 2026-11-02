<script setup>
defineProps({ task: { type: Object, required: true } })
</script>
<template><span v-if="task.recurringSeries" class="recurring-task-badge" :title="task.recurrenceDetached ? 'This occurrence is separate. Claiming it covers this date only.' : 'Claiming this series can cover every upcoming session.'"><i class="bi" :class="task.recurrenceDetached ? 'bi-calendar-event' : 'bi-repeat'" aria-hidden="true"></i> {{ task.recurrenceDetached ? 'One date only' : task.recurrenceLabel || 'Repeating task' }}</span></template>
<style scoped>
.recurring-task-badge{display:inline-flex;align-items:center;gap:5px;background:var(--theme-soft,#eef1f5);color:var(--theme-muted,#717b8e);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:500;margin:5px 0}
</style>
