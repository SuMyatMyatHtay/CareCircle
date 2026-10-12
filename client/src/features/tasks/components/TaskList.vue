<script setup>
// A list of tasks with loading, error and empty states.
// The parent loads the tasks and passes them in; this component only displays them.
//   <TaskList :tasks="tasks" :is-loading="loading" :error-message="error" @retry="loadTasks" />
import TaskListItem from './TaskListItem.vue'

defineProps({
    tasks: { type: Array, default: () => [] },
    isLoading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    emptyMessage: { type: String, default: 'No tasks yet. Add one with "New task".' },
    // e.g. '60vh': the list scrolls inside this height instead of growing the page
    maxHeight: { type: String, default: '' }
})

const emit = defineEmits(['retry'])
</script>

<template>
    <div v-if="isLoading" class="task-list-status" role="status">
        <div class="spinner-border spinner-border-sm text-success" aria-hidden="true"></div>
        Loading tasks...
    </div>

    <div v-else-if="errorMessage" class="task-list-status is-error" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('retry')">
            Try again
        </button>
    </div>

    <p v-else-if="tasks.length === 0" class="task-list-status">
        {{ emptyMessage }}
    </p>

    <div v-else class="task-list overflow-y-auto pe-1" :style="{ maxHeight: maxHeight || null }">
        <TaskListItem v-for="task in tasks" :key="task._id" :task="task">
            <template #actions="{ task: rowTask }">
                <slot name="actions" :task="rowTask"></slot>
            </template>
        </TaskListItem>
    </div>
</template>

<style scoped>
.task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.task-list-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0;
    padding: 18px 4px;
    color: #7B8391;
    font-size: 14px;
}

.task-list-status.is-error {
    color: #C0564B;
}
</style>
