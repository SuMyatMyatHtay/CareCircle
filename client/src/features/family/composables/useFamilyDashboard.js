import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useFamilyTasks, useTaskCache } from '../../../composables/useFamilyTasks.js'
import { queryKeys } from '../../../services/queryClient.js'
import { useFamilyWorkspace } from './useFamilyWorkspace.js'
import { previewState } from '../data/previewFamily.js'
import {
  apiError,
  claimDashboardTask,
  createDashboardTask,
} from '../services/dashboardApi.js'

export const singaporeDay = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(
    new Date(date),
  )
export function useFamilyDashboard() {
  const workspace = useFamilyWorkspace()
  const familyTasks = useFamilyTasks({ enabled: !workspace.isPreview })
  const taskCache = useTaskCache()
  const queryClient = useQueryClient()
  const updates = ref([]),
    busyId = ref(''),
    toast = ref(''),
    toastError = ref(false)
  const tasks = workspace.isPreview
    ? computed(() => previewState.tasks)
    : computed(() => {
        const from = new Date(`${singaporeDay(new Date())}T00:00:00+08:00`).getTime()
        return familyTasks.tasks.value.filter((task) => {
          const start = new Date(task.startAt).getTime()
          // Include today and the next 10 Singapore calendar days.
          return start >= from && start < from + 11 * 86400000 &&
            ['open', 'claimed', 'in_progress'].includes(task.status)
        })
      })
  const loading = workspace.isPreview ? ref(false) : familyTasks.isLoading
  const error = workspace.isPreview ? ref('') : familyTasks.errorMessage
  const activity = workspace.isPreview
    ? computed(() => previewState.updates)
    : updates
  const todayTasks = computed(() =>
    tasks.value
      .filter(
        (task) =>
          singaporeDay(task.startAt) === singaporeDay(new Date()) &&
          !['completed', 'cancelled'].includes(task.status),
      )
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
  )
  const openTaskCount = computed(
    () => tasks.value.filter((task) => task.status === 'open').length,
  )
  let version = 0,
    interval,
    toastTimer
  function showToast(message, isError = false) {
    toast.value = message
    toastError.value = isError
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = ''
    }, 6000)
  }
  function addActivity(text) {
    const update = {
      _id: crypto.randomUUID(),
      actor: workspace.user.value.name,
      avatar: workspace.user.value.avatar,
      text,
      time: new Intl.DateTimeFormat('en-SG', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Singapore',
      }).format(new Date()),
    }
    const list = workspace.isPreview ? previewState.updates : updates.value
    list.unshift(update)
    list.splice(8)
  }
  async function loadTasks(silent = false) {
    if (workspace.isPreview) return
    const current = ++version,
      familyId = workspace.selectedFamilyId.value
    if (!familyId) return
    const previousTasks = [...tasks.value]
    // The shared cache contains ALL tasks for C/D's pages. Only this view
    // filters the dashboard window; never replace the cache with that subset.
    const result = await familyTasks.refetch()
    if (current !== version || familyId !== workspace.selectedFamilyId.value)
      return
    if (silent && !result.error) {
      const previous = new Map(
        previousTasks.map((task) => [task._id, task]),
      )
      const changed = tasks.value.filter(
        (task) =>
          !previous.has(task._id) ||
          previous.get(task._id).updatedAt !== task.updatedAt ||
          previous.get(task._id).status !== task.status,
      )
      const currentIds = new Set(tasks.value.map((task) => task._id))
      const removed = previousTasks.filter(
        (task) => !currentIds.has(task._id),
      )
      const changes = [...changed, ...removed]
      if (changes.length) {
        const message =
          changes.length === 1
            ? `“${changes[0].title}” was updated`
            : `${changes.length} tasks were updated`
        showToast(message)
        addActivity(message)
      }
    }
  }
  async function upsert(familyId, task) {
    // An older in-flight list must not undo a successful create or claim.
    await queryClient.cancelQueries({ queryKey: queryKeys.tasks(familyId) })
    taskCache.upsertTask(familyId, task)
    if (!queryClient.getQueryData(queryKeys.tasks(familyId)))
      await taskCache.invalidateTasks(familyId)
  }
  async function onTaskCreated(task) {
    const familyId = workspace.selectedFamilyId.value
    if (!familyId || workspace.isPreview) return
    await upsert(familyId, task)
    if (familyId !== workspace.selectedFamilyId.value) return
    addActivity(`${workspace.user.value.name} posted “${task.title}”`)
    showToast('A new chance to lend a hand. Task posted!')
  }
  async function claimTask(task) {
    const familyId = workspace.selectedFamilyId.value
    busyId.value = task._id
    try {
      if (workspace.isPreview) {
        if (task.status !== 'open')
          throw new Error('Someone already claimed this task.')
        task.status = 'claimed'
        task.claimedBy = {
          _id: workspace.user.value.id,
          ...workspace.user.value,
        }
      } else {
        const updated = await claimDashboardTask(familyId, task._id)
        if (familyId !== workspace.selectedFamilyId.value) return
        version++
        await upsert(familyId, updated)
        if (familyId !== workspace.selectedFamilyId.value) return
      }
      addActivity(`${workspace.user.value.name} claimed “${task.title}”`)
      showToast(`You’re taking care of “${task.title}”`)
    } catch (err) {
      if (familyId === workspace.selectedFamilyId.value) {
        showToast(apiError(err, 'Claiming tasks'), true)
        if (err.response?.status === 409) await loadTasks(true)
      }
    } finally {
      if (familyId === workspace.selectedFamilyId.value) busyId.value = ''
    }
  }
  async function createTask(input) {
    const familyId = workspace.selectedFamilyId.value
    if (workspace.isPreview) {
      previewState.tasks.push({
        ...input,
        _id: crypto.randomUUID(),
        status: 'open',
        claimedBy: null,
        recipient:
          previewState.recipients.find(
            (recipient) => recipient._id === input.recipient,
          ) || null,
      })
    } else {
      const task = await createDashboardTask(familyId, input)
      if (familyId !== workspace.selectedFamilyId.value) return false
      version++
      await upsert(familyId, task)
      if (familyId !== workspace.selectedFamilyId.value) return false
    }
    addActivity(`${workspace.user.value.name} posted “${input.title}”`)
    showToast('A new chance to lend a hand. Task posted!')
    return true
  }
  watch(
    workspace.selectedFamilyId,
    () => {
      version++
      updates.value = []
      toast.value = ''
      busyId.value = ''
    },
    { immediate: true },
  )
  function refreshVisible() {
    if (
      document.visibilityState === 'visible' &&
      !familyTasks.isFetching.value &&
      !busyId.value
    )
      loadTasks(true)
  }
  function onAssistantTaskUpdated(event) {
    const detail = event.detail
    if (workspace.isPreview || detail?.familyId !== workspace.selectedFamilyId.value) return
    const title = detail.task?.title || detail.title || 'Task'
    const action = { create: 'posted', update: 'updated', unclaim: 'unclaimed', delete: 'deleted' }[detail.action] || 'updated'
    addActivity(`${workspace.user.value.name} ${action} “${title}”`)
    showToast(`“${title}” ${action}.`)
  }
  onMounted(() => {
    if (!workspace.isPreview) {
      window.addEventListener('carecircle:task-updated', onAssistantTaskUpdated)
      interval = setInterval(refreshVisible, 20000)
      document.addEventListener('visibilitychange', refreshVisible)
    }
  })
  onUnmounted(() => {
    version++
    clearInterval(interval)
    clearTimeout(toastTimer)
    document.removeEventListener('visibilitychange', refreshVisible)
    window.removeEventListener('carecircle:task-updated', onAssistantTaskUpdated)
  })
  return {
    tasks,
    todayTasks,
    activity,
    loading,
    error,
    busyId,
    toast,
    toastError,
    openTaskCount,
    loadTasks,
    claimTask,
    createTask,
    onTaskCreated,
    showToast,
  }
}
