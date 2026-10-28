import mongoose from 'mongoose'
import Task from './TaskModel.js'
import Series from './RecurringSeries.model.js'
import Family from '../families/Family.model.js'
import { parseRecurrence, recurrenceDates, recurrenceLabel, generationHorizon, sgDay } from './recurrenceRule.js'
import { syncInBackground } from '../calendar-sync/sync.js'

const error = (status, message) => Object.assign(new Error(message), { status })
const id = value => String(value?._id || value || '')
const fields = ['title', 'description', 'category', 'recipient', 'location', 'needsTransit']
const mutable = { $in: ['open', 'claimed'] }

// Recurrence changes span many task documents. A transaction and a write to the
// series document serialize generation, claiming, detachment, editing and pause.
async function transaction(work) {
  const session = await mongoose.startSession()
  try { return await session.withTransaction(() => work(session)) }
  catch (err) {
    if (err.code === 20 || /Transaction numbers are only allowed/.test(err.message)) throw error(503, 'Repeating tasks require MongoDB Atlas or a MongoDB replica set. Ordinary tasks are still available.')
    throw err
  } finally { await session.endSession() }
}

async function lockSeries(seriesId, familyId, session) {
  const series = await Series.findOneAndUpdate({ _id: seriesId, family: familyId }, { $inc: { revision: 1 } }, { new: true, session })
  if (!series) throw error(404, 'Repeating task not found in this family')
  return series
}

function occurrenceData(series, occurrence) {
  const template = { ...series.template }
  let shift = 0, duration = series.endAt ? +series.endAt - +series.startAt : null
  for (const revision of series.revisions) {
    if (occurrence.index < revision.fromIndex) continue
    for (const field of fields) if (Object.hasOwn(revision.fields, field)) template[field] = revision.fields[field]
    if (revision.fields.timeShiftMs !== undefined) shift = revision.fields.timeShiftMs
    if (revision.fields.durationMs !== undefined) duration = revision.fields.durationMs
  }
  const startAt = new Date(+occurrence.startAt + shift)
  const claimed = series.usualHelper && +startAt > Date.now()
  return { ...template, family: series.family, createdBy: series.createdBy,
    recurringSeries: series._id, occurrenceIndex: occurrence.index, originalStartAt: occurrence.startAt,
    recurrenceLabel: recurrenceLabel(series.rule), startAt, endAt: duration == null ? null : new Date(+startAt + duration),
    status: claimed ? 'claimed' : 'open', claimedBy: claimed ? series.usualHelper : null,
    claimedAt: claimed ? series.helperClaimedAt : null }
}

async function materialize(series, session) {
  if (series.paused) return []
  if (series.usualHelper && !(await Family.exists({ _id: series.family, 'members.userId': series.usualHelper }).session(session))) {
    const previous = series.usualHelper
    series.usualHelper = null; series.helperClaimedAt = null
    await Task.updateMany({ family: series.family, recurringSeries: series._id, recurrenceDetached: false,
      claimedBy: previous, status: 'claimed', startAt: { $gt: new Date() } }, { $set: { status: 'open', claimedBy: null, claimedAt: null } }, { session })
  }
  const horizon = generationHorizon(series.startAt)
  const dates = recurrenceDates(series.rule, series.startAt, series.endAt, horizon)
  const existing = await Task.find({ family: series.family, recurringSeries: series._id }).select('occurrenceIndex').session(session).lean()
  const seen = new Set([...existing.map(task => task.occurrenceIndex), ...series.deletedOccurrences])
  const documents = dates.filter(date => !seen.has(date.index)).map(date => occurrenceData(series, date))
  if (documents.length) await Task.insertMany(documents, { session })
  series.generatedThrough = horizon
  series.generatedAll = series.rule.end.mode !== 'never'
  await series.save({ session })
  return documents
}

export async function createRecurringTasks(data, input, familyId, userId) {
  const rule = parseRecurrence(input, data.startAt)
  if (!rule) return null
  if (+data.startAt <= Date.now()) throw error(400, 'The first repeating session must be in the future')
  recurrenceDates(rule, data.startAt, data.endAt, generationHorizon(data.startAt))
  const check = new Task({ ...data, family: familyId, createdBy: userId }).validateSync()
  if (check) throw check
  const firstId = await transaction(async session => {
    const [series] = await Series.create([{ family: familyId, createdBy: userId, template: data,
      startAt: data.startAt, endAt: data.endAt, rule }], { session })
    await materialize(series, session)
    const first = await Task.findOne({ family: familyId, recurringSeries: series._id }).sort({ startAt: 1 }).session(session)
    return first._id
  })
  return Task.getPopulatedTaskById(firstId)
}

export async function ensureRecurringTasks(familyId) {
  const series = await Series.find({ family: familyId, paused: false }).lean()
  for (const entry of series) {
    const horizon = generationHorizon(entry.startAt)
    const helperLeft = entry.usualHelper && !(await Family.exists({ _id: familyId, 'members.userId': entry.usualHelper }))
    if (!helperLeft && (entry.generatedAll || (entry.generatedThrough && +new Date(entry.generatedThrough) >= +horizon))) continue
    const generated = await transaction(async session => {
      const locked = await lockSeries(entry._id, familyId, session)
      if (!locked.paused && (helperLeft || !locked.generatedThrough || +locked.generatedThrough < +horizon)) return materialize(locked, session)
    })
    if (generated?.length || helperLeft) syncInBackground(id(entry.createdBy), id(entry.usualHelper))
  }
}

export async function changeRecurringClaim(action, context) {
  const { taskId, familyId, userId, expectedUpdatedAt } = context
  return transaction(async session => {
    const snapshot = await Task.findOne({ _id: taskId, family: familyId }).session(session)
    if (!snapshot) throw error(404, 'Task not found')
    const series = await lockSeries(snapshot.recurringSeries, familyId, session)
    const task = await Task.findOne({ _id: taskId, family: familyId }).session(session)
    if (!task) throw error(404, 'Task not found')
    if (expectedUpdatedAt && +task.updatedAt !== +new Date(expectedUpdatedAt)) throw error(409, 'This task changed. Please prepare a new proposal.')
    const family = await Family.findOne({ _id: familyId, 'members.userId': userId }).session(session)
    if (!family) throw error(403, 'You are no longer a member of this family')
    const now = new Date()
    if (action === 'unclaim') {
      if (task.status !== 'claimed') throw error(409, 'Only a claimed task that has not started can be unclaimed')
      if (![id(task.claimedBy), id(task.createdBy)].includes(userId)) throw error(403, 'Only the creator or assigned person can unclaim this task')
      // A one-date opening is permanently excluded from future series claims.
      await Task.updateOne({ _id: task._id, family: familyId }, { $set: { status: 'open', claimedBy: null, claimedAt: null, recurrenceDetached: true } }, { session })
    } else {
      if (task.status !== 'open') throw error(409, 'Task already claimed or no longer available')
      if (+task.startAt <= +now) throw error(409, 'This task is overdue and can no longer be claimed')
      if (series.paused && !task.recurrenceDetached) throw error(409, 'This repeating task is paused')
      const scope = task.recurrenceDetached ? 'one' : (context.scope || 'series')
      if (!['one', 'next4', 'series'].includes(scope)) throw error(400, 'Choose this date, next four sessions or the whole series')
      if (scope === 'series') {
        if (series.usualHelper && id(series.usualHelper) !== userId) throw error(409, 'Someone already claimed this repeating series')
        series.usualHelper = userId; series.helperClaimedAt = now
        await series.save({ session })
        await materialize(series, session)
        await Task.updateMany({ recurringSeries: series._id, family: familyId, recurrenceDetached: false, status: 'open', startAt: { $gt: now } },
          { $set: { status: 'claimed', claimedBy: userId, claimedAt: now } }, { session })
      } else {
        const selected = scope === 'one' ? [task] : await Task.find({ recurringSeries: series._id, family: familyId,
          recurrenceDetached: false, status: 'open', startAt: { $gte: task.startAt, $gt: now } }).sort({ startAt: 1 }).limit(4).session(session)
        await Task.updateMany({ _id: { $in: selected.map(item => item._id) }, family: familyId, status: 'open', startAt: { $gt: now } },
          { $set: { status: 'claimed', claimedBy: userId, claimedAt: now, recurrenceDetached: true } }, { session })
      }
    }
    const saved = await Task.findById(taskId).session(session)
    if (action === 'claim' && (saved.status !== 'claimed' || id(saved.claimedBy) !== userId)) throw error(409, 'Task was changed by someone else')
    return { taskId: saved._id, usualHelper: series.usualHelper }
  })
}

export async function updateRecurringTasks(task, changes, scope = 'one', expectedUpdatedAt) {
  if (!['one', 'future', 'all'].includes(scope)) throw error(400, 'Choose this date, this and future sessions, or every upcoming session')
  const result = await transaction(async session => {
    const series = await lockSeries(task.recurringSeries, task.family, session)
    const current = await Task.findById(task._id).session(session)
    if (!current || (expectedUpdatedAt && +current.updatedAt !== +new Date(expectedUpdatedAt)) || +current.updatedAt !== +task.updatedAt) throw error(409, 'This task changed. Refresh and try again.')
    if (['completed', 'cancelled', 'in_progress'].includes(current.status)) throw error(409, 'Only upcoming, unstarted recurring sessions can be edited')
    if (current.recurrenceDetached && scope !== 'one') throw error(400, 'This is a one-day exception. Edit only this date.')
    if (scope === 'one') {
      await Task.updateOne({ _id: current._id, family: task.family }, { $set: { ...changes, recurrenceEdited: true } }, { session, runValidators: true })
    } else {
      const now = new Date()
      if (changes.startAt && sgDay(changes.startAt) !== sgDay(current.startAt)) throw error(400, 'To move a session to a different date, choose Only this date. Series-wide edits can change the time on existing dates.')
      if (+current.startAt <= +now) throw error(409, 'Series edits apply only to upcoming sessions')
      const revision = {}
      for (const field of fields) if (Object.hasOwn(changes, field)) revision[field] = changes[field]
      if (changes.startAt) revision.timeShiftMs = +changes.startAt - +current.originalStartAt
      if (Object.hasOwn(changes, 'endAt')) revision.durationMs = changes.endAt == null ? null : +changes.endAt - +(changes.startAt || current.startAt)
      const fromIndex = scope === 'future' ? current.occurrenceIndex : 0
      const candidates = await Task.find({ family: task.family, recurringSeries: series._id, recurrenceDetached: false,
        status: mutable, startAt: { $gt: now }, occurrenceIndex: { $gte: fromIndex } }).session(session)
      for (const entry of candidates) {
        const update = { ...changes }
        if (revision.timeShiftMs !== undefined) update.startAt = new Date(+entry.originalStartAt + revision.timeShiftMs)
        const duration = revision.durationMs !== undefined ? revision.durationMs : entry.endAt ? +entry.endAt - +entry.startAt : null
        if (changes.startAt || Object.hasOwn(changes, 'endAt')) update.endAt = duration == null ? null : new Date(+(update.startAt || entry.startAt) + duration)
        const validation = new Task({ ...entry.toObject(), ...update }).validateSync()
        if (validation) throw validation
        if (+new Date(update.startAt || entry.startAt) <= +now) throw error(400, 'A series edit cannot move an upcoming session into the past')
        await Task.updateOne({ _id: entry._id, family: task.family }, { $set: update }, { session, runValidators: true })
      }
      series.revisions.push({ fromIndex, fields: revision })
      await series.save({ session })
    }
    return { taskId: current._id, helper: id(series.usualHelper), creator: id(series.createdBy) }
  })
  syncInBackground(result.creator, result.helper)
  return result.taskId
}

export async function deleteRecurringOccurrence(task, expectedUpdatedAt) {
  await transaction(async session => {
    const series = await lockSeries(task.recurringSeries, task.family, session)
    const result = await Task.deleteOne({ _id: task._id, family: task.family, status: { $nin: ['in_progress', 'completed'] },
      updatedAt: expectedUpdatedAt ? new Date(expectedUpdatedAt) : task.updatedAt }, { session })
    if (!result.deletedCount) throw error(409, 'Task changed and cannot be deleted')
    if (!series.deletedOccurrences.includes(task.occurrenceIndex)) series.deletedOccurrences.push(task.occurrenceIndex)
    await series.save({ session })
  })
}

export async function listRecurringSeries(familyId) {
  await ensureRecurringTasks(familyId)
  return Series.find({ family: familyId }).select('createdBy template rule startAt endAt usualHelper paused generatedThrough').populate('usualHelper', 'name profilePicture').sort({ createdAt: -1 })
}

export async function setSeriesPaused(seriesId, familyId, userId, paused) {
  if (typeof paused !== 'boolean') throw error(400, 'Paused must be true or false')
  const helper = await transaction(async session => {
    const series = await lockSeries(seriesId, familyId, session)
    if (id(series.createdBy) !== userId) throw error(403, 'Only the creator can pause or resume this repeating task')
    if (series.paused === paused) return id(series.usualHelper)
    series.paused = paused
    await series.save({ session })
    const filter = { family: familyId, recurringSeries: series._id, recurrenceDetached: false, startAt: { $gt: new Date() } }
    if (paused) await Task.updateMany({ ...filter, status: mutable }, { $set: { status: 'cancelled', recurrencePaused: true } }, { session })
    else {
      await Task.updateMany({ ...filter, recurrencePaused: true, status: 'cancelled' }, { $set: {
        status: series.usualHelper ? 'claimed' : 'open', claimedBy: series.usualHelper || null,
        claimedAt: series.usualHelper ? series.helperClaimedAt : null, recurrencePaused: false,
      } }, { session })
      await materialize(series, session)
    }
    return id(series.usualHelper)
  })
  syncInBackground(userId, helper)
}
