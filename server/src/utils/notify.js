// The only way other packages talk to Telegram (docs/OWNERSHIP.md: "Call notify(familyId, eventType, payload)
// from server/src/utils/notify.js. Never call Telegram directly."):
//
//   await notify(familyId, EVENTS.TASK_CLAIMED, populatedTask)
//
// It saves a row in `notifications` (shown in "Recent updates"), then sends it. The row's status is:
//   sent     delivered to the family's Telegram group
//   skipped  no group linked yet, the family muted this event, or the caller passed { send: false }
//   failed   Telegram refused or timed out (the reason is in `error`)
//
// notify() never throws, so a Telegram outage can't make claiming a task fail.
//
// This file has three parts: 1) which events a family switched on, 2) the message wording, 3) notify() itself.
import mongoose from 'mongoose'
import Family from '../features/families/Family.model.js'
import Notification from '../features/notifications/Notifications.model.js'
import { sendTelegramMessage } from '../features/integrations/telegram.js'
import { EVENTS, EVENT_TYPES, NOTIFICATION_STATUS, NOTIFY_NONE } from '../constants.js'
const REMINDER_EVENTS = [EVENTS.TASK_STARTING_SOON, EVENTS.TASK_UNCLAIMED_SOON, EVENTS.DAILY_SUMMARY]

// ---------- Switches ----------
// family.notifyOn is a list of event names:
//   []         never configured -> everything is on (the design doc: "defaults to all")
//   ['none']   an admin switched everything off (an empty list can't mean "off")
//   [...]      only these events are on
export function isEventEnabled(notifyOn, eventType) {
  if (REMINDER_EVENTS.includes(eventType)) return true
  if (!Array.isArray(notifyOn) || notifyOn.length === 0) return true
  return notifyOn.includes(eventType)
}

// What the settings screen should show as switched on
export function effectiveEvents(notifyOn) {
  if (!Array.isArray(notifyOn) || notifyOn.length === 0) return [...EVENT_TYPES]
  return EVENT_TYPES.filter((eventType) => notifyOn.includes(eventType))
}

// Validate the body of PATCH /notify-settings. Returns { value } or { error }.
export function parseNotifyOn(input) {
  if (!Array.isArray(input)) return { error: 'notifyOn must be a list of event names' }
  const unknown = input.filter((eventType) => !EVENT_TYPES.includes(eventType))
  if (unknown.length) return { error: `Unknown events: ${unknown.join(', ')}. Use: ${EVENT_TYPES.join(', ')}` }
  const events = EVENT_TYPES.filter((eventType) => input.includes(eventType))
  return { value: events.length ? events : [NOTIFY_NONE] }
}

// ---------- Wordings ----------
// Matches the previews already in the client (NewTaskModal / TransitView) and seed.js.
// Group chats get forwarded, so NEVER put health details here: no drug names, doses,
// conditions, symptoms or free-typed note text. Say "medication was updated".
const SG_TZ = 'Asia/Singapore'

// Hand-typed transit steps arrive as type 'custom' with free text, which could say anything.
// Only these preset chip texts are repeated. Keep in sync with transit/utils/wording.js.
const SAFE_CUSTOM_LABELS = new Set(['seeing the doctor', 'collecting medicine', 'going for lunch'])
const HONORIFICS = /^(aunt|auntie|uncle|grandma|grandpa|mr|mrs|ms|dr)\.?$/i

// "Jasmine Tan" -> "Jasmine", "Aunt May" -> "Aunt May"
export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  return HONORIFICS.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0]
}

function idOf(value) {
  if (!value) return ''
  const raw = typeof value === 'object' && value._id ? value._id : value
  return String(raw)
}

const recipientLabel = (recipient) => recipient?.nickname || recipient?.name || ''
const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: SG_TZ }).format(date)

// "today 2:00pm", "tomorrow 9:30am", "Tue, 27 Oct 10:00am" (Singapore time)
export function whenLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  let day
  if (dayKey(date) === dayKey(now)) day = 'today'
  else if (dayKey(date) === dayKey(new Date(now.getTime() + 86400000))) day = 'tomorrow'
  else day = new Intl.DateTimeFormat('en-SG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: SG_TZ }).format(date)
  const time = new Intl.DateTimeFormat('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: SG_TZ })
    .format(date).replace(/\s/g, '').toLowerCase()
  return `${day} ${time}`
}

// "Buy formula and diapers for Baby Emma" (same style as seed.js); the plain title for a household task
function taskSubject(task) {
  const title = String(task.title || 'a task').trim()
  const who = recipientLabel(task.recipient)
  return who ? `${title} for ${who}` : title
}

const taskRef = (task) => ({ refType: 'task', refId: idOf(task) })

function transitMilestone(session) {
  const steps = session.milestones || []
  const step = steps[steps.length - 1]
  if (!step) return null
  const task = session.task && typeof session.task === 'object' ? session.task : null
  const companion = shortName(session.companion?.name)
  const who = recipientLabel(task?.recipient)
  const place = task?.location?.name
  const withWho = companion ? `, with ${companion}` : ''
  const subject = who || companion || 'The trip'

  const lines = {
    departed: `${companion || 'Someone'} is on the way${who ? ` to fetch ${who}` : ''}.`,
    arrived: `${subject} has arrived${place ? ` at ${place}` : ''}${withWho}.`,
    consultation_done: `${subject}'s consultation is done${withWho}.`,
    heading_home: `${subject} is heading home${withWho}.`,
    home: `${subject} is safely back home${withWho}.`,
  }
  let text = lines[step.type]
  if (!text) {
    const label = String(step.label || '').trim()
    text = SAFE_CUSTOM_LABELS.has(label.toLowerCase())
      ? `${label}${withWho}.`
      : `${subject} has a new trip update${withWho}.`
  }
  return { text, ...taskRef(session.task) }
}

// A log (has .recipient) or a care recipient (the care profile was edited)
const recipientOf = (payload) => (payload.recipient && typeof payload.recipient === 'object' ? payload.recipient : payload)

// Care log events. Only the kind of note and who it is for: never what is in it.
function logMessage(log, sentence) {
  const recipient = recipientOf(log)
  const kind = log.type === 'consultation' ? 'consultation note' : 'care note'
  return { text: sentence(kind, recipientLabel(recipient) || 'a family member'), refType: 'careRecipient', refId: idOf(recipient) }
}
// Whoever edited or deleted it (set by the logs controller), else the author
const editorName = (log) => shortName(log.changedBy?.name || log.author?.name) || 'Someone'
const LOG_EVENTS = [EVENTS.LOG_CREATED, EVENTS.LOG_UPDATED, EVENTS.LOG_DELETED]

const BUILDERS = {
  [EVENTS.TASK_CREATED]: (task) => {
    const when = whenLabel(task.startAt)
    const transit = task.needsTransit ? ' Needs someone to take them there.' : ''
    return { text: `New task: ${taskSubject(task)}${when ? `, ${when}` : ''}.${transit} Who can take it?`, ...taskRef(task) }
  },
  [EVENTS.TASK_UPDATED]: (task) => {
    const when = whenLabel(task.startAt)
    return { text: `${shortName(task.createdBy?.name) || 'Someone'} updated: ${taskSubject(task)}${when ? `, ${when}` : ''}.`, ...taskRef(task) }
  },
  [EVENTS.TASK_DELETED]: (task) => ({
    text: `${shortName(task.createdBy?.name) || 'Someone'} removed: ${taskSubject(task)}.`, ...taskRef(task),
  }),
  [EVENTS.TASK_STARTED]: (task) => ({
    text: `${shortName(task.claimedBy?.name) || 'Someone'} started: ${taskSubject(task)}.`, ...taskRef(task),
  }),
  [EVENTS.TASK_CLAIMED]: (task) => ({
    text: `${shortName(task.claimedBy?.name) || 'Someone'} claimed: ${taskSubject(task)}.`, ...taskRef(task),
  }),
  [EVENTS.TASK_UNCLAIMED]: (task) => {
    const subject = taskSubject(task)
    return { text: `${subject.charAt(0).toUpperCase()}${subject.slice(1)} needs someone again.`, ...taskRef(task) }
  },
  [EVENTS.TASK_COMPLETED]: (task) => ({
    text: `Done: ${taskSubject(task)}, by ${shortName(task.claimedBy?.name) || 'a family member'}.`, ...taskRef(task),
  }),
  [EVENTS.TASK_CANCELLED]: (task) => ({ text: `Cancelled: ${taskSubject(task)}.`, ...taskRef(task) }),
  [EVENTS.TRANSIT_MILESTONE]: transitMilestone,
  [EVENTS.LOG_CREATED]: (log) => logMessage(log, (kind, who) => `New ${kind} for ${who}.`),
  [EVENTS.LOG_UPDATED]: (log) => logMessage(log, (kind, who) => `${editorName(log)} edited a ${kind} for ${who}.`),
  [EVENTS.LOG_DELETED]: (log) => logMessage(log, (kind, who) => `${editorName(log)} deleted a ${kind} for ${who}.`),
  [EVENTS.MEDICATION_CHANGED]: (payload) => {
    const recipient = recipientOf(payload)
    return {
      text: `${recipientLabel(recipient) || 'A family member'}'s medication was updated. Check the app.`,
      refType: 'careRecipient', refId: idOf(recipient),
    }
  },
  [EVENTS.TASK_UNCLAIMED_SOON]: (task) => ({
    text: `Still unclaimed: ${taskSubject(task)}, ${whenLabel(task.startAt)}. Can anyone take it?`, ...taskRef(task),
  }),
  [EVENTS.TASK_STARTING_SOON]: (task) => ({
    text: `Reminder for ${shortName(task.claimedBy?.name) || 'the person who claimed it'}: ${taskSubject(task)}, ${whenLabel(task.startAt)}.`, ...taskRef(task),
  }),
  [EVENTS.DAILY_SUMMARY]: ({ tasks }) => ({
    text: `Today's tasks:\n${tasks.map((t) =>
      `• ${whenLabel(t.startAt).replace(/^today /, '')} ${taskSubject(t)} (${t.claimedBy ? shortName(t.claimedBy.name) : 'unclaimed'})`,
    ).join('\n')}`,
  }),
}

// Returns { text, refType, refId } or null when there is nothing to send
export function buildMessage(eventType, payload) {
  const build = BUILDERS[eventType]
  if (!build || !payload) return null
  const message = build(payload)
  return message?.text ? message : null
}

// Deep link to the page the event is about, using the real client routes.
// Needs APP_URL (the website address); returns '' when it isn't set.
export function deepLink({ eventType, refType, refId, familyId }) {
  const base = (process.env.APP_URL || '').replace(/\/+$/, '')
  if (!base || !refId) return ''
  if (refType === 'task') {
    if (eventType === EVENTS.TASK_DELETED) return '' // the task page no longer exists
    return eventType === EVENTS.TRANSIT_MILESTONE
      ? `${base}/transit/${familyId}/${refId}`
      : `${base}/families/${familyId}/tasks/${refId}`
  }
  if (refType === 'careRecipient') {
    return LOG_EVENTS.includes(eventType) ? `${base}/recipients/${refId}/log` : `${base}/recipients/${refId}`
  }
  return ''
}

// ---------- Notify ----------
// { send: false } records the update for "Recent updates" without a Telegram message
// (e.g. a care note posted with "Notify the family Telegram group" unticked).
export async function notify(familyId, eventType, payload, { send = true } = {}) {
  try {
    if (!EVENT_TYPES.includes(eventType)) return null

    const id = familyId?._id ?? familyId
    if (!mongoose.isValidObjectId(id)) return null

    const message = buildMessage(eventType, payload)
    if (!message) return null

    const family = await Family.findById(id).select('telegram notifyOn').lean()
    if (!family) return null

    const chatId = family.telegram?.chatId
    const skip = !send || !chatId || !isEventEnabled(family.notifyOn, eventType)

    const record = await Notification.create({
      family: id,
      eventType,
      refType: message.refType,
      refId: mongoose.isValidObjectId(message.refId) ? message.refId : undefined,
      text: message.text,
      status: skip ? NOTIFICATION_STATUS.SKIPPED : NOTIFICATION_STATUS.PENDING,
    })
    if (skip) return record

    const link = deepLink({ eventType, refType: message.refType, refId: message.refId, familyId: String(id) })
    try {
      await sendTelegramMessage(chatId, link ? `${message.text}\n${link}` : message.text)
      record.status = NOTIFICATION_STATUS.SENT
      record.sentAt = new Date()
    } catch (error) {
      record.status = NOTIFICATION_STATUS.FAILED
      record.error = String(error.message).slice(0, 300)
    }
    await record.save()
    return record
  } catch (error) {
    console.error('notify() failed:', error.message)
    return null
  }
}