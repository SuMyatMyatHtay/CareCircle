import { ref, computed, watch, onBeforeUnmount, toValue } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '../../../services/queryClient.js'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useTaskCache } from '../../../composables/useFamilyTasks.js'
import { sendAssistantMessage, confirmAssistantProposal, cancelAssistantProposal, assistantErrorMessage } from '../services/assistantApi.js'

export function conversationPayload(messages) {
  const recent = []
  let length = 0
  for (const message of [...messages].reverse()) {
    const metadata = message.proposal ? `\nTask proposal (${message.proposalState || 'pending'}): ${JSON.stringify(message.proposal)}`
      : message.tasks?.length ? `\nMatching tasks: ${JSON.stringify(message.tasks)}` : ''
    const content = (message.content + metadata).slice(0, 6000)
    if (recent.length >= 24 || length + content.length > 22000) break
    recent.unshift({ role: message.role, content })
    length += content.length
  }
  // A user-first window keeps conversation roles compatible with Gemini.
  while (recent.length && recent[0].role !== 'user') recent.shift()
  return recent
}

export function useAssistantChat(user) {
  const { selectedFamilyId, selectedFamily } = useFamilyWorkspace()
  const { upsertTask, removeTask, invalidateTasks } = useTaskCache()
  const queryClient = useQueryClient()
  const messages = ref([]), input = ref(''), busy = ref(false), error = ref(''), retryable = ref(false)
  const selectedTaskId = ref('')
  const editField = ref('')
  let selectingTask = false
  let version = 0, controller
  const canSend = computed(() => Boolean(selectedFamilyId.value && input.value.trim() && !busy.value))
  function reset() {
    version++; controller?.abort()
    messages.value = []; input.value = ''; error.value = ''; busy.value = false; retryable.value = false
    selectedTaskId.value = ''; editField.value = ''; selectingTask = false
  }
  watch([selectedFamilyId, () => toValue(user)?.id], reset)
  onBeforeUnmount(() => { version++; controller?.abort() })
  function begin() {
    controller?.abort(); controller = new AbortController()
    const requestVersion = ++version, token = sessionStorage.getItem('token'), familyId = selectedFamilyId.value
    busy.value = true; error.value = ''; retryable.value = false
    return { familyId, signal: controller.signal,
      current: () => requestVersion === version && token === sessionStorage.getItem('token') && familyId === selectedFamilyId.value,
      finish: () => {
        // A changed session must discard the reply, but still release this request's spinner.
        if (requestVersion !== version) return
        busy.value = false
        if (token !== sessionStorage.getItem('token')) {
          error.value = 'Your session changed. Start a new chat to continue.'
          retryable.value = false
        }
      } }
  }
  async function ask() {
    const request = begin()
    try {
      const result = await sendAssistantMessage(request.familyId, conversationPayload(messages.value), request.signal,
        selectedTaskId.value ? { selectedTaskId: selectedTaskId.value, selectTask: selectingTask, ...(editField.value ? { editField: editField.value } : {}) } : {})
      if (!request.current()) return
      selectingTask = false
      editField.value = result.editField || ''
      messages.value.push({ role: 'assistant', content: result.message, suggestions: result.suggestions || [],
        tasks: result.tasks || [], hasMore: result.hasMore, proposal: result.proposal, proposalState: result.proposal ? 'pending' : undefined })
    } catch (e) {
      if (request.current()) {
        const status = e.response?.status
        if ([400, 403, 404, 409, 410].includes(status)) {
          editField.value = ''
          messages.value.push({ role: 'assistant', content: assistantErrorMessage(e), suggestions: [] })
          retryable.value = false
        } else {
          error.value = assistantErrorMessage(e)
          retryable.value = e.code !== 'ERR_CANCELED' && (!status || status === 429 || status >= 500)
        }
      }
    } finally { request.finish() }
  }
  async function send(text = input.value) {
    if (busy.value || !selectedFamilyId.value || !text.trim()) return
    // A new message replaces the active draft; only the latest card can be confirmed.
    for (const message of messages.value) if (message.proposalState === 'pending') message.proposalState = 'replaced'
    messages.value.push({ role: 'user', content: text.trim().slice(0, 2000) })
    input.value = ''
    await ask()
  }
  async function selectTask(task) {
    if (busy.value || !task?.id) return
    selectedTaskId.value = task.id; editField.value = ''; selectingTask = true
    await send(`Selected task: ${task.title}. What can I do with this task?`)
  }
  async function confirm(message) {
    if (busy.value || message.proposalState !== 'pending') return
    const request = begin()
    try {
      const result = await confirmAssistantProposal(request.familyId, message.proposal.id, request.signal)
      if (!request.current()) return
      if (result.requiresSecondConfirmation) {
        message.proposal.deletionAcknowledged = true
        message.proposal.confirmationWarning = result.message
        return
      }
      message.proposalState = 'saved'
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(request.familyId) })
      if (!request.current()) return
      if (result.deleted) removeTask(request.familyId, result.taskId)
      else upsertTask(request.familyId, result.task)
      // Reconcile any in-flight fetch and refresh all visible task boards.
      void invalidateTasks(request.familyId)
      window.dispatchEvent(new CustomEvent('carecircle:task-updated', { detail: { familyId: request.familyId, task: result.task, taskId: result.taskId, deleted: result.deleted, action: message.proposal.action, title: message.proposal.task.title } }))
      const action = { create: 'Created', update: 'Updated', unclaim: 'Unclaimed', delete: 'Deleted', claim: 'Claimed', assign: 'Assigned', start: 'Started', complete: 'Completed', cancel: 'Cancelled' }[message.proposal.action]
      messages.value.push({ role: 'assistant', content: `${action}: ${result.task?.title || message.proposal.task.title}. Your task list is up to date.` })
    } catch (e) {
      if (request.current()) {
        error.value = assistantErrorMessage(e)
        if ([400, 403, 404, 409, 410].includes(e.response?.status)) message.proposalState = 'unavailable'
      }
    } finally { request.finish() }
  }
  async function dismiss(message) {
    if (busy.value || message.proposalState !== 'pending') return
    const request = begin()
    try {
      await cancelAssistantProposal(request.familyId, message.proposal.id, request.signal)
      if (request.current()) message.proposalState = 'cancelled'
    } catch (e) { if (request.current()) error.value = assistantErrorMessage(e) }
    finally { request.finish() }
  }
  async function retry() { if (!busy.value && retryable.value && selectedFamilyId.value) await ask() }
  function stop() { controller?.abort() }
  return { messages, input, busy, error, retryable, canSend, selectedFamilyId, selectedFamily, send, selectTask, confirm, dismiss, retry, reset, stop }
}
