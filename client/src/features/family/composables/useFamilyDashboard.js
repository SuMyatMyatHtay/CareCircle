import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useFamilyWorkspace } from './useFamilyWorkspace.js'
import { previewState } from '../data/previewFamily.js'
import {
  apiError,
  claimDashboardTask,
  createDashboardTask,
  listDashboardTasks,
} from '../services/dashboardApi.js'

export const singaporeDay = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(
    new Date(date),
  )
export function useFamilyDashboard() {
  const workspace = useFamilyWorkspace()
  const realTasks = ref([]),
    updates = ref([]),
    loading = ref(false),
    error = ref(''),
    busyId = ref(''),
    toast = ref(''),
    toastError = ref(false)
  const tasks = workspace.isPreview
    ? computed(() => previewState.tasks)
    : realTasks
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
    toastTimer,
    hasLoaded = false
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
    if (!familyId) {
      loading.value = false
      return
    }
    if (!silent) loading.value = true
    const day = singaporeDay(new Date())
    const from = new Date(`${day}T00:00:00+08:00`)
    try {
      const result = await listDashboardTasks(familyId, {
        from: from.toISOString(),
        to: new Date(from.getTime() + 7 * 86400000).toISOString(),
        status: 'open,claimed,in_progress',
      })
      if (current !== version || familyId !== workspace.selectedFamilyId.value)
        return
      if (silent && hasLoaded) {
        const previous = new Map(
          realTasks.value.map((task) => [task._id, task]),
        )
        const changed = result.filter(
          (task) =>
            !previous.has(task._id) ||
            previous.get(task._id).updatedAt !== task.updatedAt ||
            previous.get(task._id).status !== task.status,
        )
        const currentIds = new Set(result.map((task) => task._id))
        const removed = realTasks.value.filter(
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
      realTasks.value = result
      hasLoaded = true
      error.value = ''
    } catch (err) {
      if (current === version) error.value = apiError(err, 'Family tasks')
    } finally {
      if (current === version) loading.value = false
    }
  }
  function upsert(task) {
    const index = realTasks.value.findIndex((entry) => entry._id === task._id)
    if (index < 0) realTasks.value.push(task)
    else realTasks.value[index] = task
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
        loading.value = false
        upsert(updated)
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
      loading.value = false
      upsert(task)
    }
    addActivity(`${workspace.user.value.name} posted “${input.title}”`)
    showToast('A new chance to lend a hand. Task posted!')
    return true
  }
  watch(
    workspace.selectedFamilyId,
    () => {
      version++
      realTasks.value = []
      updates.value = []
      error.value = ''
      toast.value = ''
      busyId.value = ''
      hasLoaded = false
      loadTasks()
    },
    { immediate: true },
  )
  function refreshVisible() {
    if (
      document.visibilityState === 'visible' &&
      !loading.value &&
      !busyId.value
    )
      loadTasks(true)
  }
  onMounted(() => {
    if (!workspace.isPreview) {
      interval = setInterval(refreshVisible, 20000)
      document.addEventListener('visibilitychange', refreshVisible)
    }
  })
  onUnmounted(() => {
    version++
    clearInterval(interval)
    clearTimeout(toastTimer)
    document.removeEventListener('visibilitychange', refreshVisible)
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
    showToast,
  }
}
