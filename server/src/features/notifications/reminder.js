// Telegram reminders WITHOUT a cron job.
// runDueReminders(familyId) is called from requests the app already makes (see listNotifications
// and listTasks). Each call checks what is due for ONE family and sends it through notify().
//
// Every reminder is "claimed" with an atomic update first (flag on the task, or the day on the
// family), so two requests at the same moment can never send the same message twice.
//
// Limit: it only runs while someone has CareCircle open. If nobody opens the app, nothing is sent.
import Family from '../families/Family.model.js'
import Task from '../tasks/TaskModel.js'
import { notify } from '../../utils/notify.js'
import { EVENTS, TASK_STATUS } from '../../constants.js'

const HOUR = 60 * 60 * 1000
const SG_TZ = 'Asia/Singapore'
const SUMMARY_HOUR = 8 // daily summary goes out from 8am Singapore time
const MAX_PER_RUN = 10 // keep the request that triggers the sweep fast
const THROTTLE_MS = 30 * 1000

// Best effort only: serverless may start a fresh instance, which is fine, the flags stop duplicates
const lastRun = new Map()

const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: SG_TZ }).format(date)
const sgHour = (date) =>
  Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: SG_TZ }).format(date))

// Find due tasks, flip their flag (only one request wins), then tell the group
async function sendForTasks({ familyId, filter, flag, eventType, now }) {
  const due = await Task.find({ family: familyId, ...filter, [flag]: null })
    .sort({ startAt: 1 })
    .limit(MAX_PER_RUN)
    .select('_id')
    .lean()

  for (const { _id } of due) {
    const { modifiedCount } = await Task.updateOne({ _id, [flag]: null }, { $set: { [flag]: now } })
    if (!modifiedCount) continue // another request got there first
    const populated = await Task.getPopulatedTaskById(_id)
    if (populated) await notify(familyId, eventType, populated)
  }
}

// "Still unclaimed" alert: open task, starts within 24h
function unclaimedAlerts(familyId, now) {
  return sendForTasks({
    familyId,
    now,
    flag: 'unclaimedReminderAt',
    eventType: EVENTS.TASK_UNCLAIMED_SOON,
    filter: {
      status: TASK_STATUS.OPEN,
      claimedBy: null,
      startAt: { $gt: now, $lte: new Date(now.getTime() + 24 * HOUR) },
    },
  })
}

// "Reminder" for a claimed task that starts within the hour
function beforeTaskReminders(familyId, now) {
  return sendForTasks({
    familyId,
    now,
    flag: 'beforeReminderAt',
    eventType: EVENTS.TASK_STARTING_SOON,
    filter: {
      status: TASK_STATUS.CLAIMED,
      startAt: { $gt: now, $lte: new Date(now.getTime() + HOUR) },
    },
  })
}

// One summary per Singapore day, sent by the first request after 8am
async function dailySummary(family, now) {
  const today = dayKey(now)
  if (sgHour(now) < SUMMARY_HOUR || family.reminders?.lastSummaryDay === today) return

  const { modifiedCount } = await Family.updateOne(
    { _id: family._id, 'reminders.lastSummaryDay': { $ne: today } },
    { $set: { 'reminders.lastSummaryDay': today } },
  )
  if (!modifiedCount) return

  const start = new Date(`${today}T00:00:00+08:00`)
  const end = new Date(start.getTime() + 24 * HOUR)
  const tasks = await Task.find({
    family: family._id,
    status: { $in: [TASK_STATUS.OPEN, TASK_STATUS.CLAIMED, TASK_STATUS.IN_PROGRESS] },
    startAt: { $gte: start, $lt: end },
  })
    .sort({ startAt: 1 })
    .populate('recipient', 'name nickname')
    .populate('claimedBy', 'name')
    .lean()

  if (tasks.length) await notify(family._id, EVENTS.DAILY_SUMMARY, { tasks })
}

// Never throws, so it can't break the request that triggers it
export async function runDueReminders(familyId) {
  try {
    const key = String(familyId)
    const now = new Date()
    if (now.getTime() - (lastRun.get(key) || 0) < THROTTLE_MS) return
    lastRun.set(key, now.getTime())

    const family = await Family.findById(familyId).select('telegram reminders').lean()
    if (!family?.telegram?.chatId) return // no group linked, nothing to send to

    await unclaimedAlerts(family._id, now)
    if (family.reminders?.beforeTask === true) await beforeTaskReminders(family._id, now)
    if (family.reminders?.unclaimedTask === true) await unclaimedAlerts(family._id, now)
    if (family.reminders?.dailySummary === true) await dailySummary(family, now)
  } catch (error) {
    console.error('runDueReminders failed:', error.message)
  }
}

export async function runAllDueReminders() {
  try {
    const families = await Family.find({ 'telegram.chatId': { $nin: [null, ''] } }).select('_id').lean()
    for (const { _id } of families) await runDueReminders(_id)
  } catch (error) {
    console.error('runAllDueReminders failed:', error.message)
  }
}