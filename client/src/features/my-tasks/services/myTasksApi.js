// Owner: Chaithra (E)
// My Tasks: GET /api/me/tasks, plus D's start / unclaim / complete actions on a task.
import { http } from '../../../services/http.js'
import { queryClient, queryKeys } from '../../../services/queryClient.js'

export function authHeaders() {
    const token = sessionStorage.getItem('token')
    if (!token) throw new Error('Please log in first.')
    return { Authorization: `Bearer ${token}` }
}

// The logged-in user's claimed tasks across all their families.
// filters (all optional): { status: 'claimed,in_progress', from, to }
export async function getMyTasks(filters = {}) {
    const response = await http.get('/me/tasks', { headers: authHeaders(), params: filters })
    return response.data.tasks
}

async function taskAction(familyId, taskId, action) {
    const token = sessionStorage.getItem('token')
    try {
        const response = await http.post(
            `/families/${familyId}/tasks/${taskId}/${action}`, null, { headers: authHeaders() }
        )
        if (token !== sessionStorage.getItem('token')) return response.data
        const task = response.data.task
        await queryClient.cancelQueries({ queryKey: queryKeys.tasks(familyId) })
        if (token !== sessionStorage.getItem('token')) return response.data
        if (task) queryClient.setQueryData(queryKeys.tasks(familyId), old => old?.map(row => row._id === taskId ? task : row))
        await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(familyId) })
        window.dispatchEvent(new CustomEvent('carecircle:task-updated', { detail: { familyId, taskId, task, action } }))
        return response.data
    } catch (error) {
        if ([404, 409].includes(error.response?.status) && token === sessionStorage.getItem('token'))
            await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(familyId) })
        throw error
    }
}

// D's endpoints. Each returns { task } ("start" also returns transitSession)
export const startTask = (familyId, taskId) => taskAction(familyId, taskId, 'start')
export const unclaimTask = (familyId, taskId) => taskAction(familyId, taskId, 'unclaim')
export const completeTask = (familyId, taskId) => taskAction(familyId, taskId, 'complete')
export const claimTask = (familyId, taskId) => taskAction(familyId, taskId, 'claim')

// D's endpoint: DELETE a task (creator or admin)
export async function deleteTask(familyId, taskId) {
    const response = await http.delete(`/families/${familyId}/tasks/${taskId}`, { headers: authHeaders() })
    return response.data
}

// Works for both error shapes: { error, errors } (tasks, transit) and { message } (auth)
export function getErrorMessage(error) {
    if (error.response?.status === 401) return 'Your session has expired. Please log in again.'
    const data = error.response?.data
    if (data?.errors?.length) return data.errors.join(' ')
    return data?.error || data?.message || error.message || 'Something went wrong. Please try again.'
}
