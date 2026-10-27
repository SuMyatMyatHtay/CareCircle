// Owner: SeungHak (F)
// State for the Telegram card in Family settings, and the "Recent updates" feed on Family Home.
// API calls are in ../services/notificationsApi.js.
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { apiError } from '../../family/services/dashboardApi.js'
import { getNotifications, getNotifySettings, saveNotifyEvents, sendTestMessage, unlinkTelegram } from '../services/notificationsApi.js'

// ---------------------------------------------------------------- Switches <-> events
// The settings card has five switches; the server stores event names (EVENTS in server/src/constants.js).
const GROUPS = {
  taskPosted: ['task.created', 'task.updated', 'task.deleted'],
  taskClaimed: ['task.claimed', 'task.unclaimed'],
  transitMilestone: ['transit.milestone'],
  careNote: ['log.created', 'log.updated', 'log.deleted', 'medication.changed'],
  taskCompleted: ['task.started', 'task.completed', 'task.cancelled'],
}
const ALL_EVENTS = Object.values(GROUPS).flat()

// A switch is on only when all of its events are on
const groupsFromEvents = (events) => {
  const on = new Set(events || [])
  return Object.fromEntries(Object.entries(GROUPS).map(([key, list]) => [key, list.every((e) => on.has(e))]))
}
const eventsFromGroups = (state) =>
  Object.entries(GROUPS).filter(([key]) => state[key]).flatMap(([, list]) => list)

// `source` is a ref or a function returning the family id ('' = nothing to load)
const resolve = (source) => (typeof source === 'function' ? source() : source?.value)

// ---------------------------------------------------------------- Telegram card state
export function useTelegramSettings(source) {
  const loading = ref(false), saving = ref(false), testing = ref(false)
  const error = ref(''), feedback = ref('')
  const linked = ref(false), linkedAt = ref(''), linkedByName = ref(''), botUsername = ref('CareCircleBot')
  const groups = ref(groupsFromEvents(ALL_EVENTS))
  let version = 0

  async function load() {
    const familyId = resolve(source)
    const current = ++version
    error.value = ''
    feedback.value = ''
    linked.value = false
    linkedAt.value = ''
    linkedByName.value = ''
    if (!familyId) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const data = await getNotifySettings(familyId)
      if (current !== version) return
      linked.value = Boolean(data.telegram.linked)
      linkedAt.value = data.telegram.linkedAt || ''
      linkedByName.value = data.telegram.linkedBy?.name || ''
      if (data.botUsername) botUsername.value = data.botUsername
      groups.value = groupsFromEvents(data.notifyOn)
    } catch (err) {
      if (current === version) error.value = apiError(err, 'Telegram settings')
    } finally {
      if (current === version) loading.value = false
    }
  }

  // Admins only (the server checks too). Flips the switch straight away; puts it back if saving fails.
  async function toggle(key, value) {
    const familyId = resolve(source)
    if (!familyId || saving.value) return
    const previous = { ...groups.value }
    const next = { ...previous, [key]: value }
    groups.value = next
    saving.value = true
    error.value = ''
    feedback.value = ''
    try {
      const saved = await saveNotifyEvents(familyId, eventsFromGroups(next))
      if (familyId !== resolve(source)) return
      groups.value = groupsFromEvents(saved)
      feedback.value = 'Telegram preferences saved.'
    } catch (err) {
      if (familyId === resolve(source)) {
        groups.value = previous
        error.value = apiError(err, 'Telegram settings')
      }
    } finally {
      saving.value = false
    }
  }

  async function sendTest() {
    const familyId = resolve(source)
    if (!familyId || testing.value) return
    testing.value = true
    error.value = ''
    feedback.value = ''
    try {
      await sendTestMessage(familyId)
      if (familyId === resolve(source)) feedback.value = 'Test message sent. Check your Telegram group.'
    } catch (err) {
      if (familyId === resolve(source)) error.value = err.response?.data?.error || apiError(err, 'Telegram settings')
    } finally {
      testing.value = false
    }
  }

  async function unlink() {
    const familyId = resolve(source)
    if (!familyId) return
    error.value = ''
    feedback.value = ''
    try {
      await unlinkTelegram(familyId)
      if (familyId !== resolve(source)) return
      linked.value = false
      linkedAt.value = ''
      linkedByName.value = ''
      feedback.value = 'Telegram group unlinked.'
    } catch (err) {
      if (familyId === resolve(source)) error.value = apiError(err, 'Telegram settings')
    }
  }

  watch(() => resolve(source), load, { immediate: true })
  return { loading, saving, testing, error, feedback, linked, linkedAt, linkedByName, botUsername, groups, toggle, sendTest, unlink }
}

// ---------------------------------------------------------------- "Recent updates" feed
// Polls every 20 s while the tab is visible (no Socket.IO, and the server is serverless).
const SG = 'Asia/Singapore'
const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: SG }).format(date)

function whenLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const time = new Intl.DateTimeFormat('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: SG }).format(date)
  if (dayKey(date) === dayKey(new Date())) return time
  return `${new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', timeZone: SG }).format(date)}, ${time}`
}

export function useRecentNotifications(source, { intervalMs = 20000, limit = 8 } = {}) {
  const items = ref([])
  let version = 0
  let timer

  async function load() {
    const familyId = resolve(source)
    const current = ++version
    if (!familyId) {
      items.value = []
      return
    }
    try {
      const notes = await getNotifications(familyId, limit)
      // Same shape RecentUpdates.vue already expects
      if (current === version) items.value = notes.map((n) => ({ _id: n._id, actor: 'Family', text: n.text, time: whenLabel(n.createdAt) }))
    } catch {
      /* keep the last list; the task board has its own error handling */
    }
  }

  watch(() => resolve(source), () => { items.value = []; load() }, { immediate: true })
  onMounted(() => {
    timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, intervalMs)
  })
  onUnmounted(() => clearInterval(timer))
  return { items }
}
