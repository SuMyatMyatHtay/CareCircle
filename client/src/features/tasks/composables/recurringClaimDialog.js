import { shallowRef } from 'vue'
export const recurringClaim = shallowRef(null)
let resolveClaim
export function closeRecurringClaim(scope = null) {
  const resolve = resolveClaim
  resolveClaim = null; recurringClaim.value = null
  resolve?.(scope)
}
export function askRecurringClaim(task) {
  if (!task?.recurringSeries || task.recurrenceDetached) return Promise.resolve('one')
  closeRecurringClaim()
  recurringClaim.value = task
  return new Promise(resolve => { resolveClaim = resolve })
}
