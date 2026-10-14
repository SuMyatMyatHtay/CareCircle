// B composes existing C/D/E/F endpoints; it does not own their schemas.
import { http } from '../../../services/http.js'

export function authConfig(extra = {}) {
  const token = sessionStorage.getItem('token')
  if (!token) throw new Error('Please log in first.')
  return {
    ...extra,
    timeout: 10000,
    headers: { Authorization: `Bearer ${token}` },
  }
}

export function apiError(error, feature = 'This feature') {
  const status = error.response?.status
  if (status === 401) return 'Your session has expired. Please log in again.'
  if (
    status === 404 &&
    (error.response?.data?.error || error.response?.data?.message)
  ) {
    return error.response.data.error || error.response.data.message
  }
  if (status === 404 || status === 501)
    return `${feature} is not connected yet.`
  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.message ||
    'Please try again.'
  )
}

export async function listRecipients(familyId) {
  const { data } = await http.get(
    `/families/${familyId}/recipients`,
    authConfig(),
  )
  if (!Array.isArray(data.recipients))
    throw new Error('Invalid recipient data from server.')
  return data.recipients
}

export async function listDashboardTasks(familyId, filters) {
  const { data } = await http.get(
    `/families/${familyId}/tasks`,
    authConfig({ params: filters }),
  )
  if (!Array.isArray(data.tasks))
    throw new Error('Invalid task data from server.')
  return data.tasks
}

export async function claimDashboardTask(familyId, taskId) {
  const { data } = await http.post(
    `/families/${familyId}/tasks/${taskId}/claim`,
    {},
    authConfig(),
  )
  return data.task
}

export async function createDashboardTask(familyId, task) {
  const { data } = await http.post(
    `/families/${familyId}/tasks`,
    task,
    authConfig(),
  )
  return data.task
}
