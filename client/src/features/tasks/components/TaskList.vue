<script setup>
// A list of tasks with loading, error and empty states.
// The parent loads the tasks and passes them in; this component only displays them.
//   <TaskList :tasks="tasks" :is-loading="loading" :error-message="error" @retry="loadTasks" />
// Rows added or removed after the first render animate in and out (motion.css care-list).
// Pass flashIds for rows someone else just changed: they flash once (motion.css care-flash).
import { reactive, watch } from 'vue'
import TaskListItem from './TaskListItem.vue'
import TaskClaimActions from './TaskClaimActions.vue'

const props = defineProps({
    tasks: { type: Array, default: () => [] },
    isLoading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    emptyMessage: { type: String, default: 'No tasks yet. Add one with "New task".' },
    // e.g. '60vh': the list scrolls inside this height instead of growing the page
    maxHeight: { type: String, default: '' },
    // Ids of rows that just changed through a live update (never the user's own changes)
    flashIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['retry'])

// A row keeps the flash class until its animation ends, so it can flash again next time
const flashing = reactive(new Set())
watch(() => props.flashIds, (ids) => ids.forEach((taskId) => flashing.add(taskId)))

function endFlash(event, taskId) {
    if (event.animationName === 'care-flash') flashing.delete(taskId)
}
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

    <template v-else>
        <p v-if="tasks.length === 0" class="task-list-status">
            {{ emptyMessage }}
        </p>

        <!-- Stays mounted when empty, so the last row can still animate out -->
        <TransitionGroup name="care-list" tag="div" class="task-list overflow-y-auto pe-1"
            :style="{ maxHeight: maxHeight || null }">
            <TaskListItem v-for="task in tasks" :key="task._id" :task="task"
                :class="{ 'care-flash': flashing.has(task._id) }" @animationend="endFlash($event, task._id)">
                <template #actions="{ task: rowTask }">
                    <slot name="actions" :task="rowTask"><TaskClaimActions :task="rowTask" /></slot>
                </template>
            </TaskListItem>
        </TransitionGroup>
    </template>
</template>

<style scoped>
.task-list {
    position: relative;
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
    color: var(--theme-muted, #7B8391);
    font-size: 14px;
}

.task-list-status.is-error {
    color: var(--theme-danger, #C0564B);
}
</style>
