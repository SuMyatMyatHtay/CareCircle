import { http } from '../../../services/http.js'

async function post(familyId, path, body, signal) {
  const token = sessionStorage.getItem('token')
  if (!token) throw new Error('Please log in again to use the assistant.')
  // A wall-clock deadline also covers connections that never reach Axios's response timer.
  const deadline = AbortSignal.timeout(55000)
  try {
    const response = await http.post(`/families/${familyId}/assistant/${path}`, body, {
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      timeout: 55000, headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
  } catch (error) {
    if (deadline.aborted) throw Object.assign(new Error('Assistant request timed out'), { code: 'ECONNABORTED' })
    throw error
  }
}
export const sendAssistantMessage = (familyId, messages, signal) => post(familyId, 'chat', { messages }, signal)
export const confirmAssistantProposal = (familyId, id, signal) => post(familyId, `proposals/${id}/confirm`, {}, signal)
export const cancelAssistantProposal = (familyId, id, signal) => post(familyId, `proposals/${id}/cancel`, {}, signal)
export function assistantErrorMessage(error) {
  const data = error.response?.data
  if (data?.errors?.length) return data.errors.join(' ')
  if (error.response?.status === 401) return 'Your session expired. Please log in again.'
  if (error.code === 'ERR_CANCELED') return 'Stopped waiting. If you were saving, check your tasks before preparing another proposal.'
  return data?.message || data?.error || (error.code === 'ECONNABORTED'
    ? 'The request timed out. If you were saving, check your tasks or retry the same confirmation.'
    : 'Unable to reach the assistant. Please try again.')
}
