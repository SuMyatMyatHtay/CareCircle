import { http } from '../../../services/http.js'

async function post(familyId, path, body, signal, onRetry) {
  const token = sessionStorage.getItem('token')
  if (!token) throw new Error('Please log in again to use the assistant.')
  // A wall-clock deadline also covers connections that never reach Axios's response timer.
  const deadline = AbortSignal.timeout(55000)
  let consumed = 0
  function readProgress(text) {
    const lines = text.slice(consumed).split('\n')
    lines.pop() // Keep an incomplete event until the next chunk arrives.
    for (const line of lines) {
      consumed += line.length + 1
      const event = JSON.parse(line)
      if (event.type === 'retry') onRetry?.(event)
    }
  }
  try {
    const response = await http.post(`/families/${familyId}/assistant/${path}`, body, {
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      timeout: 55000, headers: { Authorization: `Bearer ${token}`, ...(onRetry ? { Accept: 'application/x-ndjson' } : {}) },
      ...(onRetry ? { responseType: 'text', onDownloadProgress: event => {
        const text = event.event?.target?.responseText
        if (typeof text === 'string') readProgress(text)
      } } : {})
    })
    if (onRetry) {
      readProgress(response.data)
      const events = response.data.trim().split('\n').map(line => JSON.parse(line))
      const last = events.at(-1)
      if (last?.type === 'error') throw Object.assign(new Error(last.message), { response: { status: last.status, data: last } })
      if (last?.type !== 'result') throw new Error('The assistant connection ended before a reply arrived.')
      return last.data
    }
    return response.data
  } catch (error) {
    if (deadline.aborted) throw Object.assign(new Error('Assistant request timed out'), { code: 'ECONNABORTED' })
    throw error
  }
}
export const sendAssistantMessage = (familyId, messages, signal, selection = {}, onRetry) => post(familyId, 'chat', { messages, ...selection }, signal, onRetry)
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
