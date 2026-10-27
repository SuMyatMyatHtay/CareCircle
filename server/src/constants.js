// Shared enums, imported by both models and controllers.
// No magic strings in route handlers: add new values here first.

export const FAMILY_ROLES = ['admin', 'member']

export const CARE_TYPES = ['elderly', 'pregnancy', 'postpartum', 'infant', 'injury', 'other']
export const MOBILITY_LEVELS = ['independent', 'assisted', 'wheelchair', 'bedbound']
export const ALLERGY_SEVERITIES = ['mild', 'severe']

export const TASK_CATEGORIES = [
  'appointment', 'therapy', 'errand', 'groceries',
  'childcare', 'medication', 'companionship', 'other',
]

export const TASK_STATUS = {
  OPEN: 'open',
  CLAIMED: 'claimed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}
export const TASK_STATUSES = Object.values(TASK_STATUS)

export const TRANSIT_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
}
export const TRANSIT_STATUSES = Object.values(TRANSIT_STATUS)
export const MILESTONE_TYPES = ['departed', 'arrived', 'consultation_done', 'heading_home', 'home', 'custom']

export const LOG_TYPES = ['consultation', 'medication_change', 'diet', 'symptom', 'general']
export const INPUT_METHODS = ['text', 'voice']
export const MEDICATION_CHANGES = ['added', 'stopped', 'dosage_changed']

export const EVENTS = {
  TASK_CREATED: 'task.created',
  TASK_CLAIMED: 'task.claimed',
  TASK_UNCLAIMED: 'task.unclaimed',
  TASK_COMPLETED: 'task.completed',
  TASK_CANCELLED: 'task.cancelled',
  TRANSIT_MILESTONE: 'transit.milestone',
  LOG_CREATED: 'log.created',
  LOG_UPDATED: 'log.updated',
  LOG_DELETED: 'log.deleted',
  MEDICATION_CHANGED: 'medication.changed',
}
export const EVENT_TYPES = Object.values(EVENTS)

export const NOTIFICATION_STATUS = { PENDING: 'pending', SENT: 'sent', FAILED: 'failed', SKIPPED: 'skipped' }
export const NOTIFICATION_STATUSES = Object.values(NOTIFICATION_STATUS)
export const NOTIFICATION_REF_TYPES = ['task', 'careRecipient']
export const NOTIFY_NONE = 'none'