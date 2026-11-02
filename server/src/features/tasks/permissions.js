const id = value => String(value?._id || value || '')

export function familyMember(family, userId) {
  return family?.members?.find(member => id(member.userId) === String(userId))
}

// The shared family setting controls overdue deletion and recurring schedule management.
export function canManageFamilyTasks(family, userId) {
  const member = familyMember(family, userId)
  return Boolean(member && (member.role === 'admin' || family.overdueTaskDeletion === 'member'))
}

export function isOverdueOpenTask(task, now = Date.now()) {
  return task.status === 'open' && +new Date(task.startAt) <= now
}

export function canDeleteFamilyTask(task, family, userId) {
  if (!familyMember(family, userId) || ['in_progress', 'completed'].includes(task.status)) return false
  return isOverdueOpenTask(task) ? canManageFamilyTasks(family, userId) : id(task.createdBy) === String(userId)
}
