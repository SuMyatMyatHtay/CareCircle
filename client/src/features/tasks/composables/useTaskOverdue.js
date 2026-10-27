import { computed, onMounted, onUnmounted, ref, toValue } from 'vue'

export function isTaskOverdue(task, now = Date.now()) {
  return Boolean(task?.startAt) && new Date(task.startAt).getTime() <= now
}

// Recheck while a task is on screen, so an open tab cannot keep offering an
// expired claim. The server also checks its own clock on every claim.
export function useTaskClock() {
  const now = ref(Date.now())
  let timer
  onMounted(() => { now.value = Date.now(); timer = setInterval(() => { now.value = Date.now() }, 1000) })
  onUnmounted(() => clearInterval(timer))
  return now
}

export function useTaskOverdue(task) {
  const now = useTaskClock()
  return computed(() => isTaskOverdue(toValue(task), now.value))
}
