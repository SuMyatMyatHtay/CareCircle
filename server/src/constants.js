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
export const MILESTONE_TYPES = ['departed', 'arrived', 'consultation_done', 'heading_home', 'home']

export const EVENTS = {
  TASK_CREATED: 'task.created',
  TASK_CLAIMED: 'task.claimed',
  TASK_UNCLAIMED: 'task.unclaimed',
  TASK_COMPLETED: 'task.completed',
  TASK_CANCELLED: 'task.cancelled',
  TRANSIT_MILESTONE: 'transit.milestone',
  LOG_CREATED: 'log.created',
  MEDICATION_CHANGED: 'medication.changed',
}
export const EVENT_TYPES = Object.values(EVENTS)
