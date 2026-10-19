// Owner: Marcus (D)
// The selected family's tasks, cached with TanStack Query. Family home, the
// recipient Overview and the recipient Tasks tab all read this one list and
// filter it themselves, so moving between them doesn't refetch.
//
//   const { tasks, isLoading, errorMessage } = useFamilyTasks()
//   const mine = computed(() => tasks.value.filter((t) => taskRecipientId(t) === id))
//
// After changing a task, update the cache instead of refetching:
//   const { upsertTask, removeTask } = useTaskCache()
//   upsertTask(familyId, updatedTask)   // claim, edit, create, socket events...

import { computed } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useActiveFamily } from './useActiveFamily.js'
import { queryKeys } from '../services/queryClient.js'
import { getFamilyTasks, getTaskErrorMessage } from '../features/tasks/services/tasksApi.js'

// A task's recipient comes back populated ({ _id, name }) or as a bare id
export function taskRecipientId(task) {
    return task.recipient?._id ?? task.recipient ?? null
}

export function useFamilyTasks() {
    const { selectedFamilyId } = useActiveFamily()

    const query = useQuery({
        queryKey: computed(() => queryKeys.tasks(selectedFamilyId.value)),
        queryFn: ({ queryKey }) => getFamilyTasks(queryKey[1]),
        enabled: computed(() => Boolean(selectedFamilyId.value))
    })

    const tasks = computed(() => query.data.value ?? [])

    // Only show an error when there is nothing to show instead. If a background
    // refetch fails, keep showing the tasks we already have.
    const errorMessage = computed(() =>
        query.error.value && !query.data.value ? getTaskErrorMessage(query.error.value) : ''
    )

    return {
        tasks,
        isLoading: query.isLoading,
        errorMessage,
        refetch: query.refetch
    }
}

// Write task changes straight into the cache, so every page updates at once
export function useTaskCache() {
    const queryClient = useQueryClient()

    function upsertTask(familyId, task) {
        queryClient.setQueryData(queryKeys.tasks(familyId), (old) => {
            if (!old) return old
            const exists = old.some((t) => t._id === task._id)
            const next = exists ? old.map((t) => (t._id === task._id ? task : t)) : [...old, task]
            return next.sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
        })
    }

    function removeTask(familyId, taskId) {
        queryClient.setQueryData(queryKeys.tasks(familyId), (old) => old?.filter((t) => t._id !== taskId))
    }

    function invalidateTasks(familyId) {
        return queryClient.invalidateQueries({ queryKey: queryKeys.tasks(familyId) })
    }

    return { upsertTask, removeTask, invalidateTasks }
}
